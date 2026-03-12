# Web UI (Initial Layout)

The initial UI is a practical local console for interactive runs and run visibility.

## Primary layout

Three-panel structure:

1. **Left navigation panel**
   - Workspace selector.
   - Repository selector.
   - Worker selector.
   - Session/run list (initially simple).

2. **Center panel (chat/work area)**
   - Prompt input area.
   - Conversation/request timeline.
   - Run submission controls.

3. **Right panel (output/details)**
   - Streaming execution output.
   - Run status and timestamps.
   - Basic artifact/detail references.

## UX priorities for early phases

- Fast local responsiveness.
- Clear indication of selected workspace/repo/worker.
- Reliable streaming output visibility.
- Simple run lifecycle understanding (starting, running, completed, failed).

## Data flow (initial)

- UI submits run request to local backend.
- Backend routes request through selected worker adapter.
- Worker output is streamed to UI via SSE.
- UI renders incremental output and terminal status.

## Initial constraints

- Keep UI lightweight and avoid over-abstracted state management.
- Focus on clarity over feature density.
- Avoid implying enterprise orchestration features in Phase 1.

## Future UI evolution

As orchestration features mature, likely additions include:
- Board-style run queue and status views.
- Approval and intervention controls.
- Artifact browsing and lineage views.
- Richer filtering/search once SQLite-backed history is available.
