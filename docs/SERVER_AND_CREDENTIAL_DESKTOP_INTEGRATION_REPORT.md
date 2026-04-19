# Server And Credential Desktop Integration Report

Generated: 2026-04-19

## Executive Summary

The desktop UI has been wired to real Tauri commands for credential management, server management, and basic group management. Mock data has been removed from the credentials and servers surfaces. OS sync commands are exposed truthfully, but end-to-end SSH probing is still deferred, so the UI currently presents that capability as pending rather than pretending it works.

---

## Commands Added (20 total)

### Credential Commands (7)
| Command | Tauri Handler | Purpose |
|---------|--------------|---------|
| `list_credentials` | `list_credentials` | List all credentials, optional kind filter |
| `create_password_credential` | `create_password_credential` | Create a password credential |
| `import_private_key` | `import_private_key` | Import an existing private key |
| `generate_private_key` | `generate_private_key` | Generate ed25519 or RSA 4096 key |
| `change_private_key_passphrase` | `change_private_key_passphrase` | Change passphrase on existing key |
| `validate_credential_cmd` | `validate_credential_cmd` | Validate stored secret material and refresh `last_validated_at` |
| `delete_credential_cmd` | `delete_credential_cmd` | Delete credential (blocked if bound) |

### Server Commands (6)
| Command | Tauri Handler | Purpose |
|---------|--------------|---------|
| `list_servers` | `list_servers` | List servers, optional group filter |
| `get_server_cmd` | `get_server_cmd` | Get single server by ID |
| `create_server_cmd` | `create_server_cmd` | Create a new server record |
| `update_server_cmd` | `update_server_cmd` | Update server fields (patch) |
| `delete_server_cmd` | `delete_server_cmd` | Delete a server record |
| `duplicate_server_cmd` | `duplicate_server_cmd` | Duplicate server (keeps credential ref) |

### Group Commands (5)
| Command | Tauri Handler | Purpose |
|---------|--------------|---------|
| `list_groups_cmd` | `list_groups_cmd` | List all groups |
| `create_group_cmd` | `create_group_cmd` | Create a new group |
| `rename_group_cmd` | `rename_group_cmd` | Rename an existing group |
| `move_server_to_group_cmd` | `move_server_to_group_cmd` | Move server to group (or ungroup) |
| `delete_group_cmd` | `delete_group_cmd` | Delete group with rehome strategy |

### OS Sync Commands (2)
| Command | Tauri Handler | Purpose |
|---------|--------------|---------|
| `sync_server_os_cmd` | `sync_server_os_cmd` | Sync OS for single server (probe-driven) |
| `sync_all_server_os_cmd` | `sync_all_server_os_cmd` | Sync OS for all servers (batch) |

---

## Desktop Pages Now Using Real Data

| Page | Before | After |
|------|--------|-------|
| `CredentialsPage.tsx` | Mock credentials array | `listCredentials()` Tauri command |
| `ServersPage.tsx` | Mock servers + groups arrays | `listServers()` + `listGroups()` Tauri commands |
| `CredentialList.tsx` | Mock data + MockCredential type | Accepts `CredentialDto[]` from real backend |
| `ServerList.tsx` | Mock data + MockServer type | Accepts `ServerDto[]` + `GroupDto[]` from real backend |
| `CredentialPicker.tsx` | Mock credentials | `listCredentials(kind)` Tauri command |
| `PrivateKeyImportForm.tsx` | Mock submit callback | Calls `importPrivateKey()` Tauri command |
| `PrivateKeyGenerateForm.tsx` | Mock submit callback | Calls `generatePrivateKey()` Tauri command |
| `PasswordCredentialForm.tsx` | Mock submit callback | Calls `createPasswordCredential()` Tauri command |
| `ServerForm.tsx` | Mock submit callback | Calls `createServer()` / `updateServer()` Tauri commands |
| `GroupList.tsx` | Mock group names | Accepts `GroupDto[]` + computes counts from real servers |
| `ServersPage.tsx` group actions | No real behavior | Create / rename / delete group actions call real Tauri commands |
| `SyncOsButton.tsx` | Mock sync with timeout | Shows runtime-pending state until SSH probe execution exists |
| `CredentialDetailPanel.tsx` | MockCredential type | Accepts `CredentialDto` with real metadata fields |

