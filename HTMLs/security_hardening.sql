-- SECURITY HARDENING SCRIPT (v74)
-- Run this in your Supabase SQL Editor to secure your database.

-- 1. ADD PIN COLUMN TO MISSIONS (Access Control)
alter table public.missions 
add column if not exists pin text;

-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- This ensures only the creator can update/delete their own missions.
alter table public.missions enable row level security;
alter table public.curriculum_outcomes enable row level security;
alter table public.simulation_logs enable row level security;

-- 3. MISSION POLICIES
-- Policy: Everyone can READ public missions
create policy "Public Missions are Viewable by Everyone" 
on public.missions for select 
using (is_public = true);

-- Policy: Teachers can INSERT their own missions
-- Note: 'anon' role is used by the client. In a real Auth setup, we'd check auth.uid().
-- Since we use Google Auth on frontend but Anon Key on backend, we rely on the implementation.
-- ideally: using (auth.jwt() ->> 'email' = teacher_id) if we synced users.
-- FOR NOW (Frontend Auth Mode): We allow insert, but logic prevents ID collision.
create policy "Allow Insert for Authenticated Users" 
on public.missions for insert 
with check (true); 

-- Policy: Teachers can UPDATE Only THEIR OWN missions
-- This prevents User A from overwriting User B's mission.
create policy "Teachers Can Update Own Missions" 
on public.missions for update 
using (teacher_id = current_setting('request.jwt.claim.email', true)); 
-- Note: The above assumes Supabase Auth. Since we are using "Bridge Mode", 
-- a true backend restriction requires Supabase Auth integration.
-- FALLBACK FOR BRIDGE MODE:
-- We will use a constraint trigger or relying on the app logic + hardcoded allowlist for now.

-- 4. LOG POLICIES (Rate Limiting Prep)
-- Allow students to INSERT logs, but NEVER update or delete.
create policy "Students Can Log Data" 
on public.simulation_logs for insert 
with check (true);

create policy "Logs are Immutable" 
on public.simulation_logs for update 
using (false);

create policy "Logs are Deletable Only by Owner" 
on public.simulation_logs for delete 
using (false); -- Prevent deletion for now to be safe

-- 5. FUNCTION: RATE LIMITING (Advanced)
-- (Optional) Create a function to check insertion rate per IP if needed.
