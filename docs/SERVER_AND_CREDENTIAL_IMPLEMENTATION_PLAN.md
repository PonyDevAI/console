# Server And Credential Implementation Plan

This document translates [Server And Credential Architecture](SERVER_AND_CREDENTIAL_ARCHITECTURE.md) into an implementation sequence for CloudCode.

It is intentionally code-adjacent:

- which modules to add
- which files own which responsibilities
- what each PR must prove before the next one starts

It does not redefine product scope. If this plan conflicts with the architecture document, follow the architecture document.

## Scope fixed before implementation

This plan assumes the current product decisions are already locked:

- no batch server import
- no proxy support
- no jump host support
- no authentication fallback
- generated private keys support `ed25519` and `rsa 4096` only
- imported RSA keys may be `2048`, `3072`, or `4096`
- `rsa 2048` is compatibility-only and should be treated as legacy
- a saved server binds exactly one active credential
- OS icon is auto-detected after successful connection or by manual sync

## Delivery strategy

Implementation should follow six PRs in order:

1. model and schema lock-in
2. credential storage boundary
3. credential service lifecycle
4. server and group service lifecycle
5. OS detection and sync
6. desktop UI first pass

Do not collapse these into one change. The model and storage boundaries need to settle before service logic or UI wiring starts.

## PR1: Models And Schemas

Goal:
- lock field names, enum values, and JSON structure
- add structural validation only
- avoid real secret persistence and platform-specific behavior

### Files

- `src/models/credential.rs`
- `src/models/server.rs`
- `src/models/os_detection.rs`

### `src/models/credential.rs`

Owns:

- `CredentialKind`
- `CredentialStorageMode`
- `Credential`
- `PrivateKeyAlgorithm`
- `CredentialStrength`
- `PrivateKeyMeta`
- `PasswordMeta`
- `CredentialIndex`

Suggested rules:

- `Credential.kind = PrivateKey` must have one `PrivateKeyMeta`
- `Credential.kind = Password` must have one `PasswordMeta`
- `ed25519` must have `rsa_bits = None`
- `rsa` must have `rsa_bits = Some(2048 | 3072 | 4096)`

Suggested validation helpers:

- `validate_credential_index(index: &CredentialIndex) -> Result<()>`
- `validate_private_key_meta(meta: &PrivateKeyMeta) -> Result<()>`

### `src/models/server.rs`

Owns:

- `ServerAuthMethod`
- `OsType`
- `OsDetectionStatus`
- `Server`
- `ServerGroup`

Suggested rules:

- `credential_id` is always required on saved servers
- `auth_method` must match the bound `Credential.kind`
- this model must not include proxy or jump-host fields

Suggested validation helpers:

- `validate_server_shape(server: &Server) -> Result<()>`
- `validate_server_credential_binding(server: &Server, credential: &Credential) -> Result<()>`

### `src/models/os_detection.rs`

Owns:

- `OsProbeSource`
- `OsProbeResult`

This module should remain independent of server storage and credential logic.

### JSON examples fixed in this PR

Suggested on-disk shapes:

`~/.cloudcode/credentials/credentials.json`

```json
{
  "credentials": [],
  "private_keys": [],
  "passwords": []
}
```

`~/.cloudcode/servers/servers.json`

```json
{
  "servers": []
}
```

`~/.cloudcode/servers/groups.json`

```json
{
  "groups": []
}
```

### PR1 acceptance

- field and enum names are stable
- JSON schema is stable
- structural validation tests pass
- docs and code agree on naming

## PR2: Credential Storage Boundary

Goal:
- establish the split between metadata storage and secret storage
- make secure storage pluggable
- keep business logic out of storage modules

### Files

- `src/storage/credentials/mod.rs`
- `src/storage/credentials/file_store.rs`
- `src/storage/credentials/secure_store.rs`

### `src/storage/credentials/file_store.rs`

Owns:

- `credentials.json` file IO
- metadata-only persistence
- atomic write behavior

Suggested functions:

- `load_credentials_index() -> Result<CredentialIndex>`
- `save_credentials_index(index: &CredentialIndex) -> Result<()>`
- `upsert_credential_metadata(index: &mut CredentialIndex, credential: Credential) -> Result<()>`
- `remove_credential_metadata(index: &mut CredentialIndex, id: &str) -> Result<()>`

