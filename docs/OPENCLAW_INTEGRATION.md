# OpenClaw Integration

## Overview

Console integrates with OpenClaw through a WebSocket-based gateway connection. The integration follows a backend-adapter pattern where Console backend connects to OpenClaw Gateway on behalf of the frontend.

## Architecture

```
Frontend
  -> Console HTTP API
      -> OpenClaw Adapter (backend)
          -> OpenClaw Gateway (WS)
```

**Key Principles:**
- Frontend does NOT connect directly to OpenClaw
- Token/credentials are stored only in Console backend
- OpenClaw source data is adapted to Console's unified data model

## Why WebSocket?

OpenClaw's primary data plane is WebSocket-based, not HTTP. While a `/health` endpoint exists via HTTP for basic liveness checks, the main functionality (listing agents, models, etc.) requires:

1. Establishing a WebSocket connection
2. Handling a `connect.challenge` challenge/response
3. Sending `connect` with authentication
4. Using RPC calls over the established connection

## Authentication

When connecting to OpenClaw Gateway, the following headers are required:

- `Authorization: Bearer <token>` - Gateway token from OpenClaw configuration
- `Origin: <origin>` - Must match the gateway's allowed origins

## Connection Flow

1. **Connect to WebSocket**: `ws://<endpoint>/`
2. **Receive challenge**: Wait for `connect.challenge` event
3. **Send connect**: Send `connect` request with auth token and client info
4. **Wait for acknowledgment**: Receive `res` with `ok: true`
5. **Execute RPC**: Send RPC requests like `agents.list`, `models.list`

## Supported Capabilities

### This Version (v1)
- ✅ **Test Source**: Verify OpenClaw gateway connectivity and retrieve version/default agent
- ✅ **List Agents**: Fetch available agents from OpenClaw gateway
- ✅ **List Models**: Fetch available models from OpenClaw gateway

### Not Yet Supported
- ❌ **Execute operations**: `chat.send`, `agent.wait`, `sessions.patch`
- ❌ **Long connections**: Connection pooling, auto-reconnect, background subscriptions
- ❌ **Tool catalog**: Full tools.catalog UI integration

## Data Flow

### Adding an OpenClaw Source

1. User provides in Console UI:
   - **Endpoint**: e.g., `http://100.69.109.88:11744`
   - **Token**: Gateway authentication token
   - **Origin**: e.g., `http://100.69.109.88:11744`

2. Console stores these in `~/.console/agent_sources.json`

### Testing a Source

```bash
POST /api/agent-sources/:id/test
# Returns: { ok, type: "remote_openclaw_ws", version, default_agent_id, latency_ms, error }
```

### Listing Agents

```bash
GET /api/agent-sources/:id/agents
# Returns: { agents: [{ id, source_id, name, display_name, status }] }
```

### Listing Models

```bash
GET /api/agent-sources/:id/openclaw-models
# Returns: { models: [{ id, name, provider, context_window }] }
```

## Limitations

1. **Short-lived connections**: Each API call creates a new WebSocket connection, handshake, executes RPC, then closes
2. **No persistent connection pool**: No background refresh or reconnection
3. **Version detection**: OpenClaw gateway doesn't expose version via HTTP `/health`; WebSocket `connect` response may contain `updateAvailable`

## OpenClaw Gateway Probe Endpoints

OpenClaw provides these HTTP endpoints (at gateway root, not under basePath):

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Returns `{"ok":true,"status":"live"}` - basic liveness |
| `GET /healthz` | Same as `/health` |
| `GET /ready` | Returns `{"ok":true,"status":"ready"}` - readiness |
| `GET /readyz` | Same as `/ready` |

Note: These are HTTP endpoints. The main OpenClaw API (agents, models, chat) requires WebSocket connection.
