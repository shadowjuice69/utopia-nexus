# Nexus Build Intelligence Project

## Goal
Create a simple, paste-first build library for Utopia Nexus. Savage's build messages can be pasted exactly as received. Nexus parses them into structured reference data while preserving the original text.

## User workflow
1. Select a province/player.
2. Select a build type: War, CF, Pump, Recovery, Defense, Economy, or Custom.
3. Enter a build name.
4. Paste Savage's complete build exactly as received. No JSON editing.
5. Parse the build and review the detected sections.
6. Save it as the active reference or create a new version of an existing build.

## Data the parser must understand
- Building percentages.
- Military ratios: PPA, TPA, WPA, OSPA, EPA/DSPA.
- Minimum/at-least language and priority language such as "elites first" and "fill".
- Science allocations where `3x Alchemy` means 3 books, not 3 percent.
- Economy, Military, and Arcane science sections.
- Spells, thievery, priorities, conditions, and notes when present.
- Original raw build text must always be preserved.

## Build organization
A province can have multiple build types and versions. Example:

- Shadow / War / v3 (active)
- Shadow / CF / v2
- Shadow / Pump / v4

Saving an update creates a new version and preserves the previous snapshot.

## AI integration
The active reference build will eventually be supplied to the Nexus AI together with current recovered province, military, science, building, spell, thievery, and kingdom data.

The AI must distinguish:
- current state
- Savage reference target
- minimum requirement
- preferred target
- observed deficit/excess
- recommended action
- reason/evidence

Reference builds are strategic guidance, not absolute commands. The AI must not invent missing game data.

## Performance learning (later phase)
Track build outcomes by build version and situation, including war/CF/pump context. Compare versions using recovered game results. The AI may propose changes but must not silently overwrite Savage's build.

Proposed changes should show:
- old value
- new value
- evidence
- affected build section
- confidence/limitations

Approved changes create the next build version.

## Future province workflow
Connect builds to actual Nexus kingdom provinces. Add a bot workflow that can ask a province owner for their current build. Their pasted response can be parsed and stored as a new version.

## Current implementation
- Supabase `ai_builds` stores reference builds.
- Supabase `ai_build_versions` stores version snapshots.
- Dashboard AI → Reference Builds uses a paste-and-parse workflow.
- JSON remains an internal storage format; users should not have to edit JSON.

## Acceptance criteria
- A complete Savage build can be pasted without manual section splitting.
- No JSON is required from the user.
- Parse errors identify the specific unrecognized line.
- Saving does not destroy previous versions.
- Multiple build types can coexist for the same province.
- Only the active applicable reference is used by the advisor.
- AI recommendations are grounded in current Nexus data and the selected reference build.
- Existing scraper, Supabase ingestion, and advisor functionality remains stable.
