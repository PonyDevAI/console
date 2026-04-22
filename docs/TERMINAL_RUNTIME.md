# Terminal Runtime

CloudCode's terminal runtime is part of the execution plane. It provides desktop terminal workspaces whose session lifetime is independent from the Web UI or desktop tab lifecycle, and it must support both local-machine and remote-server terminals behind one unified session model.

## 1. Goals

- Support multiple terminal sessions for both the local machine and remote servers.
- Preserve terminal sessions across page refresh, browser disconnect, and later reconnect.
- Preserve persistent sessions when the backend supports reattach semantics.
- Provide a stable control surface for future AI execution against terminal sessions.
- Reuse the same target/session model for `Local` and `Server` terminals in the desktop UI.

## 2. Non-goals

- Distributed scheduling.
- Queue-first orchestration.
- Full remote IDE semantics similar to VSCode Remote SSH.
- Automatic privileged command execution without approval policy.

## 3. Core model

### 3.1 ExecutionTarget

Represents where a terminal session actually runs.

Suggested fields:

- `id`
- `type`: `local` | `server`
- `display_name`
- `server_id` (`null` for `local`)
- `host` (`null` for `local`)
- `port` (`null` for `local`)
- `credential_ref` (`null` for `local`)
- `default_cwd`
- `default_shell`
- `backend_preference`: `auto` | `tmux` | `screen` | `pty`

Rules:

- `Local` is a built-in execution target for the current CloudCode host. It is not modeled as a saved server record.
- `Server` targets reference existing server-management objects.
- Both local and remote targets use the same session model and backend priority rules.

### 3.2 TerminalWorkspaceTab

Represents one desktop tab bound to a terminal session.

Suggested fields:

- `id`
- `session_id`
- `target_id`
- `title`
- `created_at`
- `last_active_at`

This is desktop UI state. It is not the terminal runtime itself.

### 3.3 TerminalSession

Represents one terminal runtime resource.

Suggested fields:

- `id`
- `target_id`
- `backend`: `tmux` | `screen` | `pty`
- `persistence`: `persistent` | `ephemeral`
- `backend_session_name`
- `cwd`
- `shell`
- `status`: `running` | `detached` | `exited` | `failed` | `terminating`
- `created_at`
- `updated_at`
- `last_attached_at`
- `last_active_at`

Rules:

- `tmux` and `screen` sessions are `persistent`.
- `pty` sessions are `ephemeral`.
- Only `persistent` sessions participate in restore/reattach after app restart.
- `ephemeral` sessions are valid runtime sessions but are not restorable.

## 4. Session lifecycle

Terminal session lifecycle must be independent from browser lifecycle and desktop tab lifecycle.

- `create`: create a terminal session resource.
- `attach`: connect a browser client to an existing session.
- `detach`: disconnect a browser client without killing the session.
- `terminate`: explicitly close a session and its backend process.
- `exit`: session backend exits on its own and is recorded as exited.

Required semantic rules:

- WebSocket disconnect does not terminate a session.
- Browser refresh does not terminate a session.
- Page unload does not terminate a session.
- Closing a desktop tab does not necessarily terminate a persistent session.
- Reopening the desktop app should attempt to restore persistent sessions.
- Only explicit terminate or backend exit ends the session.

## 5. Backend model

Terminal runtime should use backend adapters instead of hard-coding one implementation.

Suggested backend contract:

```rust
trait TerminalBackend: Send + Sync {
    fn kind(&self) -> &str;

    fn create_session(&self, req: CreateTerminalSession) -> anyhow::Result<BackendSession>;
    fn attach(&self, session: &TerminalSession) -> anyhow::Result<AttachHandle>;
    fn send_input(&self, session: &TerminalSession, input: &str) -> anyhow::Result<()>;
    fn resize(&self, session: &TerminalSession, cols: u16, rows: u16) -> anyhow::Result<()>;
    fn capture_output(&self, session: &TerminalSession, limit: usize) -> anyhow::Result<String>;
    fn terminate(&self, session: &TerminalSession) -> anyhow::Result<()>;
    fn inspect(&self, session: &TerminalSession) -> anyhow::Result<TerminalHealth>;
}
```

Required backends:

- `LocalTmuxTerminalBackend`
- `LocalScreenTerminalBackend`
- `LocalPtyTerminalBackend`
- `SshTmuxTerminalBackend`
- `SshScreenTerminalBackend`
- `SshPtyTerminalBackend`

## 6. Backend policy

### 6.1 Preferred mode

Use the same product-facing `auto` mode for both local and remote targets, but allow
different internal resolution order where platform/runtime evidence justifies it.

Remote priority:

- `tmux`
- fallback `screen`
- fallback `pty`

Desktop-local priority:

- `tmux`
- fallback `pty`
- fallback `screen`

