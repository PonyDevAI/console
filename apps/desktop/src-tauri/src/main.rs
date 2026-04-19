#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cloudcode::models::{
    CredentialIndex, ServerAuthMethod,
};
use cloudcode::storage::{
    credentials::{
        file_store::{
            get_password_meta, get_private_key_meta,
            load_credentials_index, save_credentials_index,
        },
        secure_store::{create_secure_store, SecureStore},
    },
    servers::file_store::{
        get_server as get_server_from_index, load_group_index,
        load_server_index, move_server_to_group as move_server_to_group_store,
        remove_server, save_group_index, save_server_index,
    },
    CloudCodePaths,
};
use cloudcode::services::credentials::{
    change_passphrase::{
        change_private_key_passphrase as svc_change_passphrase, ChangePassphraseInput,
    },
    delete_credential::delete_credential as svc_delete_credential,
    generate_private_key::{
        generate_private_key as svc_generate_key, GenerateAlgorithm, GeneratePrivateKeyInput,
    },
    import_private_key::{import_private_key as svc_import_key, ImportPrivateKeyInput},
    password_credential::{
        create_password_credential as svc_create_password, CreatePasswordCredentialInput,
    },
    validate_credential::validate_credential as svc_validate_credential,
};
use cloudcode::services::servers::{
    create_server::{create_server as svc_create_server, CreateServerInput},
    duplicate_server::duplicate_server as svc_duplicate_server,
    groups::{
        create_group as svc_create_group, delete_group as svc_delete_group,
        rename_group as svc_rename_group, DeleteGroupStrategy,
    },
    update_server::{update_server as svc_update_server, UpdateServerInput},
};
use cloudcode::services::server_os_sync::sync::{
    sync_all_server_os as svc_sync_all_os, sync_server_os as svc_sync_os, SyncSummary,
};
use cloudcode::services::terminal::TerminalService;
use cloudcode::services::terminal::backends::SshConnection;
use cloudcode_contracts::terminal::TerminalSessionMeta;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

// ── Active Terminal Attach ──

struct ActiveTerminal {
    writer: Arc<Mutex<Box<dyn std::io::Write + Send>>>,
    resize_fn: Arc<dyn Fn(u16, u16) -> anyhow::Result<()> + Send + Sync>,
    close_fn: Arc<dyn Fn() -> anyhow::Result<()> + Send + Sync>,
}

// ── App State ──

struct AppState {
    paths: CloudCodePaths,
    store: Mutex<Box<dyn SecureStore + Send>>,
    terminal_service: TerminalService,
    active_terminals: Arc<Mutex<HashMap<String, ActiveTerminal>>>,
}

// ── DTOs ──

#[derive(Serialize, Clone)]
struct CredentialDto {
    id: String,
    kind: String,
    name: String,
    storage_mode: String,
    created_at: String,
    updated_at: String,
    last_validated_at: Option<String>,
    algorithm: Option<String>,
    rsa_bits: Option<u32>,
    fingerprint: Option<String>,
    public_key: Option<String>,
    has_passphrase: Option<bool>,
    source: Option<String>,
    strength: Option<String>,
    has_value: Option<bool>,
}

#[derive(Serialize, Clone)]
struct ServerDto {
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    credential_id: String,
    group_id: Option<String>,
    os_type: String,
    os_detection_status: String,
    os_detected_from: String,
    sftp_directory: Option<String>,
    wol_mac: Option<String>,
    enable_metrics: bool,
    enable_containers: bool,
    description: Option<String>,
    tags: Vec<String>,
    created_at: String,
    updated_at: String,
    last_connected_at: Option<String>,
    last_os_sync_at: Option<String>,
}

#[derive(Serialize, Clone)]
struct GroupDto {
    id: String,
    name: String,
    icon: Option<String>,
    sort_order: i32,
    created_at: String,
    updated_at: String,
}

// ── Command Args ──

#[derive(Deserialize)]
struct CreatePasswordCredentialArgs {
    name: String,
    secret: String,
}

#[derive(Deserialize)]
struct ImportPrivateKeyArgs {
    name: String,
    private_key_pem: String,
    passphrase: Option<String>,
}

