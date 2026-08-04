# Utopia Nexus Project Status Checkpoint

_Last updated: August 4, 2026_

## Connected Services

- GitHub repository: `shadowjuice69/utopia-nexus`
- Supabase project: `utopia-war-room`
- Supabase project ID: `kuqyrdujwygpsbywvmro`
- Region: `us-east-1`

## Architecture

- Discord bot collects Utopia data from Discord channels.
- Data pipeline flows through bot services/parsers into Supabase.
- Dashboard consumes Supabase data for war room, intelligence, waves, alerts, and kingdom views.
- Deployment stack includes Railway for backend services and Vercel for dashboard.

## Current Systems

- Discord.js v14 bot
- Supabase database integration
- Wiki/reference layer with imported game data
- Ops parsing and attack tracking
- Throne/intel parsing
- War analysis services
- Dashboard components including War Room, Intel, Waves, Alerts, Kingdom Overview, and Attack Calculator

## Current Priorities

- Verify all data pipelines update Supabase correctly.
- Improve realtime dashboard updates.
- Continue province intelligence integration.
- Strengthen authentication and persistent alert history.

## AI Handoff Notes

When continuing work:
1. Check GitHub code first.
2. Check Supabase tables and recent data flow.
3. Trace issues from Discord input -> bot parser/service -> Supabase -> dashboard.
4. Preserve existing architecture unless a migration is intentional.
