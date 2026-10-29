# Daily workflow phase 2

Authority: user-approved v0.5 roadmap and instruction to implement, test, commit, merge and push. Continue on the existing feature branch; preserve `.claude/`. No release tag. Original ST payloads and unknown extensions must survive editing.

## Task 1: Modal interaction and scroll boundaries

Introduce one native dialog primitive for editors, detail drawers and confirmation/message dialogs. Escape uses the existing dirty guard, busy actions cannot close or duplicate saves, focus returns to the opener. Drawers fit the viewport with internal scrolling. Test lifecycle and busy handling first, then browser keyboard/focus tests at 360/768/1440 widths and short heights.

Verification: `npm test` and `npm run typecheck`. Expected: all tests pass, no type errors.

## Task 2: Shared appearance and asset discovery

Persist partial settings changes in a single IndexedDB transaction; share committed appearance between header and settings without overwriting API form drafts. Add name search, local tag filtering/editing and deterministic sorting for worlds/presets, retain existing character filters. Local organizational tags live in versioned settings, not ST payloads. Test concurrent partial updates, filtering and tags before UI integration.

Verification: `npm test` and `npm run typecheck`. Expected: all tests pass, no type errors.

## Task 3: Preset prompt operations and acceptance

Pure immutable add/copy/delete/reorder/enable operations preserve unknown fields and all sorting slots. Dynamic markers are not copyable (their identifiers bind runtime-generated content); ordinary prompts can be copied. Delete removes every matching order reference. Add references in every existing slot, creating default slot 100001 if absent. Browser checks cover operations, keyboard, theme synchronization, filters, responsive import/edit/save/chat/export and all existing reliability paths. One fresh final review, fixes, full suite/build/browser tests, then commit, merge main and push without force.

Verification: `npm test`, `npm run build`, Edge and Chrome browser checks, `git diff --check`. Expected: all pass. Update information/04-progress.md and tracked testing documentation. Do not claim real ST or Firefox validation.

## Review Focus

Nested modal focus and unsaved guards; rapid duplicate saves; short-screen reachability; appearance writes racing with other settings; local tags never altering exports; prompt references in multiple slots including unknown fields and dynamic markers.