#[derive(Deserialize)]
struct GeneratePrivateKeyArgs {
    name: String,
    algorithm: String,
    rsa_bits: Option<u32>,
}

#[derive(Deserialize)]
struct ChangePassphraseArgs {
    id: String,
    old_passphrase: Option<String>,
    new_passphrase: Option<String>,
}

#[derive(Deserialize)]
struct CreateServerArgs {
    name: String,
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    credential_id: String,
    group_id: Option<String>,
    sftp_directory: Option<String>,
    wol_mac: Option<String>,
    enable_metrics: Option<bool>,
    enable_containers: Option<bool>,
    description: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct UpdateServerArgs {
    id: String,
    name: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
    auth_method: Option<String>,
    credential_id: Option<String>,
    group_id: Option<String>,
    sftp_directory: Option<String>,
    wol_mac: Option<String>,
    enable_metrics: Option<bool>,
    enable_containers: Option<bool>,
    description: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct CreateGroupArgs {
    name: String,
    icon: Option<String>,
}

#[derive(Deserialize)]
struct RenameGroupArgs {
    id: String,
    name: String,
}

#[derive(Deserialize)]
struct MoveServerToGroupArgs {
    server_id: String,
    group_id: Option<String>,
}

#[derive(Deserialize)]
struct DeleteGroupArgs {
    id: String,
    strategy: String,
}

#[derive(Deserialize)]
struct SyncServerOsArgs {
    server_id: String,
    probe_output: String,
}

// ── Helpers ──

fn to_credential_dto(cred: &cloudcode::models::Credential, index: &CredentialIndex) -> CredentialDto {
    let pk_meta = get_private_key_meta(index, &cred.id);
    let pw_meta = get_password_meta(index, &cred.id);

    CredentialDto {
        id: cred.id.clone(),
        kind: format!("{:?}", cred.kind).to_lowercase(),
        name: cred.name.clone(),
        storage_mode: format!("{:?}", cred.storage_mode).to_lowercase(),
        created_at: cred.created_at.to_rfc3339(),
        updated_at: cred.updated_at.to_rfc3339(),
        last_validated_at: cred.last_validated_at.map(|d| d.to_rfc3339()),
        algorithm: pk_meta.map(|m| format!("{:?}", m.algorithm).to_lowercase()),
        rsa_bits: pk_meta.and_then(|m| m.rsa_bits),
        fingerprint: pk_meta.map(|m| m.fingerprint.clone()),
        public_key: pk_meta.map(|m| m.public_key.clone()),
        has_passphrase: pk_meta.map(|m| m.has_passphrase),
        source: pk_meta.map(|m| format!("{:?}", m.source).to_lowercase()),
        strength: pk_meta.map(|m| format!("{:?}", m.strength).to_lowercase()),
        has_value: pw_meta.map(|m| m.has_value),
    }
}

fn to_server_dto(server: &cloudcode::models::Server) -> ServerDto {
    ServerDto {
        id: server.id.clone(),
        name: server.name.clone(),
        host: server.host.clone(),
        port: server.port,
        username: server.username.clone(),
        auth_method: format!("{:?}", server.auth_method).to_lowercase(),
        credential_id: server.credential_id.clone(),
        group_id: server.group_id.clone(),
        os_type: format!("{:?}", server.os_type).to_lowercase(),
        os_detection_status: format!("{:?}", server.os_detection_status).to_lowercase(),
        os_detected_from: format!("{:?}", server.os_detected_from).to_lowercase(),
        sftp_directory: server.sftp_directory.clone(),
        wol_mac: server.wol_mac.clone(),
        enable_metrics: server.enable_metrics,
        enable_containers: server.enable_containers,
        description: server.description.clone(),
        tags: server.tags.clone(),
        created_at: server.created_at.to_rfc3339(),
        updated_at: server.updated_at.to_rfc3339(),
        last_connected_at: server.last_connected_at.map(|d| d.to_rfc3339()),
        last_os_sync_at: server.last_os_sync_at.map(|d| d.to_rfc3339()),
    }
}

fn to_group_dto(group: &cloudcode::models::ServerGroup) -> GroupDto {
    GroupDto {
        id: group.id.clone(),
        name: group.name.clone(),
        icon: group.icon.clone(),
        sort_order: group.sort_order,
        created_at: group.created_at.to_rfc3339(),
        updated_at: group.updated_at.to_rfc3339(),
    }
}

fn parse_auth_method(s: &str) -> Result<ServerAuthMethod, String> {
    match s {
        "password" => Ok(ServerAuthMethod::Password),
        "private_key" => Ok(ServerAuthMethod::PrivateKey),
        _ => Err(format!("invalid auth_method: {}", s)),
    }
}

fn materialize_terminal_identity_file(
    state: &AppState,
    credential: &cloudcode::models::Credential,
    pk_meta: &cloudcode::models::PrivateKeyMeta,
    scope: &str,
) -> Result<String, String> {
    if pk_meta.has_passphrase {
        return Err("passphrase-protected private keys are not yet supported for remote terminal runtime".to_string());
    }

    let secret_bytes = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        store.load_secret(&credential.storage_ref).map_err(|e| e.to_string())?
    };

    let dir = state.paths.state_dir().join("terminal-ssh-identities");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}-{}.key", credential.id, scope));
    fs::write(&path, &secret_bytes).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    }

    Ok(path.to_string_lossy().to_string())
}