---

## Desktop-Side Typed Wrappers

All Tauri commands are wrapped in `apps/desktop/src/lib/server-commands.ts` with:
- TypeScript interfaces for all DTOs (`CredentialDto`, `ServerDto`, `GroupDto`, `SyncSummary`)
- Typed input/output for all 19 commands
- Explicit snake_case ↔ camelCase mapping between frontend and backend where Tauri argument deserialization requires it

---

## Remaining Runtime Limitations

### OS Detection
The OS sync commands (`sync_server_os_cmd`, `sync_all_server_os_cmd`) are wired and functional, but they require `probe_output` as input. The actual SSH execution to probe remote servers is **not yet implemented**. Current behavior:

- `sync_server_os_cmd`: Accepts probe output string and updates server OS fields correctly
- `sync_all_server_os_cmd`: Accepts a HashMap of server_id → probe_output and updates all servers

**Limitation**: The desktop UI does not trigger `syncAllServerOs()` yet because it has no SSH probe runtime. The UI now presents this capability as pending. To make OS sync work end-to-end, an SSH runtime layer needs to be added that:
1. Connects to each server using its bound credential
2. Runs `uname -s`, `/etc/os-release`, etc.
3. Passes the output to the existing `sync_server_os` service

This is intentional — the OS detection service was designed to be probe-output-driven, not to contain SSH logic itself. The SSH runtime is a separate concern that should be added as a future enhancement.

### Secure Storage
The `SecureStore` trait supports both `KeychainStore` (platform keychain) and `EncryptedFileStore` (AES-256-GCM fallback). At runtime:
- macOS: Keychain is available and preferred
- Linux/Windows: Falls back to encrypted file store

The encrypted file store uses a shared fallback master key file rather than per-credential adjacent key files. Hardening that master key by wrapping it with the platform keychain is still deferred.

### No SSH Connection Runtime
The desktop app does not yet have a Tauri plugin or command for actual SSH connections. This means:
- Server "create" and "edit" work fully (metadata only)
- OS sync requires external probe output
- No terminal/file browser functionality yet

---

## Security Boundaries Preserved

| Boundary | Status |
|----------|--------|
| No raw password in server JSON | ✅ Server DTO contains only `credential_id` reference |
| No raw private key in server JSON | ✅ Server DTO contains only `credential_id` reference |
| No passphrase in logs | ✅ Service layer never logs secret material |
| No private key material in UI state | ✅ Credential DTO shows only metadata (fingerprint, algorithm, name) |
| No secret values in frontend | ✅ PasswordCredentialForm sends secret directly to Tauri command; never stored in React state beyond form input |
| Delete blocked for bound credentials | ✅ `delete_credential_cmd` checks server bindings before deletion |
| Auth method ↔ credential kind match | ✅ Enforced at Tauri command layer and service layer |
| Generated RSA always 4096 | ✅ Enforced in `generate_private_key` service |
| Imported RSA 2048 marked legacy | ✅ Enforced in `classify_rsa_strength` |
| OS detection doesn't overwrite secrets | ✅ `sync_server_os` only touches OS fields |
| Secret fields masked in UI | ✅ Password inputs use `type="password"` with show/hide toggle |

---

## Test/Build/Typecheck Results

| Check | Result |
|-------|--------|
| `cargo check` (root) | ✅ Passed |
| `cargo test` | ✅ 127 passed, 0 failed |
| `pnpm exec tsc --noEmit` (desktop) | ✅ 0 errors |
| `pnpm build` (desktop) | ✅ Passed |

---

## Files Changed

