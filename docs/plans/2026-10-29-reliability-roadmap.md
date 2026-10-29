# Enjoy Silly reliability roadmap

Authority: user-approved roadmap in this conversation, 2026-10-29. Preserve all existing edits and `.claude/`. Pure browser architecture and lossless ST payloads remain constraints. No release tags until stage acceptance; actual ST import and multi-browser checks are explicit gates, not inferred from unit tests.

## Task 1: Serialized chat saving and session isolation

Add failing tests for persisted creation metadata, serialized writes, changes during saving, failure/retry and stale-session results. Implement a save coordinator and integrate chat lifecycle boundaries. Manual save updates the active archive; no implicit duplicate archives. Keep dirty state until the exact saved revision is acknowledged. Verify with `npm test`, `npm run typecheck`, `npm run build`.

## Task 2: Drafts, navigation and editor stability

Versioned independent draft storage, save/discard/cancel navigation and unload protection, message editing recovery, page error recovery, preset validation/conflicts. Tests first, then UI and browser failure-path checks. Finish v0.4 acceptance before advancing.

## Task 3: Daily workflow

Accessible multiline message editor and shared dialogs, responsive scroll boundaries, synchronized theme, asset search/filter/sort and preset prompt operations. Browser matrix: 360/768/1440 widths plus short window.

## Task 4: Compatibility and diagnostics

Asset support levels, nonexecuted scripts notice, prompt preview and world scan explanations, named roundtrip fixtures. Secrets excluded from diagnostics. Actual ST import spotchecks required.

## Task 5: Long conversations

Context budgeting, timed effects semantics, search/branch/confirmed summaries, measured performance and group generation recovery.

## Task 6: Recovery and maintainability

Versioned integrity-checked backups, atomic restore preview, quota and migration recovery, CI and compatibility documentation. No v1.0 claim before two stable iterations and browser acceptance.

## Review focus

Async completion crossing session boundaries; false saved indicators; unknown fields and image carrier retention; database failure paths; user data excluded from logs; no arbitrary imported scripts executed.

## 2026-10-29 checkpoint

Tasks 1–2 core implementation and reliability checks are present. Message editing from Task 3 was brought forward to support the Task 2 edit-draft recovery requirement. See `docs/testing-reliability.md` for reproducible evidence and remaining acceptance limits. Later tasks remain pending; no v0.4/v1.0 release tag has been created.
