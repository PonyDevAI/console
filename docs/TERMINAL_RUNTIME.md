# Terminal Runtime

CloudCode's terminal runtime is part of the execution plane. It provides persistent terminal sessions for project work, future AI-controlled execution, and later remote-host expansion without coupling session lifetime to the Web UI.

## 1. Goals

- Support multiple terminal sessions on the CloudCode host.
- Preserve terminal sessions across page refresh, browser disconnect, and later reconnect.
- Bind terminal sessions to projects and, when needed, to employees.
- Provide a stable control surface for future AI execution against terminal sessions.
- Extend the same model to SSH-backed remote hosts later.

## 2. Non-goals

- Distributed scheduling.
- Queue-first orchestration.
- Full remote IDE semantics similar to VSCode Remote SSH.
- Automatic privileged command execution without approval policy.

## 3. Core model

### 3.1 Project

Represents a repository or working directory.

Suggested fields:

- `id`
- `name`
- `workspace_path`
- `default_target_id`
- `default_shell`

### 3.2 ExecutionTarget

Represents where a terminal session actually runs.

Suggested fields:

- `id`
- `type`: `local_host` | `ssh_host`
- `display_name`
- `host`
- `port`
- `auth_ref`

### 3.3 TerminalSession

Represents a persistent terminal resource.

Suggested fields:

- `id`
- `project_id`
- `employee_id`
- `target_id`
- `backend`: `tmux` | `pty`
- `backend_session_name`
- `cwd`
- `shell`
- `status`: `running` | `detached` | `exited` | `failed` | `terminating`
- `created_at`
- `updated_at`
- `last_attached_at`

### 3.4 EmployeeRun

Represents one employee task execution bound to a project terminal.

Suggested fields:

- `id`
- `employee_id`
- `project_id`
- `terminal_session_id`
- `status`
- `started_at`
- `finished_at`

## 4. Session lifecycle

Terminal session lifecycle must be independent from browser lifecycle.

- `create`: create a persistent session resource.
- `attach`: connect a browser client to an existing session.
- `detach`: disconnect a browser client without killing the session.
- `terminate`: explicitly close a session and its backend process.
- `exit`: session backend exits on its own and is recorded as exited.

Required semantic rules:

- WebSocket disconnect does not terminate a session.
- Browser refresh does not terminate a session.
- Page unload does not terminate a session.
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

Initial backends:

- `LocalTmuxTerminalBackend`
- `LocalPtyTerminalBackend` as a fallback only

Planned backends:

- `SshTmuxTerminalBackend`

## 6. Backend policy

### 6.1 Preferred mode

Use `tmux` as the preferred backend for persistent sessions:

- supports detach/reattach
- survives browser disconnect
- can survive daemon restart
- maps well to project-bound and employee-bound work

### 6.2 Fallback mode

If `tmux` is unavailable on the host:

- allow `pty` fallback
- mark capability as non-persistent or degraded
- do not present the same guarantees as `tmux`

UI and API should clearly expose whether a session is fully persistent or degraded.

## 7. Local-host phase

For the initial phase, CloudCode runs on a server and manages terminal sessions on that same host.

Standard behavior:

- one CloudCode terminal session maps to one local backend session
- local shell defaults to the host shell
- project terminal sessions may be pre-created per project
- employee runs may reuse or allocate employee-scoped sessions per project

Recommended default mode:

- project mode: `employee_scoped`

This means each employee working on a project gets a dedicated persistent terminal session for that project.

## 8. SSH remote-host phase

Remote terminal support should reuse the same `TerminalSession` model and differ only by target/backend adapter.

Standard behavior:

- CloudCode connects to a remote host through SSH
- the remote host owns the actual terminal backend
- persistent mode uses `tmux` on the remote host
- CloudCode stores only metadata and control bindings locally

Do not create a separate terminal domain model for remote sessions.

## 9. AI control model

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

## 10. Project and employee binding

CloudCode should support project-bound and employee-bound terminal semantics.

Recommended model:

- one project can own multiple terminal sessions
- one employee can have a default session per project
- each employee run binds to exactly one terminal session

This supports:

- persistent project context
- employee-specific execution traces
- UI inspection of active employee work by opening the bound terminal session

## 11. Storage model

Terminal metadata belongs under `~/.console/` and not inside repositories.

Suggested layout:

```text
~/.console/
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
  "project_id": "proj_alpha",
  "employee_id": "emp_research",
  "target_id": "console-local",
  "backend": "tmux",
  "backend_session_name": "console-proj-alpha-emp-research",
  "cwd": "/srv/workspaces/proj-alpha",
  "shell": "/bin/zsh",
  "status": "running",
  "created_at": "2026-04-12T10:00:00Z",
  "updated_at": "2026-04-12T10:30:00Z",
  "last_attached_at": "2026-04-12T10:30:00Z"
}
```

## 12. API shape

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

Recommended binding APIs:

- `GET /api/projects/:id/terminal-sessions`
- `POST /api/employees/:id/runs`
- `GET /api/employees/:id/runs/:run_id`

## 13. Permission policy

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

## 14. Delivery phases

### Phase 1: Local persistent terminals

- multiple sessions on the CloudCode host
- persistent session model
- attach/detach semantics
- project binding
- `tmux` preferred backend

### Phase 2: AI-controlled local terminals

- employee runs bind to terminal sessions
- AI uses terminal control service
- execution output is observable from the same session

### Phase 3: Remote persistent terminals

- SSH-backed execution targets
- remote `tmux` backend
- same session model and UI semantics

## 15. Implementation notes for current codebase

Current code should evolve away from transient terminal semantics:

- do not close sessions automatically on browser disconnect
- do not bind session lifetime to page unload
- persist terminal metadata in local state
- separate session lifecycle from WebSocket attachment
- add backend abstraction before introducing remote targets and AI control

## 16. Current implementation status (Phase 1 - Backend Adapter)

Phase 1 has been refactored to "Terminal Runtime + Backend Adapter" structure:

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
    screen.rs      - ScreenBackend stub (not implemented)
    zellij.rs      - ZellijBackend stub (not implemented)
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
- **screen/zellij**: Stub implementations, return "not implemented" error

### Auto-selection Logic

Priority: tmux > zellij > screen > pty

When creating session with `backend: "auto"`:
1. Try tmux first (if available)
2. Fall back to pty if tmux unavailable
3. When user specifies explicit backend, error if unavailable

### API endpoints

- `GET /api/terminal/backends`: List available backends and default
- `GET /api/terminal/sessions`: List all sessions
- `POST /api/terminal/sessions`: Create session (optional backend param)
- `GET /api/terminal/sessions/:id`: Get session metadata
- `GET /api/terminal/sessions/:id/ws`: WebSocket attach
- `POST /api/terminal/sessions/:id/terminate`: Terminate session

### Frontend (React)

- `dashboard/src/pages/TerminalPage.tsx`: Card + Tab multi-session UI
  - Left sidebar: session cards list
  - Top tabs bar: open terminal tabs
  - Main area: active terminal view
  - Close tab vs terminate session distinction
- `dashboard/src/components/terminal/TerminalView.tsx`: xterm.js terminal view
- Backend selection: auto + pty buttons in sidebar
- Ephemeral session warning banner

### Persistence Model

- **persistent** (tmux): Session metadata saved to `~/.console/state/terminal_sessions.json`
- **ephemeral** (pty): Not persisted across daemon restart

### Known limitations

- screen/zellij are stubs only
- No SSH remote targets yet (Phase 3)
- No AI control integration yet (Phase 2)
- No project/employee binding UI yet
- Pty sessions cannot be synced (no persistent backend state)