### `src/storage/credentials/secure_store.rs`

Owns:

- system secret storage abstraction
- fallback encrypted file abstraction

Suggested trait:

```rust
trait SecureStore {
    fn store_secret(&self, id: &str, bytes: &[u8]) -> Result<String>;
    fn load_secret(&self, storage_ref: &str) -> Result<Vec<u8>>;
    fn update_secret(&self, storage_ref: &str, bytes: &[u8]) -> Result<()>;
    fn delete_secret(&self, storage_ref: &str) -> Result<()>;
}
```

Suggested fallback file envelope:

```rust
pub struct EncryptedSecretEnvelope {
    pub version: u8,
    pub algorithm: String,
    pub nonce_b64: String,
    pub ciphertext_b64: String,
}
```

Fallback path:

```text
~/.cloudcode/credentials/encrypted/<credential-id>.enc
```

### PR2 acceptance

- secret plaintext never appears in `credentials.json`
- storage trait is stable and mockable
- fallback envelope is serializable
- storage modules have no product/business rules

## PR3: Credential Service Lifecycle

Goal:
- implement password and private-key credential workflows
- keep all secret-aware business rules in services, not storage

### Files

- `src/services/credentials/mod.rs`
- `src/services/credentials/import_private_key.rs`
- `src/services/credentials/generate_private_key.rs`
- `src/services/credentials/password_credential.rs`
- `src/services/credentials/change_passphrase.rs`
- `src/services/credentials/delete_credential.rs`

### Suggested input models

- `ImportPrivateKeyInput`
- `GeneratePrivateKeyInput`
- `CreatePasswordCredentialInput`
- `UpdatePasswordCredentialInput`
- `ChangePassphraseInput`

### Suggested functions

- `import_private_key(input, store, repo) -> Result<Credential>`
- `generate_private_key(input, store, repo) -> Result<Credential>`
- `create_password_credential(input, store, repo) -> Result<Credential>`
- `update_password_credential(id, input, store, repo) -> Result<()>`
- `change_private_key_passphrase(id, input, store, repo) -> Result<()>`
- `delete_credential(id, store, repo, binding_lookup) -> Result<()>`

### Service rules

- generated keys:
  - allow `ed25519`
  - allow `rsa 4096`
  - reject `rsa 2048`
- imported keys:
  - allow `rsa 2048`
  - mark `rsa 2048` as `Legacy`
- changing passphrase:
  - must not change `credentialId`
  - must not change key fingerprint
- delete:
  - must fail if any server still binds the credential

### PR3 acceptance

- generated `rsa 2048` is rejected
- imported `rsa 2048` is accepted and marked legacy
- passphrase changes preserve identity metadata
- delete protection is enforced
- errors and logs do not leak secret values

## PR4: Server And Group Lifecycle

Goal:
- implement saved server behavior around one active credential
- implement group ownership and group deletion strategy

### Files

- `src/storage/servers/mod.rs`
- `src/storage/servers/file_store.rs`
- `src/services/servers/mod.rs`
- `src/services/servers/create_server.rs`
- `src/services/servers/update_server.rs`
- `src/services/servers/validate_server.rs`
- `src/services/servers/groups.rs`
- `src/services/servers/duplicate_server.rs`

### Suggested functions

- `load_servers()`
- `save_servers()`
- `load_groups()`
- `save_groups()`
- `create_server(input, server_repo, credential_repo) -> Result<Server>`
- `update_server(id, patch, server_repo, credential_repo) -> Result<Server>`
- `validate_server(server, credential) -> Result<()>`
- `create_group(name, repo) -> Result<ServerGroup>`
- `rename_group(id, name, repo) -> Result<ServerGroup>`
- `move_server_to_group(server_id, group_id, repo) -> Result<()>`
- `delete_group(id, strategy, repo) -> Result<()>`
- `duplicate_server(id, repo) -> Result<Server>`

### Service rules

- a saved server must have exactly one `credential_id`
- `auth_method = password` requires a password credential
- `auth_method = private_key` requires a private-key credential
- changing auth method replaces the binding; it does not keep a fallback binding
- duplicate server:
  - keeps `credential_id`
  - resets `last_connected_at`
  - resets `last_os_sync_at`