### 6.2 Fallback mode

If neither `tmux` nor `screen` is available on the target:

- allow `pty` fallback
- mark capability as `ephemeral`
- do not present the same guarantees as `tmux`/`screen`

UI and API should clearly expose whether a session is fully persistent or degraded.

## 7. Local and remote target policy

CloudCode must treat local and remote terminals as one product surface.

Standard behavior:

- `Local` means the current machine running CloudCode.
- `Server` means one saved server-management object.
- both target types expose one `auto` mode in the product surface
- both target types expose the same tab/session semantics in the desktop UI

Local target behavior:

- shell defaults to the host shell
- `tmux` preferred
- `pty` fallback
- `screen` last-resort compatibility backend

Desktop note:

- the desktop terminal UI creates both local and remote sessions in `auto` mode
- local desktop `auto` resolves in this order: `tmux -> pty -> screen`
- remote `auto` resolves in this order: `tmux -> screen -> pty`
- only sessions that resolve to durable backends participate in app-restart restore
- current desktop behavior does not restore local `screen` sessions; local `screen` remains compatibility-only
- sessions that resolve to `pty` remain valid runtime sessions, but are treated as temporary and are not restored after app restart

Server target behavior:

- SSH transport is responsible only for reaching the target
- the actual terminal backend runs on the remote host
- `tmux` preferred
- `screen` fallback
- `pty` last resort

Do not create a separate terminal domain model for remote sessions.

## 8. Session persistence policy

Persistence is determined by backend capability, not by whether the target is local or remote.

- `tmux` => `persistent`
- `screen` => `persistent`
- `pty` => `ephemeral`

CloudCode persists:

- terminal session metadata
- target bindings
- backend session references
- desktop tab/session restoration state

CloudCode does not persist:

- full terminal scrollback as a source of truth
- raw command output history as the primary restore mechanism
- PTY session restoration data for `ephemeral` sessions

Application restart behavior:

- restore only still-running `persistent` sessions (`tmux` / `screen`)
- do not restore `ephemeral` sessions (`pty`)

## 9. Desktop UI model

The desktop terminal page should use:

- a dedicated primary nav item: `Terminal`
- a tab strip in the page header
- a target selector with default `Local`
- one terminal canvas per active tab

Tab rules:

- adding a tab creates a new terminal session shell for the currently selected target
- each tab binds to exactly one target/session pair
- in the current desktop UI, closing a tab terminates that session
- desktop tab close currently does not expose a detached-session restore flow
- switching tabs does not create a new session; it only changes which session is visible
- product-facing UI should present backend selection as `auto`; resolved backend is runtime detail

## 10. AI control model

AI should not operate against browser WebSocket state directly. AI must use a terminal control service.

Suggested service operations:

- `create_session`
- `list_sessions`
- `get_session`
- `send_input`
- `send_command`
- `capture_output`
- `resize`
- `interrupt`
- `terminate`

Standard AI loop:

1. User issues a task.
2. System selects or creates a terminal session.
3. AI plans the next command(s).
4. System applies approval policy if needed.
5. AI executes through terminal control service.
6. System captures output and updates run state.
7. User may open the bound terminal session to observe execution.

## 11. Performance model

High-performance terminal behavior depends on runtime design, not on React state tricks.

Required principles:

- use a real terminal renderer such as `xterm.js`
- keep terminal output out of React state
- stream incremental output chunks instead of repainting full buffers
- keep resize as a dedicated runtime event
- reuse backend sessions across tab switches
- keep persistent session state in backend/session metadata, not in UI memory

## 12. Storage model

Terminal metadata belongs under `~/.cloudcode/` and not inside repositories.

Suggested layout:

```text
~/.cloudcode/
  state/
    terminal_sessions.json
    execution_targets.json
  terminals/
    <session_id>/
      meta.json
      events.log
```

`meta.json` example:

```json
{
  "id": "term_proj_alpha_emp_research",
  "target_id": "console-local",
  "backend": "tmux",
  "persistence": "persistent",
  "backend_session_name": "console-proj-alpha-emp-research",
  "cwd": "/srv/workspaces/proj-alpha",
  "shell": "/bin/zsh",
  "status": "running",
  "created_at": "2026-04-12T10:00:00Z",
  "updated_at": "2026-04-12T10:30:00Z",
  "last_attached_at": "2026-04-12T10:30:00Z"
}
```

## 13. API shape

Recommended terminal APIs:

- `GET /api/terminal/sessions`
- `POST /api/terminal/sessions`
- `GET /api/terminal/sessions/:id`
- `GET /api/terminal/sessions/:id/ws`
- `POST /api/terminal/sessions/:id/input`
- `POST /api/terminal/sessions/:id/command`
- `GET /api/terminal/sessions/:id/output`
- `POST /api/terminal/sessions/:id/resize`
- `POST /api/terminal/sessions/:id/terminate`

