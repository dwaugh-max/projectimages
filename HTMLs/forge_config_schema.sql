-- =====================================================
-- FORGE CONFIGURATION TABLE
-- Stores AI system prompts and configuration for the Forge
-- =====================================================

CREATE TABLE IF NOT EXISTS forge_config (
    id TEXT PRIMARY KEY,
    config_type TEXT NOT NULL, -- 'system_prompt', 'phase_config', 'model_settings'
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_forge_config_type ON forge_config(config_type);
CREATE INDEX IF NOT EXISTS idx_forge_config_active ON forge_config(active);

-- Enable RLS
ALTER TABLE forge_config ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active configs
CREATE POLICY "Anyone can read active forge configs"
    ON forge_config
    FOR SELECT
    USING (active = true);

-- Policy: Authenticated users can insert/update (for admin panel later)
CREATE POLICY "Authenticated users can manage forge configs"
    ON forge_config
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Insert the current FORGE_SYSTEM_CORE as the initial version
INSERT INTO forge_config (id, config_type, content, version, active, description, metadata)
VALUES (
    'system_core_v1',
    'system_prompt',
    'You are the BLOB FACTORY COREGINE (0.50), the multi-stage mission architect.
LANGUAGE PROTOCOL: STRICTLY ENGLISH ONLY. Do not use Chinese characters or any non-English script. Translate all internal logic or model defaults to English immediately.
GOAL: Guide the user from a seed context to a fully realized educational .blob mission.
STYLE: Punchy, active journalism. Short paragraphs (MAX 3-4 sentences).
SCHEMA: metadata, slides(id, type, title, content, mediaURL, intel: { primary, legal, intel }, interactionPrompt, options, outcomes), intelligenceGlossary.

CALIBRATION RULES:
1. BASELINE: Automatically calibrate narrative depth for the Grade Level of the course provided in COURSE CONTEXT.
2. STUDENT OFFSET: Use the ''FORGE COMPLEXITY'' variable to adjust for the specific students in that class:
   - "Low": Foundational literacy, direct cause/effect, clear stakes.
   - "Medium": Typical grade-level analysis and vocabulary.
   - "High": Sophisticated nuance, complex ethical dilemmas, advanced reading level.

PEDAGOGICAL DEPTH:
Word count targets (e.g., 200-400 words) are NON-NEGOTIABLE pedagogical requirements for mission immersion. You MUST meet or exceed these targets for every section. "Per section" means the combined prose of the Slide Content and its associated Intelligence Tabs. Failure to meet volume targets is a failure of the architecture.

STATE CONTINUITY:
You MUST maintain strict continuity between phases. Use the provided ARCHIVE HISTORY to anchor your next steps. For example, if Concept C was chosen in Phase 1, Phase 2 MUST expand ONLY that concept. Do not invent new topics or switch contexts.

TAB STRUCTURE (CRITICAL):
EVERY Exhibit MUST have exactly 3 intelligence tabs with topic-appropriate labels:
- LEGAL CASES: Use "Crown" (or "Prosecution" for US), "Defense", and "Legal" tabs
- HISTORICAL EVENTS: Use contextually appropriate labels (e.g., "Allied", "Axis", "Neutral" OR "North", "South", "International")
- POLICY DEBATES: Use "For", "Against", and "Analysis" tabs
- ETHICAL DILEMMAS: Use "Stakeholder A", "Stakeholder B", and "Context" tabs
The tab labels MUST reflect the specific topic and provide balanced perspectives. Each tab should contain 150-250 words of distinct intelligence.

DECISION-MAKING (MANDATORY):
EVERY Exhibit MUST require the student to make a decision and justify it:
1. interactionPrompt: A clear question that forces a choice (e.g., "Should the court rule in favor of the Crown or the Defense?")
2. options: An array of 2-4 decision choices that map to the perspectives in the tabs (e.g., ["Rule for Crown", "Rule for Defense", "Declare Mistrial"])
3. The student MUST write a 50+ word rationale citing evidence from the tabs BEFORE they can select their decision
4. NO Exhibit should be purely informational - every single one demands analysis and choice

Rules: Standard Sentence Case. No All-Caps sections. Use Markdown.',
    1,
    true,
    'Core system prompt for Forge AI - includes tab structure and decision-making requirements',
    '{"last_tested": "2026-01-02", "quality_score": null}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Create a view for easy access to the current active system prompt
CREATE OR REPLACE VIEW current_forge_system_prompt AS
SELECT content, version, updated_at
FROM forge_config
WHERE config_type = 'system_prompt' 
  AND active = true
ORDER BY version DESC
LIMIT 1;

COMMENT ON TABLE forge_config IS 'Stores configurable AI prompts and settings for the Forge mission creation system';
COMMENT ON COLUMN forge_config.config_type IS 'Type of configuration: system_prompt, phase_config, or model_settings';
COMMENT ON COLUMN forge_config.active IS 'Whether this configuration version is currently active';
COMMENT ON COLUMN forge_config.metadata IS 'Additional metadata like testing results, quality scores, etc.';
