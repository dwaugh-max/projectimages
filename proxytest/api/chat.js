export default async function handler(req, res) {
  // 1. Enable CORS (Allows your GitHub Page to talk to this Vercel function)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // REPLACE '*' with your GitHub URL later for security
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. Handle the "OPTIONS" preflight request (Browsers ask "Can I post here?" first)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Only allow POST requests for the actual data
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 4. Get the user's message from the frontend
    const { message } = req.body;

    // 5. Call OpenRouter with your SECRET key
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, // Pulled from Vercel Settings
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/your-username", // Optional: identifies your app to OpenRouter
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash:free", // Or any model you prefer
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await response.json();

    // 6. Send the AI's response back to your frontend
    return res.status(200).json(data);

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
