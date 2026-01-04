/**
 * R2 Upload Worker for TeacherMode (S3 API Version)
 * This version uses S3-compatible API directly - no binding needed
 * Just paste this in the Cloudflare Dashboard quick editor
 */

// Your R2 credentials (set these as environment variables in Settings > Variables)
// ACCESS_KEY_ID = "5b40a5e65dbee4e98f0397d05234c9cc"
// SECRET_ACCESS_KEY = "91e360b82ff73344ac22b1109b7e7b390291a16d5a261837ec9a1594580f7329"

const R2_ACCOUNT_ID = "27b9b456ffb00615ded7d16756eb8bd8";
const R2_BUCKET = "imageassets";

export default {
    async fetch(request, env) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Secret',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== 'PUT' && request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            const filename = url.searchParams.get('filename') || `asset_${Date.now()}.jpg`;

            // Get image data
            const contentType = request.headers.get('Content-Type') || 'image/jpeg';
            let imageData;

            if (contentType.includes('application/json')) {
                const json = await request.json();
                const base64 = json.image.replace(/^data:image\/\w+;base64,/, '');
                imageData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            } else {
                imageData = new Uint8Array(await request.arrayBuffer());
            }

            // Upload to R2 via S3 API
            const s3Url = `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${filename}`;

            const s3Response = await signAndFetch(s3Url, 'PUT', imageData, {
                accessKeyId: env.ACCESS_KEY_ID,
                secretAccessKey: env.SECRET_ACCESS_KEY,
                region: 'auto',
                service: 's3',
            });

            if (!s3Response.ok) {
                const errorText = await s3Response.text();
                throw new Error(`R2 upload failed: ${s3Response.status} - ${errorText}`);
            }

            // Return public URL
            const publicUrl = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${filename}`;

            return new Response(JSON.stringify({
                success: true,
                url: publicUrl,
                filename: filename
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });

        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    }
};

// AWS Signature V4 signing for S3-compatible APIs
async function signAndFetch(url, method, body, credentials) {
    const urlObj = new URL(url);
    const host = urlObj.host;
    const path = urlObj.pathname;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const headers = {
        'Host': host,
        'X-Amz-Date': amzDate,
        'X-Amz-Content-Sha256': await sha256Hex(body),
        'Content-Type': 'image/jpeg',
    };

    // Create canonical request
    const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map(k => `${k.toLowerCase()}:${headers[k]}`)
        .join('\n') + '\n';

    const canonicalRequest = [
        method,
        path,
        '',
        canonicalHeaders,
        signedHeaders,
        headers['X-Amz-Content-Sha256']
    ].join('\n');

    // Create string to sign
    const credentialScope = `${dateStamp}/${credentials.region}/${credentials.service}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        await sha256Hex(canonicalRequest)
    ].join('\n');

    // Calculate signature
    const signingKey = await getSignatureKey(
        credentials.secretAccessKey,
        dateStamp,
        credentials.region,
        credentials.service
    );
    const signature = await hmacHex(signingKey, stringToSign);

    // Create authorization header
    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    headers['Authorization'] = authorization;

    return fetch(url, { method, headers, body });
}

async function sha256Hex(data) {
    const buffer = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data;
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key, data) {
    const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const dataBuffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer));
}

async function hmacHex(key, data) {
    const result = await hmac(key, data);
    return Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(secretKey, dateStamp, region, service) {
    const kDate = await hmac('AWS4' + secretKey, dateStamp);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    return hmac(kService, 'aws4_request');
}
