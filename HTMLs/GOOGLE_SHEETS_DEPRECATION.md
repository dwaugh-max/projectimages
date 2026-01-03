# GOOGLE SHEETS DEPRECATION PLAN

## Current Status
Google Sheets backend is still present as a legacy fallback but is no longer needed.

## Why Remove It?
1. **Supabase is superior** - Faster, more reliable, no script key rotation needed
2. **Maintenance burden** - Two backends to maintain
3. **User confusion** - Settings for both systems
4. **Performance** - Sheets API is slow compared to Supabase

## What Needs to be Removed

### 1. Bootstrap Configuration (lines 10-31)
Remove:
- `DEFAULT_URL` constant
- `DEFAULT_PIN` constant  
- `TM_BACKEND_URL` localStorage
- `TM_BACKEND_PIN` localStorage
- `TM_URL` and `TM_PIN` global variables

Keep:
- `TM_SUPABASE_URL` and `TM_SUPABASE_KEY`

### 2. fetchMissions() Function (lines 3372-3422)
Remove:
- Lines 3393-3422: Google Sheets fallback code
- Cache loading (lines 3394-3400) - can be kept but simplified

Keep:
- Supabase query (lines 3376-3391)
- Error handling

### 3. upload() Function (lines 3424-3475)
Remove:
- Lines 3455-3473: Google Sheets upload code

Keep:
- Supabase upload (lines 3441-3453)

### 4. Settings UI
Remove from settings panel:
- Backend URL input field
- Backend PIN input field
- Any references to "Legacy" or "Sheets"

### 5. Student Progress Tracking
Check if simroom.html still uses Google Sheets for progress logging.
If yes, migrate to Supabase.

## Migration Steps

1. ✅ **Add Forge Config to Supabase** (DONE - schema created)
2. ✅ **Fix lint errors** (DONE - removed duplicate FORGE_SYSTEM_CORE)
3. **Remove Google Sheets config** from bootstrap
4. **Simplify fetchMissions()** - Supabase only
5. **Simplify upload()** - Supabase only
6. **Update settings UI** - Remove legacy fields
7. **Test thoroughly** - Ensure no breakage
8. **Update documentation** - Remove Sheets references

## Rollback Plan
If issues arise:
- Revert to commit before removal
- Keep Supabase as primary, Sheets as emergency fallback
- Add feature flag: `USE_LEGACY_BACKEND`

## Timeline
- **Phase 1**: Create Supabase tables (DONE)
- **Phase 2**: Remove code references (IN PROGRESS)
- **Phase 3**: Test with real users (NEXT)
- **Phase 4**: Remove settings UI (AFTER TESTING)
