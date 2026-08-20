# Phase 5 — Scheduled Jobs

Implemented on `phase5-scheduled-jobs`.

- Central scheduler with isolated job failures.
- Explicit initial delays for tick-aligned jobs.
- Alert loop migrated to scheduler.
- Age watcher migrated to scheduler.
- Scheduler tests added.

The existing production timing semantics are preserved: tick alerts remain aligned to the next tick, and age checks remain every five minutes.
