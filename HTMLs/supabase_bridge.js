/**
 * SITUATION ROOM // SUPABASE BRIDGE (v72)
 * Abstracted data layer for missions and curriculums.
 */

const SupabaseBridge = {
    client: null,

    init(url, key) {
        if (!url || !key) {
            console.warn("SUPABASE_BRIDGE: Missing credentials. Falling back to local/legacy mode.");
            return false;
        }
        // Check if library is available
        if (typeof supabase === 'undefined') {
            console.error("SUPABASE_BRIDGE: Supabase library not found. Load script first.");
            return false;
        }
        this.client = supabase.createClient(url, key);
        console.log("SUPABASE_BRIDGE: Initialized operational capacity.");
        return true;
    },

    // --- MISSION OPERATIONS ---
    async saveMission(teacherId, title, blobData) {
        if (!this.client) return this.saveToLegacy(title, blobData);

        const { data, error } = await this.client
            .from('missions')
            .upsert({
                teacher_id: teacherId,
                title: title,
                blob_data: blobData,
                updated_at: new Date()
            })
            .select();

        if (error) throw error;
        return data;
    },

    async fetchMissions(teacherId) {
        if (!this.client) return [];
        const { data, error } = await this.client
            .from('missions')
            .select('*')
            .eq('teacher_id', teacherId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // --- CURRICULUM OPERATIONS ---
    async fetchOutcomes(country, region, course) {
        if (!this.client) return [];
        let query = this.client.from('curriculum_outcomes').select('*');

        if (country) query = query.eq('country', country);
        if (region) query = query.eq('region', region);
        if (course) query = query.eq('course', course);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // --- LEGACY FALLBACK ---
    saveToLegacy(title, blobData) {
        console.log("SUPABASE_BRIDGE: Saving to localStorage fallback.");
        const legacyKey = `TM_MISSION_${Date.now()}`;
        localStorage.setItem(legacyKey, JSON.stringify({ title, blob_data: blobData }));
        return { id: legacyKey, status: 'local_cached' };
    }
};