fn resolve_terminal_ssh_connection(
    state: &AppState,
    server_id: &str,
    scope: &str,
) -> Result<SshConnection, String> {
    let server_index = load_server_index(&state.paths).map_err(|e| e.to_string())?;
    let server = get_server_from_index(&server_index, server_id)
        .ok_or_else(|| format!("Server '{}' not found", server_id))?;

    if server.auth_method != ServerAuthMethod::PrivateKey {
        return Err("remote terminal runtime currently supports private_key servers only".to_string());
    }

    let cred_index = load_credentials_index(&state.paths).map_err(|e| e.to_string())?;
    let credential = cred_index.credentials.iter()
        .find(|c| c.id == server.credential_id)
        .ok_or_else(|| format!("Credential '{}' not found", server.credential_id))?;

    let pk_meta = get_private_key_meta(&cred_index, &credential.id)
        .ok_or_else(|| format!("Private key metadata not found for credential '{}'", credential.id))?;

    let identity_file = materialize_terminal_identity_file(state, credential, pk_meta, scope)?;

    Ok(SshConnection {
        host: server.host.clone(),
        port: server.port,
        username: server.username.clone(),
        identity_file: Some(identity_file),
    })
}

// ── Credential Commands ──

#[tauri::command]
fn list_credentials(kind: Option<String>, state: tauri::State<AppState>) -> Result<Vec<CredentialDto>, String> {
    let paths = &state.paths;
    let index = load_credentials_index(paths).map_err(|e| e.to_string())?;

    let creds: Vec<CredentialDto> = index
        .credentials
        .iter()
        .filter(|c| {
            if let Some(k) = &kind {
                let ck = format!("{:?}", c.kind).to_lowercase();
                ck == *k
            } else {
                true
            }
        })
        .map(|c| to_credential_dto(c, &index))
        .collect();

    Ok(creds)
}

#[tauri::command]
fn create_password_credential(
    args: CreatePasswordCredentialArgs,
    state: tauri::State<AppState>,
) -> Result<CredentialDto, String> {
    let paths = &state.paths;
    let mut index = load_credentials_index(paths).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|e| e.to_string())?;

    let input = CreatePasswordCredentialInput {
        name: args.name,
        secret: args.secret,
    };
    let cred = svc_create_password(input, &mut index, &**store).map_err(|e| e.to_string())?;
    save_credentials_index(paths, &index).map_err(|e| e.to_string())?;

    Ok(to_credential_dto(&cred, &index))
}

#[tauri::command]
fn import_private_key(
    args: ImportPrivateKeyArgs,
    state: tauri::State<AppState>,
) -> Result<CredentialDto, String> {
    let paths = &state.paths;
    let mut index = load_credentials_index(paths).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|e| e.to_string())?;

    let input = ImportPrivateKeyInput {
        name: args.name,
        private_key_pem: args.private_key_pem,
        passphrase: args.passphrase,
    };
    let cred = svc_import_key(input, &mut index, &**store).map_err(|e| e.to_string())?;
    save_credentials_index(paths, &index).map_err(|e| e.to_string())?;

    Ok(to_credential_dto(&cred, &index))
}

