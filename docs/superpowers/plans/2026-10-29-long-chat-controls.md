# Long chat controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship context budgeting, replayable world-info timed effects, conversation search and immutable branch archives.
**Architecture:** Pure budget and timed rules feed shared request preparation; history remains intact. Branch service atomically creates an independent snapshot with local provenance; search locates current-swipe messages.
**Tech Stack:** Existing React / TypeScript / IndexedDB, no new dependencies.
**Spec:** User's phase4 roadmap and direct-execution request in conversation. Priorities are the three requested features, not summaries or group orchestration.

## Global Constraints
- Chinese UI, browser only, no arbitrary imported JS; preserve ST unknown fields.
- User delegated decisions and authorized tested merge/push. Existing fixed checkout, feature branch; preserve .claude.
- Budget uses preset context/output or 8192/1024 defaults, heuristic tokens plus message overhead. Preserve all non-history prompts and latest user round; trim oldest history only; block irreducible overflow before network. Show omissions before ordinary send via preview when trimming is needed.
- Timed units are nonempty non-system message positions. Replay at user-message boundaries. Sticky includes activation position; cooldown starts at sticky expiry (or next message if no sticky); delay is minimum history age. Recompute on edits/swipes/reroll/restore/branch using current assets; no hidden persisted timer state.
- Branch creation does not switch the current conversation or modify its original archive; source/version/message index are local metadata outside ST payload.

## Review Focus
- Budget overflow must not clear input or issue a request; macro/probability snapshot must not reroll during fitting.
- Latest user round and system/character/world instructions must survive history truncation; source messages immutable.
- Timed state must not leak across source indexes or sessions, or advance on preview/reroll; budget-eliminated entries must not activate.
- Branch failures or stale source versions must not change originals; subsequent branch saves preserve provenance.
- Thousand-message search must find current swipe and locate/edit/branch correctly across archive switches.

### Task 1: Context budget
**Files:** src/lib/contextBudget.ts and test, chatRuntime.ts, chatStreaming.ts, useChatStreamingActions.ts, ChatPromptPreview.tsx.
**Interfaces:** BudgetReport on prepared request; ContextBudgetError before network; iterative suffix fitting with fixed time/random tape and single world scan.
- [x] Write tests preserving mandatory content/latest round, trimming oldest history, output reserve, invalid limits, overflow/no request, deterministic fitting; run RED.
- [x] Implement helpers and runtime integration; ordinary send preflight keeps input until prepared and confirms trimming (explicit preview remains available); run targeted/full tests GREEN; commit.

### Task 2: Timed effects
**Files:** src/lib/worldInfoTimed.ts and test, worldInfoScan.ts, worldInfoDiagnostics.ts, chatRuntime.ts, compatibility report/docs.
**Interfaces:** optional scanner runtimeState result; source-index state; replayTimedWorldInfo(entries,messages,options) used by runtime when timed fields exist.
- [x] Test sticky expiry/cooldown/delay, portable fields, disabled/empty, duplicate IDs, budget rejection, replay after edit/swipe/reload/branch and repeated scans; run RED.
- [x] Implement pure transitions and replay; enable timed effects in shared runtime, explain outcomes/limits; targeted/full tests GREEN; commit.

### Task 3: Search and branch archives
**Files:** src/lib/chatSearch.ts and test, src/services/chatBranch.ts and test, db.ts, chatPersistence.ts, src/screens/chat/ChatSearch.tsx, ChatMessageList/ChatConversationPane/ChatScreen.
**Interfaces:** searchChatMessages(messages,query) returns source indexes; createChatBranch(snapshot, sourceId/version/index) atomic independent record, local branch provenance.
- [x] Test current swipe/Chinese/emoji/1000 messages; branch immutability/conflicts/missing source/provenance after save; run RED.
- [x] Implement search location and explicit branch button at hit; service writes fresh ID without changing active session; browser verifies original remains and new branch restores; GREEN; commit.
- [ ] Full unit/build and Edge/Chrome browser/layout/preview/new long-chat regressions; docs/progress; fresh independent review; fix important findings; merge main, retest, push.
