/**
 * SITUATION ROOM // SUPABASE BRIDGE (v73.SB.UDL)
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

    async toggleAI(missionId, enabled, teacherId) {
        if (!this.client) return false;
        let query = this.client
            .from('missions')
            .update({ ai_enabled: enabled, updated_at: new Date().toISOString() })
            .eq('mission_id', missionId);

        if (teacherId) query = query.eq('teacher_id', teacherId);

        const { error } = await query;
        if (error) throw error;
        return true;
    },

    async fetchMissionStatus(missionId) {
        if (!this.client) return null;
        const { data, error } = await this.client
            .from('missions')
            .select('ai_enabled, is_public, updated_at')
            .eq('mission_id', missionId)
            .single();

        if (error) return null;
        return data; // returns {ai_enabled: true/false, is_public: true/false}
    },

    // --- MISSION OPERATIONS ---
    async saveMission(missionId, name, payload, teacherId) {
        if (!this.client) return this.saveToLegacy(name, payload);

        const { data, error } = await this.client
            .from('missions')
            .upsert({
                mission_id: missionId,
                teacher_id: teacherId,
                title: name,
                blob_data: payload,
                is_public: true,
                ai_enabled: true, // v72 Default
                updated_at: new Date().toISOString()
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
        // Map back to legacy format for UI compatibility
        return data.map(m => ({
            id: m.mission_id,
            name: m.title,
            payload: m.blob_data,
            updated: m.updated_at,
            aiEnabled: m.ai_enabled !== false // Safeguard default true
        }));
    },

    async deleteMission(missionId, teacherId) {
        if (!this.client) return false;
        const { error } = await this.client
            .from('missions')
            .delete()
            .eq('mission_id', missionId)
            .eq('teacher_id', teacherId);

        if (error) throw error;
        return true;
    },

    // --- TELEMETRY / LOGGING OPERATIONS ---
    async logSubmission(logData) {
        if (!this.client) {
            console.warn("SUPABASE_BRIDGE: No client initialized. Caching locally.");
            return false;
        }

        const { data, error } = await this.client
            .from('simulation_logs')
            .insert({
                student_name: logData.studentName,
                class_period: logData.classPeriod,
                mission_id: logData.missionId,
                teacher_id: logData.teacherId,
                decision_json: logData.decisionJson,
                rationale: logData.rationale,
                score: logData.score
            })
            .select();

        if (error) throw error;
        return data;
    },

    async fetchLogs(teacherId, classCode) {
        if (!this.client) return [];
        let query = this.client.from('simulation_logs').select('*');

        if (teacherId) query = query.eq('teacher_id', teacherId);
        if (classCode) query = query.eq('class_period', classCode);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async deleteLogs(studentName, classCode) {
        if (!this.client) return false;
        const { error } = await this.client
            .from('simulation_logs')
            .delete()
            .eq('student_name', studentName)
            .eq('class_period', classCode);

        if (error) throw error;
        return true;
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