#[tauri::command]
fn generate_private_key(
    args: GeneratePrivateKeyArgs,
    state: tauri::State<AppState>,
) -> Result<CredentialDto, String> {
    let paths = &state.paths;
    let mut index = load_credentials_index(paths).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|e| e.to_string())?;

    let algorithm = match args.algorithm.as_str() {
        "ed25519" => GenerateAlgorithm::Ed25519,
        "rsa" => GenerateAlgorithm::Rsa,
        _ => return Err(format!("invalid algorithm: {}", args.algorithm)),
    };

    let input = GeneratePrivateKeyInput {
        name: args.name,
        algorithm,
        rsa_bits: args.rsa_bits,
    };
    let cred = svc_generate_key(input, &mut index, &**store).map_err(|e| e.to_string())?;
    save_credentials_index(paths, &index).map_err(|e| e.to_string())?;

    Ok(to_credential_dto(&cred, &index))
}

#[tauri::command]
fn change_private_key_passphrase(
    args: ChangePassphraseArgs,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let paths = &state.paths;
    let mut index = load_credentials_index(paths).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|e| e.to_string())?;

    let input = ChangePassphraseInput {
        old_passphrase: args.old_passphrase,
        new_passphrase: args.new_passphrase,
    };
    svc_change_passphrase(&args.id, input, &mut index, &**store).map_err(|e| e.to_string())?;
    save_credentials_index(paths, &index).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn delete_credential_cmd(
    id: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let paths = &state.paths;
    let mut cred_index = load_credentials_index(paths).map_err(|e| e.to_string())?;
    let server_index = load_server_index(paths).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|e| e.to_string())?;

    svc_delete_credential(&id, &mut cred_index, &**store, &server_index).map_err(|e| e.to_string())?;
    save_credentials_index(paths, &cred_index).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn validate_credential_cmd(
    id: String,
    state: tauri::State<AppState>,
) -> Result<CredentialDto, String> {
    let paths = &state.paths;
    let mut index = load_credentials_index(paths).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|e| e.to_string())?;

    svc_validate_credential(&id, &mut index, &**store).map_err(|e| e.to_string())?;
    save_credentials_index(paths, &index).map_err(|e| e.to_string())?;

    let cred = index
        .credentials
        .iter()
        .find(|credential| credential.id == id)
        .ok_or_else(|| format!("credential {} not found after validation", id))?;

    Ok(to_credential_dto(cred, &index))
}

// ── Server Commands ──

#[tauri::command]
fn list_servers(group_id: Option<String>, state: tauri::State<AppState>) -> Result<Vec<ServerDto>, String> {
    let paths = &state.paths;
    let index = load_server_index(paths).map_err(|e| e.to_string())?;

    let servers: Vec<ServerDto> = index
        .servers
        .iter()
        .filter(|s| {
            if let Some(gid) = &group_id {
                s.group_id.as_deref() == Some(gid)
            } else {
                true
            }
        })
        .map(to_server_dto)
        .collect();

    Ok(servers)
}

#[tauri::command]
fn get_server_cmd(id: String, state: tauri::State<AppState>) -> Result<Option<ServerDto>, String> {
    let paths = &state.paths;
    let index = load_server_index(paths).map_err(|e| e.to_string())?;
    let server = get_server_from_index(&index, &id).map(to_server_dto);
    Ok(server)
}

