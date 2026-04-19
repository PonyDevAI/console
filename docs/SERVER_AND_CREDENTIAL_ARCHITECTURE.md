# Server And Credential Architecture

This document defines the current architecture for local-first server management and private key management in CloudCode.

It fixes the implementation boundary for:

- server records
- private key lifecycle
- password lifecycle
- OS icon detection and sync

It intentionally does not include:

- batch server import
- proxy configuration
- jump host configuration
- authentication fallback

## Capability

CloudCode manages many SSH/SFTP-style server targets locally. Each server binds exactly one active authentication object, which is either a password credential or a private key credential. Private key material is stored outside general config files, and server list OS icons are populated automatically after successful connection or by manual sync.

## Product decisions fixed by this document

- New private keys support `ed25519` and `rsa` only.
- New RSA keys must be `4096` bits.
- Imported RSA keys may be `2048`, `3072`, or `4096` bits.
- `rsa 2048` is supported for import compatibility only and should be marked legacy in UI.
- A server may use exactly one active authentication method at a time: `password` or `private_key`.
- Saving a server removes the non-selected authentication binding.
- OS icon is not user-editable.
- OS icon is derived from server detection only.
- Server list includes a manual "sync icon" action.
- CloudCode does not require an application master password.
- System secure storage is preferred over app-managed secret storage.

## Non-goals

- Batch server creation or CSV import
- Proxy support
- Jump host / bastion support
- Multi-factor auth chaining
- Password/private key automatic fallback
- Database-first persistence

## Domain model

### Credential

`Credential` is the single server authentication object.

Fields:

- `id`
- `kind`: `password | private_key`
- `name`
- `storageMode`: `keychain_ref | encrypted_file`
- `storageRef`
- `createdAt`
- `updatedAt`
- `lastValidatedAt`
- `archivedAt?`

Rules:

- Server records bind to `credentialId`, not to raw secret material.
- Credentials can be reused across multiple servers.
- Credentials are the only persisted link between server config and secret storage.

### PrivateKeyMeta

Private-key-specific metadata extends a `Credential` where `kind = private_key`.

Fields:

- `credentialId`
- `algorithm`: `ed25519 | rsa`
- `rsaBits`: `2048 | 3072 | 4096 | null`
- `format`: `openssh | pem | pkcs8`
- `fingerprint`
- `publicKey`
- `hasPassphrase`
- `source`: `imported | generated`
- `strength`: `recommended | compatible | legacy`

Rules:

- `ed25519` has no `rsaBits`
- generated `rsa` must always be `4096`
- imported `rsa 2048` is allowed but marked `legacy`

### PasswordMeta

Password-specific metadata extends a `Credential` where `kind = password`.

Fields:

- `credentialId`
- `hasValue`
- `source`: `manual`

### Server

Fields:

- `id`
- `name`
- `host`
- `port`
- `username`
- `authMethod`: `password | private_key`
- `credentialId`
- `groupId?`
- `osType`: `apple | ubuntu | debian | centos | redhat | alpine | linux_unknown | windows | unknown`
- `osDetectionStatus`: `unknown | pending | detected | failed`
- `osDetectedFrom`: `ssh_probe | manual_sync | none`
- `sftpDirectory?`
- `wolMac?`
- `enableMetrics`
- `enableContainers`
- `description?`
- `tags`
- `createdAt`
- `updatedAt`
- `lastConnectedAt?`
- `lastOsSyncAt?`

Rules:

- `authMethod` and bound credential kind must match
- a saved server has exactly one active credential
- saving with `password` clears any prior private-key binding
- saving with `private_key` clears any prior password binding

### ServerGroup

Fields:

- `id`
- `name`
- `icon?`
- `sortOrder`
- `createdAt`
- `updatedAt`

## Invariants

- No server config file stores raw password, raw private key, or passphrase.
- No API returns private key material unless an explicit export flow exists.
- A credential cannot be deleted while referenced by any saved server.
- OS detection cannot overwrite secret or auth state.
- OS detection updates only `osType`, `osDetectionStatus`, `osDetectedFrom`, and `lastOsSyncAt`.

## Lifecycle and state

### Credential lifecycle

`draft -> stored -> validated -> bound -> rotated | archived`

Definitions:

- `draft`: form in progress
- `stored`: secret material persisted securely
- `validated`: fingerprint / format / decryptability verified
- `bound`: referenced by at least one server
- `rotated`: passphrase changed or secret replaced in place
- `archived`: hidden from new binding flows

### Server lifecycle

`draft -> saved -> validated -> ready -> invalid | archived`

Definitions:

- `draft`: form in progress
- `saved`: persisted locally
- `validated`: fields and auth binding pass structural checks
- `ready`: enough information exists to attempt connection
- `invalid`: broken credential reference or invalid field configuration
- `archived`: hidden from normal lists

### OS sync lifecycle

`unknown -> pending -> detected | failed`

Definitions:

- `unknown`: no successful identification yet
- `pending`: sync running
- `detected`: `osType` assigned
- `failed`: sync attempted but no conclusive result

## Persistence model

CloudCode remains file-first.

Suggested layout:

```text
~/.cloudcode/
  servers/
    servers.json
    groups.json
  credentials/
    credentials.json
    encrypted/
      <credential-id>.enc
  state/
    ui.json
    cache.json
```

### `servers/servers.json`

Stores only non-secret server configuration plus `credentialId`.

### `servers/groups.json`

Stores group definitions and sorting metadata.

### `credentials/credentials.json`

Stores:

- `Credential`
- `PrivateKeyMeta`
- `PasswordMeta`

It does not store:

- private key plaintext
- password plaintext
- passphrase plaintext

### `credentials/encrypted/<credential-id>.enc`

Fallback secret storage only when system secure storage cannot be used.

## Secret storage strategy

### Preferred mode

Use platform secure storage:

- macOS Keychain
- Windows Credential Manager / DPAPI
- Linux Secret Service

Persist only `storageRef` in CloudCode-owned metadata.

### Fallback mode

Use encrypted local files:

- one encrypted blob per credential
- AEAD encryption such as `AES-256-GCM`
- encryption key should still be protected by platform secure storage whenever available

### Why no app master password

CloudCode is an SSH/SFTP operational client, not a general-purpose vault. Requiring an extra application password would add friction for multi-server daily use and would complicate unattended desktop workflows. Platform secure storage is the primary trust anchor.

## Security boundaries

### Must never happen

- raw private key in server JSON
- raw password in server JSON
- passphrase in logs
- private key material in UI state snapshots
- sensitive secrets inside crash reports or analytics

### Required protections

- destructive actions require confirmation
- deleting a bound credential is blocked
- copy/export of secret material requires explicit user action
- secret fields are masked by default
- validation errors must not echo secret contents

## Interfaces

### Credential interface

- `listCredentials(kind?)`
- `getCredential(id)`
- `importPrivateKey(file, name, passphrase?)`
- `generatePrivateKey({ name, algorithm, rsaBits? })`
- `changePrivateKeyPassphrase(id, oldPassphrase?, newPassphrase?)`
- `createPasswordCredential({ name, secret })`
- `updatePasswordCredential(id, secret)`
- `deleteCredential(id)`
- `validateCredential(id)`
- `listCredentialBindings(id)`

Rules:

- generated RSA must reject any bit size other than `4096`
- imported RSA keys below `2048` must be rejected

### Server interface

- `listServers(filter?)`
- `getServer(id)`
- `createServer(input)`
- `updateServer(id, patch)`
- `deleteServer(id)`
- `duplicateServer(id)`
- `validateServer(id)`
- `syncServerOs(id)`
- `syncAllServerOs()`

### Group interface

- `listGroups()`
- `createGroup(name)`
- `renameGroup(id, name)`
- `moveServerToGroup(serverId, groupId?)`
- `deleteGroup(id, strategy)`

## OS icon strategy

OS icon is detection-driven only.

### Detection triggers

- automatic after successful connection
- manual from the list-level sync action

### Detection inputs

Use minimal SSH commands only:

- `uname`
- `sw_vers`
- `/etc/os-release`
- `cat /etc/issue`

### Mapping

- `Darwin` -> `apple`
- `Ubuntu` -> `ubuntu`
- `Debian` -> `debian`
- `CentOS` -> `centos`
- `Red Hat` / `RHEL` -> `redhat`
- `Alpine` -> `alpine`
- generic Linux -> `linux_unknown`
- Windows signatures -> `windows`
- no result -> `unknown`

### UI contract

- default unknown icon before detection
- spinner or pending affordance while syncing
- retry affordance on failure

## UI module boundaries

### Server management

- `ServerListView`
- `GroupListView`
- `ServerListItem`
- `OsIcon`
- `SyncOsButton`
- `ServerForm`
- `AuthMethodSegment`
- `BasicFieldsSection`
- `AdvancedSettingsSection`

### Credential management

- `CredentialList`
- `PrivateKeyImportForm`
- `PrivateKeyGenerateForm`
- `PasswordCredentialForm`
- `CredentialDetailPanel`
- `PrivateKeyCredentialPicker`
- `PasswordCredentialPicker`
- `PassphraseEditor`
- `FingerprintDisplay`

## MVP

### Scope

- import private key
- generate `ed25519`
- generate `rsa 4096`
- create password credential
- create/edit single server
- bind server to one active credential
- create groups and move servers between groups
- server/group segmented views
- automatic OS detection after successful connection
- manual OS icon sync action

### Acceptance

- no secret plaintext in CloudCode config files
- password/private key auth is mutually exclusive on saved server records
- imported `rsa 2048` is supported and marked legacy
- generated `rsa` is always `4096`
- OS icon updates after successful sync
- deleting referenced credential is blocked

## Deferred items

- batch import
- proxy model
- jump host model
- auth fallback
- certificate auth
- database-backed history or indexing

