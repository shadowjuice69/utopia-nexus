# Nexus Development Workflow

This repository follows a lightweight Superpowers-inspired development protocol. The goal is to make changes deliberate, testable, reviewable, and verifiable without copying the Superpowers runtime into Nexus.

## Workflow

1. **Inspect** — identify the existing implementation, data flow, constraints, and affected files.
2. **Design** — describe the intended behavior and alternatives for architectural changes.
3. **Approval** — architectural changes wait for explicit user approval before implementation.
4. **Plan** — break approved work into small, independently verifiable tasks.
5. **Test** — add or update focused tests before implementation when practical.
6. **Implement** — make the smallest change that satisfies the approved behavior.
7. **Review** — compare the implementation against the design and look for regressions, duplication, security issues, and edge cases.
8. **Verify** — run the relevant automated checks and inspect the actual results.
9. **Report** — distinguish verified behavior from work that could not be executed or externally validated.

## Bounded vs. architectural work

Small, low-risk fixes may use a shortened inspect → implement → verify path when the intended behavior is already unambiguous.

Use the full design/approval/plan workflow for changes that affect architecture, data models, authentication, AI behavior, war-state logic, realtime behavior, or multiple subsystems.

## Dashboard verification

From `dashboard/`:

```bash
npm run lint
npm run test
npm run build
```

Or run the complete gate:

```bash
npm run verify
```

## Testing priorities

Prioritize behavior that can materially affect game operations:

- tick and timing calculations
- kingdom/province identity and configuration
- attack and wave assignment logic
- intel parsing and state transitions
- realtime update handling
- AI context construction and failure handling
- authentication/session behavior
- calculators and operational summaries

UI snapshots and purely cosmetic changes do not require broad integration coverage unless their behavior is operationally significant.

## Completion standard

A change is not considered verified merely because code was written or committed. The final report must state which checks actually ran and whether they passed. If a check could not be executed, say so explicitly.