#[tauri::command]
fn create_server_cmd(
    args: CreateServerArgs,
    state: tauri::State<AppState>,
) -> Result<ServerDto, String> {
    let paths = &state.paths;
    let mut server_index = load_server_index(paths).map_err(|e| e.to_string())?;
    let cred_index = load_credentials_index(paths).map_err(|e| e.to_string())?;

    let auth_method = parse_auth_method(&args.auth_method)?;

    let input = CreateServerInput {
        name: args.name,
        host: args.host,
        port: args.port,
        username: args.username,
        auth_method,
        credential_id: args.credential_id,
        group_id: args.group_id,
        sftp_directory: args.sftp_directory,
        wol_mac: args.wol_mac,
        enable_metrics: args.enable_metrics.unwrap_or(false),
        enable_containers: args.enable_containers.unwrap_or(false),
        description: args.description,
        tags: args.tags.unwrap_or_default(),
    };
    let server = svc_create_server(input, &mut server_index, &cred_index).map_err(|e| e.to_string())?;
    save_server_index(paths, &server_index).map_err(|e| e.to_string())?;

    Ok(to_server_dto(&server))
}

#[tauri::command]
fn update_server_cmd(
    args: UpdateServerArgs,
    state: tauri::State<AppState>,
) -> Result<ServerDto, String> {
    let paths = &state.paths;
    let mut server_index = load_server_index(paths).map_err(|e| e.to_string())?;
    let cred_index = load_credentials_index(paths).map_err(|e| e.to_string())?;

    let auth_method = args.auth_method.as_ref().map(|s| parse_auth_method(s)).transpose()?;

    let input = UpdateServerInput {
        name: args.name,
        host: args.host,
        port: args.port,
        username: args.username,
        auth_method,
        credential_id: args.credential_id,
        group_id: Some(args.group_id),
        sftp_directory: Some(args.sftp_directory),
        wol_mac: Some(args.wol_mac),
        enable_metrics: args.enable_metrics,
        enable_containers: args.enable_containers,
        description: Some(args.description),
        tags: args.tags,
    };
    let server = svc_update_server(&args.id, input, &mut server_index, &cred_index).map_err(|e| e.to_string())?;
    save_server_index(paths, &server_index).map_err(|e| e.to_string())?;

    Ok(to_server_dto(&server))
}

