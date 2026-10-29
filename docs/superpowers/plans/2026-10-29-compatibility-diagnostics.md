# Compatibility and prompt diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Explain asset compatibility, preview the next message request, and explain world-book selection without changing saved ST data.
**Architecture:** Read-only compatibility reports from payloads; optional scan diagnostics collected in the existing scanner; one shared turn preparation used by preview and streaming. Preview caches the prepared turn and sends that exact snapshot only while its inputs remain unchanged.
**Tech Stack:** Existing React 18 / TypeScript / IndexedDB; no new dependency.
**Spec:** User's v0.6 roadmap in this conversation, prioritized compatibility tiers, pre-send preview and world-book explanations; direct execution and tested merge/push authorized.

## Global Constraints
- Pure browser, Chinese UI; preserve unknown fields and PNG carriers; no arbitrary JS runtime or API-key preview.
- Keep default scan feature switches unchanged. Advanced fields not active in chat are explicitly reported as retained, not advertised as executed.
- Preview covers normal next-message sends, not reroll/continue/group orchestration. These retain existing interfaces.
- Reuse current checkout (user fixes workspace path), feature branch; leave untracked .claude alone after prior policy denial.

## Review Focus
- Random/time macros and probability: preview must not reroll on confirmed send.
- Input/history/asset change while asynchronous preview resolves: discard stale result.
- Duplicate world IDs: diagnostics keyed by source index, not uid.
- Unsupported positions/features must not appear fully supported.
- Preview is read-only, no network/save, and no credentials in its display model.

### Task 1: World-book execution diagnostics
**Files:** src/lib/worldInfoScan.ts, src/lib/worldInfoDiagnostics.ts, src/lib/worldInfoDiagnostics.test.ts
**Interfaces:** optional `WorldInfoScanOptions.diagnostics`; optional `WorldInfoScanResult.diagnostics` with per-source decisions, matched keys, scan rounds, outcome and inactive-feature notes.
- [x] Add failing tests for disabled/empty/no-key/selective/probability/recursive/budget decisions, unchanged inputs, duplicate IDs, zero recursion budget.
- [x] Run targeted tests RED; instrument existing decisions, fix budget bypass at recursionDepth=0, preserve default behavior.
- [x] Run targeted and full suite GREEN; commit.

### Task 2: Asset-specific compatibility reports
**Files:** src/lib/assetCompatibility.ts, src/lib/assetCompatibility.test.ts, src/components/CompatibilityPanel.tsx, existing character/world/preset detail components.
**Interfaces:** `analyzeAssetCompatibility(kind, payload): CompatibilityFinding[]`, levels full/partial/retained/not-executed; reports contain evidence paths and limitations, never mutate payload.
- [x] Test real 修仙世界 and DarkSide fixtures, simple cards, unknown extensions, advanced world fields, unsupported marker/injection behavior and immutable roundtrip.
- [x] Implement report and detail UI; test RED→GREEN and full suite; commit.

### Task 3: Shared preparation and preview UI
**Files:** src/lib/chatStreaming.ts, src/lib/chatRuntime.ts, src/lib/promptBuilder.ts, src/lib/chatPreview.test.ts, src/screens/chat/useChatPromptPreview.ts, src/screens/chat/ChatPromptPreview.tsx, ChatScreen/ChatConversationPane/useChatStreamingActions.
**Interfaces:** `prepareStreamingChatTurn(input): Promise<{turn,prepared}>`; streaming optional preparedTurn; builder optional per-message source diagnostics. Preview reports final ordered messages with sources, estimates and scan decisions, not connection credentials.
- [x] Test preview includes processed input/current swipe, final prompt regex, source labels, deterministic snapshot reuse, and no diagnostic fields in model body.
- [x] Implement shared prep and stale-result guarding; modal preview with explicit send/cancel; retain ordinary send.
- [x] Browser test local mock: preview causes no request or chat write; confirmed body equals displayed snapshot, API key absent; changed inputs rebuild; Escape focus and narrow layout.
- [ ] Run all unit/build/browser/layout tests in Edge and Chrome; document matrix/limits/progress; final read-only review, resolve significant findings, commit/merge/push.
