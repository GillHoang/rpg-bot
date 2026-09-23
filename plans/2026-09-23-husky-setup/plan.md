---
title: "Minimal Husky Setup"
description: "Wire a Husky 9 pre-commit hook for the pnpm TypeScript project without changing source files."
status: pending
priority: P2
effort: 30m
branch: codex/bug-audit-refactor
tags: [husky, pnpm, pre-commit]
created: 2026-09-23
---

# Overview

Set up and validate the existing Husky 9 installation with the smallest possible change set. Preserve all unrelated dirty-worktree changes.

## Current State

- `package.json:25-26` already contains `check` and `check:links` scripts; `package.json:30` already contains `test`.
- `package.json:36-37` already declares `husky` and `lint-staged`; `package.json:55` already has `prepare: "husky"`.
- `.husky/pre-commit:1` currently runs `pnpm test`.
- The worktree has extensive unrelated modified and untracked files. Do not reformat, revert, or stage them.
- The declared runtime is Node `>=20` (`package.json:58`), while installed `lint-staged@17.5.1` requires Node `>=22.22.1`. The current runtime is Node `22.23.2`, but the package contract is broader.

## Decision

Keep the pre-commit hook as a direct `pnpm test` invocation for this minimal setup. It is already present, requires no additional config file, and remains compatible with the declared Node 20 support. Use `pnpm check` in CI or before pushing for lint, typecheck, tests, and link checks.

Do not switch the hook to `lint-staged` unless the team deliberately chooses one of these compatibility changes:

1. Pin a `lint-staged` release whose engine supports Node 20, then configure staged-file lint/format commands; or
2. Raise `engines.node` to `>=22.22.1` and document that support change.

`lint-staged` is appropriate for fast staged-file linting/formatting, but it is not a replacement for the full test suite and should not silently become the only pre-push/CI validation.

## Exact Files To Modify

1. `.husky/pre-commit`
   - Keep the single command `pnpm test`.
   - Verify it has executable hook semantics for Husky 9 and contains no deprecated Husky 8 bootstrap lines.
   - If the current file is accepted as-is, make no content change; the file still belongs in setup validation, not a forced diff.
2. `package.json`
   - Keep `prepare: "husky"` and the existing Husky dependency.
   - No source scripts or runtime dependencies need changes for the direct-test approach.
   - Review the existing `lint-staged` dependency: remove it only if the project does not intend to use it, or retain it as an explicitly deferred staged-file workflow. Do not change the Node engine as part of this minimal setup.
3. `pnpm-lock.yaml`
   - Update only if dependency declarations are changed. Regenerate with pnpm; do not hand-edit.

No `src/**` files should be modified. No `.lintstagedrc*` file is needed for the recommended approach.

## Data Flow

Developer commit -> Husky invokes `.husky/pre-commit` -> `pnpm test` -> Vitest executes the repository test suite -> non-zero exit blocks the commit; zero exit allows it. CI/pre-push validation separately invokes `pnpm check`.

## Dependencies And Ordering

1. Confirm existing package and hook state.
2. Decide whether to retain or remove the currently declared `lint-staged` dependency, based on Node 20 support policy.
3. Ensure `pnpm install` runs `prepare` and creates/retains the Husky hook.
4. Validate the hook with the focused test command, then validate `pnpm check` before integration.

## Test Matrix

- Hook content: `.husky/pre-commit` contains only the intended Husky 9-compatible command.
- Dependency setup: clean install runs `prepare` successfully under the supported Node version policy.
- Behavior: `pnpm test` passes when invoked by the hook; a failing test returns non-zero and blocks the commit.
- Broader validation: `pnpm check` passes before merging/pushing.
- Compatibility: verify the selected dependency set against Node `>=20`; do not rely only on the current Node 22 machine.

## Risks And Mitigations

- **High / compatibility:** `lint-staged@17.5.1` excludes Node 20. Mitigate by keeping it out of the hook and pinning/removing it before any future adoption.
- **Medium / performance:** full tests may slow commits. Mitigate by keeping the hook minimal now and moving broader checks to CI; revisit staged linting only after engine policy is resolved.
- **Medium / dirty worktree:** existing changes can obscure validation. Mitigate by inspecting only hook/package diffs and never staging or reverting unrelated files.

## Rollback

Restore the previous `package.json` and `pnpm-lock.yaml` dependency state, remove the Husky hook directory only if Husky was newly introduced and no longer wanted, then run `pnpm install`. Do not revert unrelated source changes.

## Success Criteria

- Husky 9 `prepare` completes under pnpm.
- The pre-commit hook runs `pnpm test` and blocks commits on test failure.
- No source files are changed.
- Node 20 compatibility is not weakened by the hook setup.
- `pnpm check` remains the complete validation command.