#[tauri::command]
fn delete_server_cmd(id: String, state: tauri::State<AppState>) -> Result<(), String> {
    let paths = &state.paths;
    let mut index = load_server_index(paths).map_err(|e| e.to_string())?;
    remove_server(&mut index, &id);
    save_server_index(paths, &index).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn duplicate_server_cmd(id: String, state: tauri::State<AppState>) -> Result<ServerDto, String> {
    let paths = &state.paths;
    let mut index = load_server_index(paths).map_err(|e| e.to_string())?;
    let server = svc_duplicate_server(&id, &mut index).map_err(|e| e.to_string())?;
    save_server_index(paths, &index).map_err(|e| e.to_string())?;
    Ok(to_server_dto(&server))
}

// ── Group Commands ──

#[tauri::command]
fn list_groups_cmd(state: tauri::State<AppState>) -> Result<Vec<GroupDto>, String> {
    let paths = &state.paths;
    let index = load_group_index(paths).map_err(|e| e.to_string())?;
    Ok(index.groups.iter().map(to_group_dto).collect())
}

#[tauri::command]
fn create_group_cmd(
    args: CreateGroupArgs,
    state: tauri::State<AppState>,
) -> Result<GroupDto, String> {
    let paths = &state.paths;
    let mut index = load_group_index(paths).map_err(|e| e.to_string())?;
    let group = svc_create_group(&args.name, &mut index).map_err(|e| e.to_string())?;
    save_group_index(paths, &index).map_err(|e| e.to_string())?;
    Ok(to_group_dto(&group))
}

#[tauri::command]
fn rename_group_cmd(
    args: RenameGroupArgs,
    state: tauri::State<AppState>,
) -> Result<GroupDto, String> {
    let paths = &state.paths;
    let mut index = load_group_index(paths).map_err(|e| e.to_string())?;
    let group = svc_rename_group(&args.id, &args.name, &mut index).map_err(|e| e.to_string())?;
    save_group_index(paths, &index).map_err(|e| e.to_string())?;
    Ok(to_group_dto(&group))
}

#[tauri::command]
fn move_server_to_group_cmd(
    args: MoveServerToGroupArgs,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let paths = &state.paths;
    let mut index = load_server_index(paths).map_err(|e| e.to_string())?;
    let ok = move_server_to_group_store(&mut index, &args.server_id, args.group_id);
    if !ok {
        return Err(format!("server {} not found", args.server_id));
    }
    save_server_index(paths, &index).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_group_cmd(
    args: DeleteGroupArgs,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let paths = &state.paths;
    let mut group_index = load_group_index(paths).map_err(|e| e.to_string())?;
    let mut server_index = load_server_index(paths).map_err(|e| e.to_string())?;

    let strategy = match args.strategy.as_str() {
        "rehome" => DeleteGroupStrategy::Rehome,
        "delete_with_members" => DeleteGroupStrategy::DeleteWithMembers,
        _ => return Err(format!("invalid strategy: {}", args.strategy)),
    };

    svc_delete_group(&args.id, strategy, &mut group_index, &mut server_index).map_err(|e| e.to_string())?;
    save_group_index(paths, &group_index).map_err(|e| e.to_string())?;
    save_server_index(paths, &server_index).map_err(|e| e.to_string())?;

    Ok(())
}

// ── OS Sync Commands ──

#[tauri::command]
fn sync_server_os_cmd(
    args: SyncServerOsArgs,
    state: tauri::State<AppState>,
) -> Result<ServerDto, String> {
    let paths = &state.paths;
    let mut index = load_server_index(paths).map_err(|e| e.to_string())?;
    let server = svc_sync_os(&mut index, &args.server_id, &args.probe_output).map_err(|e| e.to_string())?;
    save_server_index(paths, &index).map_err(|e| e.to_string())?;
    Ok(to_server_dto(&server))
}

#[tauri::command]
fn sync_all_server_os_cmd(
    probe_outputs: HashMap<String, String>,
    state: tauri::State<AppState>,
) -> Result<SyncSummary, String> {
    let paths = &state.paths;
    let mut index = load_server_index(paths).map_err(|e| e.to_string())?;
    let summary = svc_sync_all_os(&mut index, probe_outputs).map_err(|e| e.to_string())?;
    save_server_index(paths, &index).map_err(|e| e.to_string())?;
    Ok(summary)
}

// ── Shell Command ──

#[tauri::command]
fn desktop_shell_status() -> &'static str {
    "desktop-shell-ready"
}

// ── Terminal Commands ──

#[derive(Serialize, Clone)]
struct TerminalSessionDto {
    id: String,
    title: String,
    cwd: String,
    shell: String,
    backend: String,
    persistence: String,
    status: String,
    target_type: String,
    target_id: Option<String>,
    target_label: String,
    created_at: String,
    updated_at: String,
}

fn to_session_dto(s: &TerminalSessionMeta) -> TerminalSessionDto {
    TerminalSessionDto {
        id: s.id.clone(),
        title: s.title.clone(),
        cwd: s.cwd.clone(),
        shell: s.shell.clone(),
        backend: s.backend.clone(),
        persistence: s.persistence.clone(),
        status: s.status.clone(),
        target_type: s.target_type.clone(),
        target_id: s.target_id.clone(),
        target_label: s.target_label.clone(),
        created_at: s.created_at.to_rfc3339(),
        updated_at: s.updated_at.to_rfc3339(),
    }
}

#[derive(Deserialize)]
struct CreateTerminalSessionArgs {
    title: Option<String>,
    cwd: Option<String>,
    shell: Option<String>,
    backend: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
    target_type: Option<String>,
    target_id: Option<String>,
    target_label: Option<String>,
}

#[tauri::command]
fn list_terminal_sessions(
    state: tauri::State<AppState>,
) -> Result<Vec<TerminalSessionDto>, String> {
    let response = state.terminal_service.list_sessions().map_err(|e| e.to_string())?;
    Ok(response.sessions.iter().map(to_session_dto).collect())
}

#[tauri::command]
fn get_terminal_session(
    session_id: String,
    state: tauri::State<AppState>,
) -> Result<TerminalSessionDto, String> {
    let session = state.terminal_service.get_session(&session_id).map_err(|e| e.to_string())?;
    Ok(to_session_dto(&session))
}

#[tauri::command]
fn create_terminal_session(
    args: CreateTerminalSessionArgs,
    state: tauri::State<AppState>,
) -> Result<TerminalSessionDto, String> {
    let target_type = args.target_type.as_deref().unwrap_or("local");

    let request = if target_type == "server" {
        let target_id = args.target_id.as_ref()
            .ok_or_else(|| "target_id required for server target".to_string())?;
        let server_index = load_server_index(&state.paths).map_err(|e| e.to_string())?;
        let server = get_server_from_index(&server_index, target_id)
            .ok_or_else(|| format!("Server '{}' not found", target_id))?;
        let ssh_conn = resolve_terminal_ssh_connection(&state, target_id, "create")?;

        cloudcode_contracts::terminal::CreateSessionRequest {
            title: args.title.or_else(|| Some(server.name.clone())),
            cwd: args.cwd,
            shell: args.shell,
            backend: args.backend,
            cols: args.cols.unwrap_or(80),
            rows: args.rows.unwrap_or(24),
            target_type: "server".to_string(),
            target_id: Some(server.id.clone()),
            target_label: args.target_label.unwrap_or_else(|| server.name.clone()),
            ssh_host: Some(ssh_conn.host),
            ssh_port: ssh_conn.port,
            ssh_username: Some(ssh_conn.username),
            ssh_identity_file: ssh_conn.identity_file,
        }
    } else {
        cloudcode_contracts::terminal::CreateSessionRequest {
            title: args.title,
            cwd: args.cwd,
            shell: args.shell,
            backend: args.backend,
            cols: args.cols.unwrap_or(80),
            rows: args.rows.unwrap_or(24),
            target_type: "local".to_string(),
            target_id: args.target_id,
            target_label: args.target_label.unwrap_or_else(|| "Local".to_string()),
            ssh_host: None,
            ssh_port: 22,
            ssh_username: None,
            ssh_identity_file: None,
        }
    };

    let response = state.terminal_service.create_session(request).map_err(|e| e.to_string())?;
    Ok(to_session_dto(&response.session))
}

#[tauri::command]
fn terminate_terminal_session(
    session_id: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let session = state.terminal_service.get_session(&session_id).map_err(|e| e.to_string())?;
    if session.target_type == "server" {
        let target_id = session.target_id
            .ok_or_else(|| format!("Remote session '{}' missing target_id", session_id))?;
        let ssh_conn = resolve_terminal_ssh_connection(&state, &target_id, &format!("terminate-{}", session_id))?;
        state.terminal_service
            .terminate_session_with_ssh(&session_id, ssh_conn)
            .map_err(|e| e.to_string())
    } else {
        state.terminal_service.terminate_session(&session_id).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn list_terminal_backends(
    state: tauri::State<AppState>,
) -> Result<cloudcode_contracts::terminal::BackendsResponse, String> {
    state.terminal_service.get_backends().map_err(|e| e.to_string())
}

// ── Terminal Attach/Streaming Commands ──

#[tauri::command(async)]
async fn attach_terminal_session(
    session_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Get session metadata to determine if it's local or remote
    let session_meta = state.terminal_service.get_session(&session_id).map_err(|e| e.to_string())?;

    let components = if session_meta.target_type == "server" {
        let target_id = session_meta.target_id.as_ref()
            .ok_or_else(|| "Remote session missing target_id".to_string())?;
        let ssh_conn = resolve_terminal_ssh_connection(&state, target_id, &format!("attach-{}", session_id))?;

        state.terminal_service
            .spawn_attach_bridge_with_ssh(&session_id, cols, rows, Some(ssh_conn))
            .map_err(|e| e.to_string())?
    } else {
        // Local session
        state.terminal_service
            .spawn_attach_bridge(&session_id, cols, rows)
            .map_err(|e| e.to_string())?
    };

    let writer = Arc::new(Mutex::new(components.writer));
    let resize_fn = components.resize_fn;
    let close_fn = components.close_fn;

    // Store for input/resize commands
    {
        let mut terminals = state.active_terminals.lock().unwrap();
        terminals.insert(
            session_id.clone(),
            ActiveTerminal {
                writer: writer.clone(),
                resize_fn,
                close_fn: close_fn.clone(),
            },
        );
    }

    // Spawn output streaming thread
    let sid = session_id.clone();
    let app_clone = app.clone();
    let active_terminals = state.active_terminals.clone();
    std::thread::spawn(move || {
        let mut reader = components.reader;
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // EOF — session ended
                    let _ = app_clone.emit(
                        &format!("terminal-exit-{}", sid),
                        serde_json::json!({ "session_id": sid.clone() }),
                    );
                    break;
                }
                Ok(n) => {
                    // Base64-encode the output chunk
                    let b64 = base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        &buf[..n],
                    );
                    let _ = app_clone.emit(
                        &format!("terminal-output-{}", sid),
                        serde_json::json!({ "session_id": sid.clone(), "data": b64 }),
                    );
                }
                Err(_) => {
                    let _ = app_clone.emit(
                        &format!("terminal-error-{}", sid),
                        serde_json::json!({ "session_id": sid.clone(), "message": "Read error" }),
                    );
                    break;
                }
            }
        }

        // Clean up on exit
        let _ = close_fn();
        {
            let mut terminals = active_terminals.lock().unwrap();
            terminals.remove(&sid);
        }
    });

    Ok(())
}

