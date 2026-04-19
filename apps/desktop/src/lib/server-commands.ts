// Tauri command wrappers for Server & Credential management.
// All commands return typed DTOs — never raw secret material.

import { invoke } from "@tauri-apps/api/core";

// ── DTO Types ──

export interface CredentialDto {
  id: string;
  kind: "password" | "private_key";
  name: string;
  storage_mode: string;
  created_at: string;
  updated_at: string;
  last_validated_at: string | null;
  algorithm: string | null;
  rsa_bits: number | null;
  fingerprint: string | null;
  public_key: string | null;
  has_passphrase: boolean | null;
  source: string | null;
  strength: string | null;
  has_value: boolean | null;
}

export interface ServerDto {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: "password" | "private_key";
  credential_id: string;
  group_id: string | null;
  os_type: string;
  os_detection_status: string;
  os_detected_from: string;
  sftp_directory: string | null;
  wol_mac: string | null;
  enable_metrics: boolean;
  enable_containers: boolean;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  last_connected_at: string | null;
  last_os_sync_at: string | null;
}

export interface GroupDto {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SyncSummary {
  total: number;
  detected: number;
  failed: number;
  unchanged: number;
}

// ── Credential Commands ──

export async function listCredentials(kind?: string): Promise<CredentialDto[]> {
  return invoke<CredentialDto[]>("list_credentials", { kind });
}

export async function createPasswordCredential(
  name: string,
  secret: string
): Promise<CredentialDto> {
  return invoke<CredentialDto>("create_password_credential", {
    args: { name, secret },
  });
}

export async function importPrivateKey(
  name: string,
  privateKeyPem: string,
  passphrase?: string
): Promise<CredentialDto> {
  return invoke<CredentialDto>("import_private_key", {
    args: { name, private_key_pem: privateKeyPem, passphrase },
  });
}

export async function generatePrivateKey(
  name: string,
  algorithm: "ed25519" | "rsa",
  rsaBits?: number
): Promise<CredentialDto> {
  return invoke<CredentialDto>("generate_private_key", {
    args: { name, algorithm, rsa_bits: rsaBits },
  });
}

export async function changePrivateKeyPassphrase(
  id: string,
  oldPassphrase?: string,
  newPassphrase?: string
): Promise<void> {
  return invoke<void>("change_private_key_passphrase", {
    args: {
      id,
      old_passphrase: oldPassphrase,
      new_passphrase: newPassphrase,
    },
  });
}

export async function deleteCredential(id: string): Promise<void> {
  return invoke<void>("delete_credential_cmd", { id });
}

export async function validateCredential(id: string): Promise<CredentialDto> {
  return invoke<CredentialDto>("validate_credential_cmd", { id });
}

// ── Server Commands ──

export async function listServers(groupId?: string): Promise<ServerDto[]> {
  return invoke<ServerDto[]>("list_servers", { groupId });
}

export async function getServer(id: string): Promise<ServerDto | null> {
  return invoke<ServerDto | null>("get_server_cmd", { id });
}

export interface CreateServerInput {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "private_key";
  credentialId: string;
  groupId?: string;
  sftpDirectory?: string;
  wolMac?: string;
  enableMetrics?: boolean;
  enableContainers?: boolean;
  description?: string;
  tags?: string[];
}

export async function createServer(
  input: CreateServerInput
): Promise<ServerDto> {
  return invoke<ServerDto>("create_server_cmd", {
    args: {
      name: input.name,
      host: input.host,
      port: input.port,
      username: input.username,
      auth_method: input.authMethod,
      credential_id: input.credentialId,
      group_id: input.groupId,
      sftp_directory: input.sftpDirectory,
      wol_mac: input.wolMac,
      enable_metrics: input.enableMetrics,
      enable_containers: input.enableContainers,
      description: input.description,
      tags: input.tags,
    },
  });
}

export interface UpdateServerInput {
  id: string;
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  authMethod?: "password" | "private_key";
  credentialId?: string;
  groupId?: string | null;
  sftpDirectory?: string | null;
  wolMac?: string | null;
  enableMetrics?: boolean;
  enableContainers?: boolean;
  description?: string | null;
  tags?: string[];
}

export async function updateServer(
  input: UpdateServerInput
): Promise<ServerDto> {
  return invoke<ServerDto>("update_server_cmd", {
    args: {
      id: input.id,
      name: input.name,
      host: input.host,
      port: input.port,
      username: input.username,
      auth_method: input.authMethod,
      credential_id: input.credentialId,
      group_id: input.groupId,
      sftp_directory: input.sftpDirectory,
      wol_mac: input.wolMac,
      enable_metrics: input.enableMetrics,
      enable_containers: input.enableContainers,
      description: input.description,
      tags: input.tags,
    },
  });
}

export async function deleteServer(id: string): Promise<void> {
  return invoke<void>("delete_server_cmd", { id });
}

export async function duplicateServer(id: string): Promise<ServerDto> {
  return invoke<ServerDto>("duplicate_server_cmd", { id });
}

// ── Group Commands ──

export async function listGroups(): Promise<GroupDto[]> {
  return invoke<GroupDto[]>("list_groups_cmd");
}

export async function createGroup(name: string): Promise<GroupDto> {
  return invoke<GroupDto>("create_group_cmd", {
    args: { name, icon: null },
  });
}

export async function renameGroup(
  id: string,
  name: string
): Promise<GroupDto> {
  return invoke<GroupDto>("rename_group_cmd", {
    args: { id, name },
  });
}

export async function moveServerToGroup(
  serverId: string,
  groupId: string | null
): Promise<void> {
  return invoke<void>("move_server_to_group_cmd", {
    args: { server_id: serverId, group_id: groupId },
  });
}

export async function deleteGroup(
  id: string,
  strategy: "rehome" | "delete_with_members"
): Promise<void> {
  return invoke<void>("delete_group_cmd", {
    args: { id, strategy },
  });
}

// ── OS Sync Commands ──

export async function syncServerOs(
  serverId: string,
  probeOutput: string
): Promise<ServerDto> {
  return invoke<ServerDto>("sync_server_os_cmd", {
    args: { server_id: serverId, probe_output: probeOutput },
  });
}

export async function syncAllServerOs(
  probeOutputs: Record<string, string>
): Promise<SyncSummary> {
  return invoke<SyncSummary>("sync_all_server_os_cmd", {
    probeOutputs,
  });
}

// ── Terminal Commands ──

export interface TerminalSessionDto {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  backend: string;
  persistence: string;
  status: string;
  target_type: "local" | "server";
  target_id: string | null;
  target_label: string;
  created_at: string;
  updated_at: string;
}

export async function listTerminalSessions(): Promise<TerminalSessionDto[]> {
  return invoke<TerminalSessionDto[]>("list_terminal_sessions");
}

export interface CreateTerminalSessionInput {
  title?: string;
  cwd?: string;
  shell?: string;
  backend?: string;
  cols?: number;
  rows?: number;
  target_type?: "local" | "server";
  target_id?: string | null;
  target_label?: string;
}

export async function createTerminalSession(
  input: CreateTerminalSessionInput
): Promise<TerminalSessionDto> {
  return invoke<TerminalSessionDto>("create_terminal_session", {
    args: {
      title: input.title,
      cwd: input.cwd,
      shell: input.shell,
      backend: input.backend,
      cols: input.cols,
      rows: input.rows,
      target_type: input.target_type,
      target_id: input.target_id,
      target_label: input.target_label,
    },
  });
}

export async function terminateTerminalSession(
  sessionId: string
): Promise<void> {
  return invoke<void>("terminate_terminal_session", { session_id: sessionId });
}

export interface BackendInfoDto {
  kind: string;
  persistence: string;
  available: boolean;
}

export async function listTerminalBackends(): Promise<{
  available: BackendInfoDto[];
  default_backend: string;
}> {
  return invoke("list_terminal_backends");
}
