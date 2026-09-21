# OOP/SOLID refactor — 2026-09-21

Moved application SQL into named repositories and introduced injected persistence/unit-of-work contracts. Commands, menu, events and background jobs now share an explicitly composed service graph. Combat attack/status policies and inventory/deity/monster/reward policies have separate responsibilities.

The compatibility review caught two regressions before completion: legacy LootService grant overrides were ignored, and zero-argument registration initially used a different event bus/menu store. Both were corrected and covered by tests. Constructor defaults and repository aliases intentionally preserve old callers.

The implementation retains transaction boundaries, lock ordering and seeded combat behavior. Final validation is recorded in `docs/oop-solid-plan.md`. Tests use isolated PGlite and simulated Discord; live PostgreSQL concurrency and Discord behavior remain outside these checks.

Final gates passed: 265 tests / 35 files, source lint and strict typing, strict typing of new OOP tests, clean build with 214 importable modules, and all 28 command definitions identical. The first full test run overlapped compilation and hit an existing 5-second timeout; the full rerun passed without code, assertion or timeout changes. See the plan for exact evidence and limits.