### Rust (Tauri command layer)
- `apps/desktop/src-tauri/src/main.rs` — 19 Tauri commands + AppState + DTOs
- `src/services/server_os_sync/sync.rs` — Added `Serialize` derive to `SyncSummary`
- `src/storage/credentials/secure_store.rs` — Added `Send + Sync` bound to `SecureStore` trait

### TypeScript (Desktop UI)
- `apps/desktop/src/lib/server-commands.ts` — New: typed Tauri command wrappers
- `apps/desktop/src/pages/CredentialsPage.tsx` — Rewired to real Tauri commands
- `apps/desktop/src/pages/ServersPage.tsx` — Rewired to real Tauri commands
- `apps/desktop/src/features/credentials/CredentialList.tsx` — Accepts real `CredentialDto[]`
- `apps/desktop/src/features/credentials/CredentialDetailPanel.tsx` — Accepts real `CredentialDto`
- `apps/desktop/src/features/credentials/CredentialPicker.tsx` — Fetches from `listCredentials()`
- `apps/desktop/src/features/credentials/PrivateKeyImportForm.tsx` — Calls `importPrivateKey()`
- `apps/desktop/src/features/credentials/PrivateKeyGenerateForm.tsx` — Calls `generatePrivateKey()`
- `apps/desktop/src/features/credentials/PasswordCredentialForm.tsx` — Calls `createPasswordCredential()`
- `apps/desktop/src/features/servers/ServerList.tsx` — Accepts real `ServerDto[]` + `GroupDto[]`
- `apps/desktop/src/features/servers/ServerForm.tsx` — Typed output for create/update and real group IDs
- `apps/desktop/src/features/servers/GroupList.tsx` — Accepts real `GroupDto[]` + computes counts
- `apps/desktop/src/features/server-os-sync/SyncOsButton.tsx` — Accepts external syncing state and explicit pending/disabled mode

---

## Validation Status

- **implemented** — All 19 Tauri commands wired; credentials, servers, and basic group actions use real data
- **validated_static** — `cargo check` passed, `tsc --noEmit` passed
- **validated_local** — `cargo test` 127/127 pass, `pnpm build` passed
- **validated_host_cli** — N/A (no host CLI interaction required for this integration)

---

## Layout Refactoring (Desktop-Native Interaction Model)

The desktop UI has been refactored from a web-admin-page layout into a desktop remote-connection manager pattern inspired by Termius, Royal TSX, and Remote Desktop Manager.

### What changed

| Before | After |
|--------|-------|
| Servers: 3-column (groups \| server list/form \| detail) — form replaces middle column | Servers: group nav \| server list with toolbar \| inspector — create/edit in modal sheet |
| Credentials: 2-column (list + inline forms \| detail) — forms replace list | Credentials: list \| inspector — "New" button opens modal with 3 options |
| OS sync button in group sidebar footer | OS sync moved to server list toolbar (disabled, truthfully labeled as pending) |
| Group filter chips embedded in server list | Group navigation is a dedicated left sidebar with hover-reveal rename/delete actions |
| Multiple action icons in credential toolbar | Single "New" button opens a choice modal (Import Key / Generate Key / Create Password) |
| Server create/edit as permanent middle-column state | Server create/edit in a centered modal sheet with backdrop |

### Why this is more desktop-native

1. **Persistent list + inspector pattern**: The server list and credential list are always visible. Selecting an object updates the right-side inspector without replacing the list. This matches how Termius and Royal TSX work — you browse objects on the left, inspect on the right.

2. **Modal forms instead of column replacement**: Create/edit actions open a modal sheet overlay rather than replacing the list column. This keeps the object list context visible and follows desktop conventions where forms are transient overlays, not permanent layout states.

3. **Group navigation as object management**: Groups are a managed list with hover-reveal rename/delete actions, not a filter strip. The "All" entry is always present. This mirrors how Royal TSX handles folder/object navigation.

4. **Truthful capability display**: The OS sync button is visibly disabled with a tooltip explaining that SSH probe runtime is not yet available. The UI does not pretend the feature works.

