# Phase 6 — Nexus Capability Expansion Audit

## Baseline

Phase 5 is merged into `main` at `165eed5`.

Phase 6 is derived from the Nexus-vs-TitanBot capability audit. This phase does **not** mean copying TitanBot wholesale. Nexus remains a Utopia-specific intelligence/operations system with stronger province → kingdom → role → data-scope authorization.

## TitanBot capabilities identified

TitanBot currently advertises:

- moderation and administration
- bulk ban/kick actions
- moderation notes and case management
- economy: shop, inventory, transfers, gambling
- tickets: claim/priority, limits, transcripts
- server/member/voice statistics
- reaction roles
- leveling and XP
- giveaways and rerolls
- birthdays and timezone-aware announcements
- reports and todo lists
- welcome messages and auto roles
- music with 24/7 mode and interactive controls
- Spotify, Deezer, YouTube and Apple Music inputs
- PostgreSQL persistence
- health endpoint and operational deployment support
- modular command loading and command-scale handling

Source: TitanBot README, inspected August 20, 2026.

## Capability disposition for Nexus

### P0 — Bring into Nexus

#### 1. Command platform hardening

**Status:** partially present after Phases 1–5.

Bring over the useful TitanBot architectural ideas:

- modular command discovery
- validation and duplicate detection
- command metadata
- centralized permission guard
- scalable command organization
- operational command health/readiness

Nexus must preserve its existing authorization model rather than replacing it with generic Discord role checks.

**Phase 6 outcome:** Nexus can grow toward a large command surface without turning `bot.js` into a monolith.

#### 2. Utility command layer

Prioritize utilities that directly support Nexus operators:

- server/bot status
- health/readiness diagnostics
- configuration inspection
- operational reports
- task/todo-style operator utilities

These should integrate with Nexus permissions and existing services.

#### 3. Music subsystem

TitanBot has a real music subsystem using Riffy/Lavalink. It supports voice playback, queue controls, loop/shuffle/seek, volume, now-playing and related controls. TitanBot documents support for Spotify, Deezer, YouTube and Apple Music inputs.

Nexus can adopt the architecture, not TitanBot's database layer:

- Riffy/Lavalink integration
- player lifecycle
- queue
- play/pause/resume/skip/stop
- volume
- now playing
- shuffle/loop/seek
- voice-channel cleanup

Spotify should be treated as a metadata/search/playlist input unless the chosen backend explicitly provides lawful playback support. Do not implement direct Spotify audio redistribution.

### P1 — Useful, but Nexus-specific implementation required

#### 4. Moderation / operator controls

Useful pieces:

- notes
- cases/audit records
- controlled administrative actions
- reports

Do not blindly copy generic ban/kick/moderation behavior. Nexus authorization must remain scoped to the kingdom/province/operator context.

#### 5. Ticket / incident workflow

Adapt TitanBot's ticket concepts for Nexus operations:

- incident/request records
- assignment/claim
- priority
- transcript/history
- operator ownership

This should connect to existing ops assignments and bot operation records where appropriate.

#### 6. Server and voice telemetry

Useful for Nexus operational visibility:

- bot uptime
- Discord connection state
- guild/channel/voice state
- command execution health
- background-job health

### P2 — Optional / not core Nexus scope

These are technically reusable but do not directly strengthen Utopia intelligence/war-room functionality:

- generic economy/shop/inventory
- gambling
- generic leveling/XP
- birthdays
- welcome/auto-role systems
- reaction-role system
- generic giveaways
- generic fun commands

They should not enter Phase 6 unless they acquire a clear Nexus use case.

## Explicit exclusions

Do **not**:

- replace Supabase with TitanBot's PostgreSQL architecture
- replace Nexus authorization with generic Discord permissions
- treat TitanBot memory/fallback data as authoritative Utopia intel
- copy TitanBot's generic server feature set simply to increase command count
- assume "150 commands" means Nexus needs exactly 150 commands
- implement direct Spotify audio redistribution

The previously inspected TitanBot command loader had a `MAX_COMMANDS=100` guard, so the reported "150 commands" should be treated as a capability/scale goal rather than a hard implementation requirement.

## Phase 6 implementation order

1. **Command platform hardening** — finish the scalable command foundation and operational discovery.
2. **Nexus utility/operator commands** — status, health, diagnostics and reports.
3. **Music/Lavalink subsystem** — isolated service with explicit configuration and graceful degradation.
4. **Incident/ticket workflow** — only after the first three are stable.
5. **Optional community features** — defer until a concrete Nexus use case exists.

## Definition of done

Phase 6 should produce:

- a documented Nexus capability matrix
- a scalable command architecture
- operator utility commands
- a production-safe music service boundary if music is enabled
- tests for permissions, command discovery and service failure isolation
- no regression in existing intel, authorization, dashboard or scheduled-job behavior
