# Refactoring duplicated gameplay code without changing combat

**Date**: 2026-09-21 13:48 +07:00
**Severity**: Medium
**Component**: Combat, gameplay services, presentation, integration fixtures
**Status**: Completed — all six plan phases and eight acceptance items verified

## What Happened

The codebase review identified mixed combat responsibilities, repeated player assembly, presentation embedded in orchestration, and duplicated database setup. Refactoring separated these boundaries. It also fixed a confirmed inventory paging bug: `inventory:page:runes:2` has four segments, but the old handler read three and interpreted `page` as the category.

## The Brutal Truth

The frustrating part is that inventory tests copied helper logic instead of exercising the production interaction path. Passing those tests did not establish that a real page button worked. Combat changes carried a different risk: moving an RNG call or changing debuff identity could silently alter outcomes. Confidence had to come from preserved traces, not cleaner-looking files.

## Technical Details

- `BattleEngine.ts` now delegates attack, status, and shared rules. Pre-edit characterization preserves 276 seeded full traces, including input mutations.
- `combatantFactory.ts` shares pure player construction across raid, duel, and ranked; `Transaction` centralizes the existing type. SQL, seeds, event timing, and decorator order remain intact.
- `gameplayPanels.ts` separates pure rendering. Inventory protocol and real interaction tests now cover the four-segment paging path.
- `tests/helpers/database.ts` creates separate PGlite instances and applies the complete migration journal for each suite.
- Baseline: 163/163 tests in 22 suites; lint, strict typecheck, and clean build passed; import guard loaded 171 modules.
- Final: 198/198 tests in 25/25 files, 0 failed/skipped/todo, 27.27s with `--maxWorkers=2`; source lint, strict source typecheck, strict checks for four new test files and the database helper, and clean build passed; import guard loaded 177 modules. Focused factory/fixture/presentation checks passed 8/50/35 tests respectively. Review found no production defects; missing direct panel assertions were added before final validation.
- All 28 command definitions match baseline byte-for-byte (19,657 bytes). Schema, migrations, seeds, package manifest, lockfile, and workspace configuration are unchanged. Commands and evidence are recorded in `docs/refactor-plan.md`; local artifacts are `.tools/final-validation-tests.json` and `.tools/commands-after-refactor.json`.

## What We Tried

We chose bounded extractions with exclusive file ownership and captured combat expectations before source edits. A mechanical rewrite of every file was rejected because it would enlarge the regression surface without demonstrated benefit. Shared database setup uses a factory, not shared mutable database state.

The installed pnpm pre-run dependency check defaulted to `install` and encountered a `workspacePackagePatterns` mismatch. Verification used installed tools directly through Node; the available pnpm workaround is `pnpm_config_verify_deps_before_run='warn'`. Dependencies were not reinstalled to resolve this tooling issue. Final test workers were limited to two; baseline and final durations are not a performance comparison.

## Root Cause Analysis

The paging handler parsed a protocol it did not correctly model. Copied test implementations left that integration mistake uncovered. Repeated assembly and fixture code also spread identical responsibilities across files, increasing the effort required to preserve behavior consistently.

## Lessons Learned

Test production parsers and interaction handlers. Capture deterministic behavior before extracting stateful logic. Keep database lifetime explicit even when setup is shared. Passing isolated checks cannot replace a combined run, and PGlite cannot establish PostgreSQL row-lock equivalence.

## Next Steps

- Integration lead: all planned implementation, review, and combined verification complete; no remaining implementation blocker.
- Release owner: complete any environment-specific Discord/PostgreSQL checks required before release; done when those release checks pass. Validation used dummy environment values and isolated PGlite, with no live/staging Discord or real database execution. PostgreSQL concurrency is structurally preserved, not proven by these tests.
- Coverage percentage remains unmeasured because no V8/Istanbul provider was installed. No percentage is claimed. This session performed no commit, deployment, or database migration.

## Unresolved Questions

None.