#[tauri::command]
fn send_terminal_input(
    session_id: String,
    data: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let terminals = state.active_terminals.lock().map_err(|e| e.to_string())?;
    let terminal = terminals
        .get(&session_id)
        .ok_or_else(|| format!("No active terminal for session {}", session_id))?;

    let mut writer = terminal.writer.lock().map_err(|e| e.to_string())?;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write input: {}", e))?;
    writer.flush().map_err(|e| format!("Failed to flush: {}", e))?;
    Ok(())
}

#[tauri::command]
fn resize_terminal_session(
    session_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let terminals = state.active_terminals.lock().map_err(|e| e.to_string())?;
    let terminal = terminals
        .get(&session_id)
        .ok_or_else(|| format!("No active terminal for session {}", session_id))?;

    (terminal.resize_fn)(cols, rows).map_err(|e| format!("Failed to resize: {}", e))
}

#[tauri::command]
fn detach_terminal_session(
    session_id: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let meta = state
        .terminal_service
        .get_session(&session_id)
        .map_err(|e| e.to_string())?;

    let terminal = {
        let mut terminals = state.active_terminals.lock().map_err(|e| e.to_string())?;
        terminals.remove(&session_id)
    };

    if meta.persistence == "ephemeral" {
        state
            .terminal_service
            .cleanup_ephemeral_session(&session_id)
            .map_err(|e| e.to_string())?;
    } else if let Some(terminal) = terminal {
        (terminal.close_fn)().map_err(|e| format!("Failed to detach terminal: {}", e))?;
    }

    // Note: this does NOT terminate persistent sessions — it only closes the
    // current attach bridge. Persistent tmux/screen sessions keep running and
    // remain restorable from the Terminal page.
    Ok(())
}

