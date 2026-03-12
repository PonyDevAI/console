# Implementation Assumptions and Ambiguities

This file records assumptions made for early implementation and questions that should be confirmed before deeper build-out.

## Assumptions
- A single local Console daemon process is sufficient for initial run/session coordination.
- Worker CLIs are installed and available on PATH for the local user running Console.
- File-based state in `~/.console/` is acceptable for initial reliability and recovery expectations.
- Initial run streaming is primarily server-to-browser output delivery (SSE).

## Ambiguities to review
1. **Adapter contract shape**
   - Exact normalized event schema (log/event/status/artifact) has not yet been finalized.
2. **Run lifecycle semantics**
   - Final states and transitions (cancelled vs interrupted vs failed) need explicit definition.
3. **Workspace/repo ownership model**
   - How strictly Console validates moved/deleted repositories should be specified.
4. **Credential handling boundaries**
   - Which secrets are stored by Console versus delegated to worker CLIs needs a clear policy.
5. **Concurrency limits**
   - Per-workspace or global run concurrency defaults are not yet specified.
