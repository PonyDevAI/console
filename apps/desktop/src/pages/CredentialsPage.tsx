import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "../components/Button";
import { CredentialList } from "../features/credentials/CredentialList";
import { CredentialDetailPanel } from "../features/credentials/CredentialDetailPanel";
import { NewCredentialModal } from "../features/credentials/NewCredentialModal";
import {
  listCredentials,
  listServers,
  deleteCredential,
  validateCredential,
  type CredentialDto,
  type ServerDto,
} from "../lib/server-commands";

export function CredentialsPage() {
  const [selectedCredential, setSelectedCredential] = useState<CredentialDto | null>(null);
  const [credentials, setCredentials] = useState<CredentialDto[]>([]);
  const [servers, setServers] = useState<ServerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [creds, srvs] = await Promise.all([listCredentials(), listServers()]);
      setCredentials(creds);
      setServers(srvs);
      setSelectedCredential((current) =>
        current ? creds.find((c) => c.id === current.id) ?? null : null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelect = (cred: CredentialDto) => {
    setSelectedCredential(cred);
  };

  const handleCredentialCreated = async () => {
    setShowNewModal(false);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    const cred = credentials.find((c) => c.id === id);
    if (!cred) return;
    const confirmed = window.confirm(`Delete credential "${cred.name}"?`);
    if (!confirmed) return;
    try {
      await deleteCredential(id);
      setSelectedCredential(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete credential");
    }
  };

  const handleValidate = async (id: string) => {
    try {
      await validateCredential(id);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to validate credential");
      throw e;
    }
  };

  // Compute bound servers for the selected credential
  const boundServers = useMemo(() => {
    if (!selectedCredential) return [];
    return servers.filter((s) => s.credential_id === selectedCredential.id);
  }, [selectedCredential, servers]);

  return (
    <div className="flex h-full">
      {/* ── Left: credential list ── */}
      <div className="flex w-72 shrink-0 flex-col border-r border-[var(--border)]">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Credentials
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowNewModal(true)}
            title="New credential"
          >
            <Plus size={13} />
          </Button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-b border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-1.5 text-[11px] text-[var(--danger)]">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 text-[var(--muted)] hover:text-[var(--text)]"
            >
              ✕
            </button>
          </div>
        )}

        {/* List */}
        <CredentialList
          credentials={credentials}
          loading={loading}
          onSelect={handleSelect}
          selectedId={selectedCredential?.id}
        />
      </div>

      {/* ── Right: inspector ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selectedCredential ? (
          <CredentialDetailPanel
            credential={selectedCredential}
            boundServers={boundServers}
            onChangePassphrase={loadData}
            onValidate={handleValidate}
            onDelete={handleDelete}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-center text-[12px] text-[var(--muted)]">
              Select a credential to view details
            </p>
            <Button variant="secondary" size="sm" onClick={() => setShowNewModal(true)}>
              <Plus size={13} />
              New Credential
            </Button>
          </div>
        )}
      </div>

      {/* ── New credential modal ── */}
      {showNewModal && (
        <NewCredentialModal
          onCancel={() => setShowNewModal(false)}
          onCreated={handleCredentialCreated}
        />
      )}
    </div>
  );
}