5. **Single "New" action surface**: Instead of stacking three action icons in the credential toolbar, a single "New" button opens a modal with three clearly labeled options. This reduces toolbar clutter and follows desktop app patterns where "New" is a single entry point to a choice dialog.

### Files changed in this refactoring

- `apps/desktop/src/pages/ServersPage.tsx` — New 3-panel layout with modal form
- `apps/desktop/src/pages/CredentialsPage.tsx` — New 2-panel layout with NewCredentialModal
- `apps/desktop/src/features/servers/ServerList.tsx` — Simplified (removed group filter chips, search-only)
- `apps/desktop/src/features/servers/ServerForm.tsx` — Removed Card wrapper (used inside modal)
- `apps/desktop/src/features/servers/GroupList.tsx` — Added hover-reveal rename/delete actions
- `apps/desktop/src/features/credentials/NewCredentialModal.tsx` — New: modal with 3 creation options

---

## Inspector UX Improvements (Operational Panels)

Both the credential and server inspectors have been transformed from read-only detail views into actionable operational panels.

### Credential inspector now includes

| Feature | Status |
|---------|--------|
| Change Passphrase modal | ✅ Wired to real `change_private_key_passphrase` Tauri command |
| Recheck / Validate | ✅ Wired to real `validate_credential_cmd` and refreshes validation metadata |
| Delete | ✅ Wired to real `deleteCredential` with confirmation |
| Bound Servers section | ✅ Computed from real server list — shows which servers reference this credential |
| Storage mode display | ✅ Shows "Platform Keychain" or "Encrypted File" |

### Server inspector now includes

| Feature | Status |
|---------|--------|
| Test Connection | ⏳ Button present but disabled (SSH runtime not yet available) |
| Sync OS | ⏳ Button present but disabled (SSH probe runtime not yet available) |
| Move to Group dropdown | ✅ Wired to real `moveServerToGroup` Tauri command |
| Edit | ✅ Opens server form modal |
| Duplicate | ✅ Wired to real `duplicateServer` Tauri command |
| Delete | ✅ Wired to real `deleteServer` with confirmation |
| Pending runtime notice | ✅ Explanatory copy in OS Detection section when SSH probe unavailable |

### Group actions improved

| Before | After |
|--------|-------|
| Hover-only micro-icons for rename/delete | Persistent action bar appears below group list when a group is selected, showing Rename and Delete buttons with labels |
| Actions hidden until hover | Actions always visible for the active group |

### Why the inspector UX is stronger now

1. **Explicit action surfaces**: Actions are labeled buttons in a horizontal bar, not hidden behind icons or hover states. Users can immediately see what operations are available on the selected object.

2. **Truthful disabled states**: Test Connection and Sync OS are visibly disabled with tooltips explaining *why* — the SSH runtime is not yet available. The UI doesn't pretend these features work.

3. **Bound Servers context**: The credential inspector shows which servers actually use each credential. This is critical operational information — you can't understand a credential's impact without knowing what depends on it.

4. **Inline group management**: The active group action bar makes rename/delete discoverable without requiring users to hover over tiny icons. It follows the desktop pattern where the selected object's actions are always visible.

5. **Sectioned operational layout**: The server inspector is organized into Connection, OS Detection, and Metadata sections — each with clear labels and values. The OS Detection section includes an explanatory callout when the SSH probe runtime is unavailable.

### Files changed in this inspector pass

- `apps/desktop/src/pages/CredentialsPage.tsx` — Loads servers for bound-server lookup, passes action handlers
- `apps/desktop/src/pages/ServersPage.tsx` — New ServerInspector component with action bar, Move to Group dropdown, pending runtime notices
- `apps/desktop/src/features/credentials/CredentialDetailPanel.tsx` — Rewritten as operational panel with actions, bound servers, passphrase change modal
- `apps/desktop/src/features/servers/GroupList.tsx` — Added persistent action bar for active group