// ── Main ──

fn main() {
    let paths = CloudCodePaths::default();
    paths.ensure_dirs().expect("failed to ensure dirs");
    paths.init_default_files().expect("failed to init defaults");

    let store = create_secure_store(paths.clone());
    let terminal_service = TerminalService::new();
    let active_terminals: Arc<Mutex<HashMap<String, ActiveTerminal>>> = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(AppState {
            paths,
            store: Mutex::new(store),
            terminal_service,
            active_terminals,
        })
        .invoke_handler(tauri::generate_handler![
            desktop_shell_status,
            list_credentials,
            create_password_credential,
            import_private_key,
            generate_private_key,
            change_private_key_passphrase,
            delete_credential_cmd,
            validate_credential_cmd,
            list_servers,
            get_server_cmd,
            create_server_cmd,
            update_server_cmd,
            delete_server_cmd,
            duplicate_server_cmd,
            list_groups_cmd,
            create_group_cmd,
            rename_group_cmd,
            move_server_to_group_cmd,
            delete_group_cmd,
            sync_server_os_cmd,
            sync_all_server_os_cmd,
            list_terminal_sessions,
            get_terminal_session,
            create_terminal_session,
            terminate_terminal_session,
            list_terminal_backends,
            attach_terminal_session,
            send_terminal_input,
            resize_terminal_session,
            detach_terminal_session,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CloudCode desktop shell");
}
