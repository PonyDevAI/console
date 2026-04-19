import { useState } from "react";
import { Button } from "../../components/Button";
import { AuthMethodSegment } from "./AuthMethodSegment";
import { BasicFieldsSection } from "./BasicFieldsSection";
import { CredentialPicker } from "../credentials/CredentialPicker";

type ServerFormInitial = {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "private_key";
  credentialId: string;
  groupId?: string | null;
};

type ServerFormOutput = {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "private_key";
  credentialId: string;
  groupId?: string | null;
};

type ServerFormProps = {
  onSubmit?: (data: ServerFormOutput) => void;
  onCancel?: () => void;
  initial?: ServerFormInitial;
  groups?: { id: string; name: string }[];
};

export function ServerForm({ onSubmit, onCancel, initial, groups = [] }: ServerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState(initial?.port ?? 22);
  const [username, setUsername] = useState(initial?.username ?? "");
  const [authMethod, setAuthMethod] = useState<"password" | "private_key">(initial?.authMethod ?? "private_key");
  const [credentialId, setCredentialId] = useState(initial?.credentialId ?? "");
  const [groupId, setGroupId] = useState<string | null>(initial?.groupId ?? null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim() || !username.trim() || !credentialId) return;
    onSubmit?.({ name, host, port, username, authMethod, credentialId, groupId });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <BasicFieldsSection
        name={name} onNameChange={setName}
        host={host} onHostChange={setHost}
        port={port} onPortChange={setPort}
        username={username} onUsernameChange={setUsername}
      />

      {/* Auth method */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Authentication</label>
        <AuthMethodSegment value={authMethod} onChange={setAuthMethod} />
      </div>

      {/* Credential picker */}
      <CredentialPicker
        authMethod={authMethod}
        value={credentialId}
        onChange={setCredentialId}
      />

      {/* Group */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[var(--muted)]">Group</label>
        <select
          value={groupId ?? ""}
          onChange={(e) => setGroupId(e.target.value || null)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-1.5 text-[12px] text-[var(--text)] focus:border-[var(--border-strong)] focus:outline-none"
        >
          <option value="">No group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
        {onCancel && (
          <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="default" size="sm" type="submit">
          {initial ? "Save Changes" : "Create Server"}
        </Button>
      </div>
    </form>
  );
}