Recommended target-aware APIs:

- `GET /api/terminal/targets`
- `POST /api/terminal/sessions`
  - input should allow `target_id` and optional `backend`
- `GET /api/terminal/sessions/:id`
  - output must include `target_id`, `backend`, `persistence`, `status`

## 14. Permission policy

Terminal execution policy must distinguish between observation and action.

Suggested levels:

- `read_only`
- `interactive_user`
- `agent_supervised`
- `agent_privileged`

Minimum requirements:

- destructive or privileged commands require approval policy
- AI-issued commands must be auditable
- terminal session ownership and target host must be visible in UI
- remote SSH credentials must be resolved through managed `Credential` objects, not plain UI fields

## 15. Delivery phases

### Phase 1: Desktop terminal shell

- desktop `Terminal` page
- tab strip
- target selector with default `Local`
- session metadata model
- persistent vs ephemeral semantics visible in UI

### Phase 2: Local runtime

- local target runtime
- backend priority `tmux -> screen -> pty`
- attach/detach semantics
- restore persistent local sessions

### Phase 3: Remote runtime

- SSH-backed server targets
- remote backend priority `tmux -> screen -> pty`
- restore persistent remote sessions

### Phase 4: Higher-level execution

- AI-controlled terminal flows
- project/employee/workflow binding if still needed
- richer session recovery and observability

## 16. Implementation notes for current codebase

Current code should evolve away from transient terminal semantics:

- do not close sessions automatically on browser disconnect
- do not bind session lifetime to page unload
- persist terminal metadata in local state
- separate session lifecycle from WebSocket attachment
- extend existing backend abstraction instead of replacing it
- add target binding before adding more UI terminal affordances

## 17. Current implementation status

Current code already has a usable backend adapter skeleton and persistent-session metadata model, but it still reflects an older local-first assumption.

### Backend Directory Structure

```
src/services/terminal/
  mod.rs           - Module exports
  models.rs        - Data models (BackendKind, Persistence, TerminalSessionMeta, etc.)
  backend.rs       - TerminalBackend trait definition
  registry.rs      - BackendRegistry (auto-selection, availability checks)
  service.rs       - TerminalService (session management, persistence)
  backends/
    mod.rs         - Backend exports
    tmux.rs        - TmuxBackend implementation
    pty.rs         - PtyBackend implementation
    screen.rs      - ScreenBackend implementation
    zellij.rs      - Optional backend, not part of the core product contract
```

### TerminalBackend Trait

Each backend implements:
- `kind()`: BackendKind (Tmux, Zellij, Screen, Pty)
- `persistence()`: Persistence (Persistent, Ephemeral)
- `is_available()`: bool - check if backend is available
- `create_session(...)`: Create a new session
- `terminate_session(...)`: Terminate a session
- `resize_session(...)`: Resize session
- `sync_status(...)`: Sync session status from backend
- `spawn_attach_bridge(...)`: Spawn PTY attach bridge

### Backend Behavior

- **tmux**: Persistent sessions, survives daemon restart
  - attach bridge checks session existence before spawning
  - clear error message if tmux session doesn't exist
  - status synced via `tmux has-session`
- **pty**: Ephemeral sessions, single-attach, disconnect ends session
  - status: `pending` → `running` (on successful attach) → removed (on disconnect)
  - attach failure: immediate cleanup, no orphan session
  - duplicate attach: explicit error "already has an active connection"
- **screen**: persistent fallback backend
- **pty**: ephemeral fallback backend
- **zellij**: optional extra backend, not part of the core product contract

### Auto-selection Logic

Priority should converge on the product contract:

1. Try `tmux`
2. Fall back to `screen`
3. Fall back to `pty`

### API endpoints

- `GET /api/terminal/backends`: List available backends and default
- `GET /api/terminal/sessions`: List all sessions
- `POST /api/terminal/sessions`: Create session (optional backend param)
- `GET /api/terminal/sessions/:id`: Get session metadata
- `GET /api/terminal/sessions/:id/ws`: WebSocket attach
- `POST /api/terminal/sessions/:id/terminate`: Terminate session

### Frontend (React)

- `apps/desktop/src/pages/TerminalPage.tsx`: desktop terminal shell with tabs and target selector
- terminal runtime integration is still pending
- desktop UI should become the canonical terminal surface

### Persistence Model

- **persistent** (tmux/screen): Session metadata saved to `~/.cloudcode/state/terminal_sessions.json`
- **ephemeral** (pty): Not persisted across daemon restart

### Known limitations

- No SSH-backed target binding yet
- Desktop terminal shell is not yet attached to real runtime
- No AI control integration yet
- PTY sessions remain intentionally non-restorable