Suggested first deletion strategy for groups:

- deleting a group moves member servers to `group_id = None`

### PR4 acceptance

- auth method and credential kind mismatch is rejected
- saved servers never retain old auth bindings
- duplicate does not clone secret material
- group deletion rehomes servers predictably

## PR5: OS Detection And Sync

Goal:
- detect server OS from successful connection context
- isolate OS detection from credential logic

### Files

- `src/services/server_os_sync/mod.rs`
- `src/services/server_os_sync/os_mapper.rs`
- `src/services/server_os_sync/detect.rs`
- `src/services/server_os_sync/sync.rs`

### Suggested functions

- `map_probe_output_to_os_type(raw: &str) -> OsType`
- `detect_server_os(server, executor) -> Result<OsProbeResult>`
- `sync_server_os(server_id, repo, executor) -> Result<Server>`
- `sync_all_server_os(repo, executor) -> Result<SyncSummary>`

### Detection order

1. `uname -s`
2. `sw_vers` for Darwin targets
3. `/etc/os-release`
4. `cat /etc/issue` fallback

### Rules

- only minimal identification commands should run
- only these fields may be updated:
  - `os_type`
  - `os_detection_status`
  - `os_detected_from`
  - `last_os_sync_at`
- failures must not affect:
  - `credential_id`
  - `auth_method`
  - other server config

### PR5 acceptance

- Apple, Ubuntu, Debian, Red Hat/CentOS, Alpine, Windows, and unknown mappings are stable
- sync can run per-server and all-server
- detection failure is isolated to OS status

## PR6: Desktop UI First Pass

Goal:
- expose the model and service capabilities in desktop UI
- keep UI bound to metadata and IDs, not raw secret values

### Directories

- `apps/desktop/src/features/credentials/`
- `apps/desktop/src/features/servers/`
- `apps/desktop/src/features/server-os-sync/`

### Suggested components

Credentials:

- `CredentialList.tsx`
- `PrivateKeyImportForm.tsx`
- `PrivateKeyGenerateForm.tsx`
- `PasswordCredentialForm.tsx`
- `CredentialDetailPanel.tsx`
- `PassphraseEditor.tsx`
- `CredentialPicker.tsx`

Servers:

- `ServerList.tsx`
- `GroupList.tsx`
- `ServerForm.tsx`
- `AuthMethodSegment.tsx`
- `BasicFieldsSection.tsx`
- `AdvancedSettingsSection.tsx`

OS sync:

- `OsIcon.tsx`
- `SyncOsButton.tsx`
- `useServerOsSync.ts`

### UI rules

- `ServerForm` shows exactly one credential picker at a time
- `CredentialPicker` lists only credentials matching current `authMethod`
- saving a server submits one `credentialId`
- list UI shows:
  - current OS icon
  - unknown state
  - syncing state
  - failed sync state

### PR6 acceptance

- desktop UI can create password and private-key credentials
- desktop UI can create and edit servers with one active auth method
- desktop UI can show group and server list views
- desktop UI can trigger icon sync and display OS status clearly

## Test Strategy

### Rust-focused PRs

PR1 through PR5 should rely primarily on unit tests.

Required assertions:

- JSON snapshots never contain secret plaintext
- auth method and credential kind mismatches fail fast
- `rsa 2048` imports are classified as legacy
- delete protection for bound credentials works
- OS detection updates only OS-related fields

### Desktop UI PR

PR6 should include:

- TypeScript typecheck
- basic render tests for key form transitions
- tests for `CredentialPicker` filtering
- tests for OS icon state rendering

## Security Gates

These checks apply to every PR in this plan:

- no raw password, private key, or passphrase may land in `servers.json`, `groups.json`, or `credentials.json`
- no error message should echo secret material
- importing or rotating a key may log `credentialId` and fingerprint only
- deleting a credential must prove no saved server still binds it
- OS detection may not expand into general remote host inventory collection

## Recommended Merge Order

The order should remain:

1. PR1
2. PR2
3. PR3
4. PR4
5. PR5
6. PR6

Do not start PR6 until PR3 and PR4 are merged. UI should not drive final data shape decisions.

## Handoff

Once this plan is accepted, the next execution lanes are:

- implementation against PR1 first
- security review during PR2 and PR3
- verification loop on every PR boundary
