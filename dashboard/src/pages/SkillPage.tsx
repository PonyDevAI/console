import { CheckCircle2, ChevronDown, ChevronUp, Download, Search, XCircle } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { addSkillRepo, fetchSkillRepo, getSkillRepoCache, getSkillRepos, getSkills, importSkillsFromApp, installSkill, installSkillFromUrl, installSkillFromZip, removeSkillRepo, syncSkill, toggleSkillRepo, uninstallSkill, updateSkill } from "../api";
import AppToggleList from "../components/AppToggleList";
import Button from "../components/Button";
import Card from "../components/Card";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import { Input } from "../components/FormFields";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import { toast } from "../components/Toast";
import type { Skill, SkillManifest, SkillRepo } from "../types";

type FilterType = "all" | "ready" | "missing" | "discover";
type PendingAction = { type: "install" | "uninstall"; skill: Skill } | null;
type PendingRepoDelete = SkillRepo | null;

export default function SkillPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [repos, setRepos] = useState<SkillRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [savingAppsId, setSavingAppsId] = useState<string | null>(null);
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [pendingRepoDelete, setPendingRepoDelete] = useState<PendingRepoDelete>(null);
  const [fetchingRepoId, setFetchingRepoId] = useState<string | null>(null);
  const [installingZip, setInstallingZip] = useState(false);
  const [installingFromUrl, setInstallingFromUrl] = useState<string | null>(null);
  const [discoverSkills, setDiscoverSkills] = useState<SkillManifest[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importApp, setImportApp] = useState("claude");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSkills();
      setSkills(data.skills ?? []);
      const repoData = await getSkillRepos();
      setRepos(repoData.repos ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载技能失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const loadDiscover = async () => {
    setLoadingDiscover(true);
    try {
      const enabledRepos = repos.filter((r) => r.enabled);
      const allSkills: SkillManifest[] = [];
      for (const repo of enabledRepos) {
        try {
          const result = await getSkillRepoCache(repo.id);
          allSkills.push(...(result.skills ?? []));
        } catch {
          // ignore errors for individual repos
        }
      }
      setDiscoverSkills(allSkills);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "加载发现内容失败", "error");
    } finally {
      setLoadingDiscover(false);
    }
  };

  useEffect(() => {
    if (filter === "discover") {
      void loadDiscover();
    }
  }, [filter, repos]);

  const withReady = useMemo(
    () => skills.map((skill) => ({ ...skill, ready: Boolean(skill.installed_at) })),
    [skills],
  );

  const readyCount = withReady.filter((skill) => skill.ready).length;

  const filteredSkills = useMemo(() => {
    if (filter === "discover") return [];
    return withReady.filter((skill) => {
      if (filter === "ready" && !skill.ready) return false;
      if (filter === "missing" && skill.ready) return false;
      if (!keyword.trim()) return true;
      const k = keyword.toLowerCase();
      return (
        skill.name.toLowerCase().includes(k) ||
        skill.description.toLowerCase().includes(k) ||
        skill.source.toLowerCase().includes(k)
      );
    });
  }, [withReady, filter, keyword]);

  const filteredManifests = useMemo(() => {
    if (filter !== "discover") return [];
    if (!keyword.trim()) return discoverSkills;
    const k = keyword.toLowerCase();
    return discoverSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(k) ||
        s.description.toLowerCase().includes(k) ||
        s.tags.some((t) => t.toLowerCase().includes(k)),
    );
  }, [discoverSkills, keyword, filter]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateApps = async (id: string, apps: string[]) => {
    setSavingAppsId(id);
    try {
      const updated = await updateSkill(id, { apps });
      setSkills((prev) => prev.map((skill) => (skill.id === id ? updated : skill)));
      toast("技能应用已更新", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "更新技能应用失败", "error");
    } finally {
      setSavingAppsId(null);
    }
  };

  const onSyncSkill = async (skill: Skill) => {
    setSyncingId(skill.id);
    try {
      const result = await syncSkill(skill.id);
      toast(`${skill.name} 已同步到 ${result.synced_count} 个应用`, "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "同步技能失败", "error");
    } finally {
      setSyncingId(null);
    }
  };

  const onConfirmAction = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      if (pending.type === "install") {
        await installSkill(pending.skill.id);
        toast(`${pending.skill.name} 已安装`, "success");
      } else {
        await uninstallSkill(pending.skill.id);
        toast(`${pending.skill.name} 已卸载`, "success");
      }
      setPending(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "操作失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const onAddRepo = async () => {
    if (!repoName.trim() || !repoUrl.trim()) {
      toast("名称和 URL 不能为空", "error");
      return;
    }
    try {
      await addSkillRepo(repoName.trim(), repoUrl.trim());
      setRepoModalOpen(false);
      setRepoName("");
      setRepoUrl("");
      toast("仓库已添加", "success");
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "添加仓库失败", "error");
    }
  };

  const onToggleRepo = async (repo: SkillRepo, enabled: boolean) => {
    try {
      await toggleSkillRepo(repo.id, enabled);
      setRepos((prev) => prev.map((r) => (r.id === repo.id ? { ...r, enabled } : r)));
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "切换仓库状态失败", "error");
    }
  };

  const onFetchRepo = async (repo: SkillRepo) => {
    setFetchingRepoId(repo.id);
    try {
      await fetchSkillRepo(repo.id);
      toast(`${repo.name} 索引已同步`, "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "同步仓库索引失败", "error");
    } finally {
      setFetchingRepoId(null);
    }
  };

  const handleZipFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setInstallingZip(true);
    try {
      await installSkillFromZip(file);
      toast("技能安装成功", "success");
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "安装失败", "error");
    } finally {
      setInstallingZip(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInstallFromDiscover = async (manifest: SkillManifest) => {
    setInstallingFromUrl(manifest.name);
    try {
      await installSkillFromUrl(manifest.name, manifest.source_url, ["claude", "codex", "gemini", "cursor"]);
      toast(`${manifest.name} 已安装`, "success");
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "安装失败", "error");
    } finally {
      setInstallingFromUrl(null);
    }
  };

  const onImportFromApp = async () => {
    setImporting(true);
    try {
      await importSkillsFromApp(importApp);
      toast("技能导入成功", "success");
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "导入失败", "error");
    } finally {
      setImporting(false);
    }
  };

  const onDeleteRepo = async () => {
    if (!pendingRepoDelete) return;
    try {
      await removeSkillRepo(pendingRepoDelete.id);
      toast("仓库已删除", "success");
      setPendingRepoDelete(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "删除仓库失败", "error");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="技能" description="技能库存与就绪状态">
        <div className="flex items-center gap-2">
          <select
            value={importApp}
            onChange={(event) => setImportApp(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--text-strong)] cursor-pointer"
          >
            <option value="cursor">cursor</option>
            <option value="claude">claude</option>
            <option value="codex">codex</option>
            <option value="gemini">gemini</option>
            <option value="opencode">opencode</option>
            <option value="openclaw">openclaw</option>
          </select>
          <Button variant="secondary" onClick={() => void onImportFromApp()} disabled={importing}>
            {importing ? "导入中..." : "从应用导入"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleZipFile}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={installingZip}
          >
            <Download className="h-4 w-4" />
            {installingZip ? "安装中..." : "从 ZIP 安装"}
          </Button>
          <Button variant="secondary" onClick={() => void load()}>
            刷新
          </Button>
        </div>
      </PageHeader>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger-subtle)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-[var(--text-strong)]">仓库</div>
            <Button size="sm" onClick={() => setRepoModalOpen(true)}>添加仓库</Button>
          </div>
          {repos.length === 0 ? (
            <div className="text-xs text-[var(--muted)]">暂无已配置的仓库。</div>
          ) : (
            <div className="space-y-2">
              {repos.map((repo) => (
                <div key={repo.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] p-2">
                  <div>
                    <div className="text-xs font-medium text-[var(--text-strong)]">{repo.name}</div>
                    <div className="text-xs text-[var(--muted)]">{repo.url}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onFetchRepo(repo)}
                      disabled={fetchingRepoId === repo.id}
                    >
                      {fetchingRepoId === repo.id ? "同步中..." : "同步"}
                    </Button>
                    <Button
                      size="sm"
                      variant={repo.enabled ? "default" : "secondary"}
                      onClick={() => void onToggleRepo(repo, !repo.enabled)}
                    >
                      {repo.enabled ? "已启用" : "已禁用"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setPendingRepoDelete(repo)}>删除</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索技能"
            className="w-full rounded-full border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm text-[var(--text-strong)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant={filter === "all" ? "default" : "secondary"} onClick={() => setFilter("all")}>全部</Button>
          <Button size="sm" variant={filter === "ready" ? "default" : "secondary"} onClick={() => setFilter("ready")}>就绪</Button>
          <Button size="sm" variant={filter === "missing" ? "default" : "secondary"} onClick={() => setFilter("missing")}>缺失</Button>
          <Button size="sm" variant={filter === "discover" ? "default" : "secondary"} onClick={() => setFilter("discover")}>发现</Button>
        </div>
      </div>

      {filter === "discover" ? (
        loadingDiscover ? (
          <Spinner />
        ) : discoverSkills.length === 0 ? (
          <EmptyState message="暂无可用技能。请先同步仓库索引。" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {discoverSkills.map((manifest) => {
              const isInstalling = installingFromUrl === manifest.name;
              return (
                <Card key={manifest.source_url}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-strong)]">{manifest.name}</div>
                        <div className="text-xs text-[var(--muted)]">
                          版本：{manifest.version ?? "未知"}
                        </div>
                      </div>
                    </div>

                    <p className="min-h-10 text-sm text-[var(--muted)]">{manifest.description || "暂无描述。"}</p>
                    {manifest.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {manifest.tags.map((tag) => (
                          <span key={tag} className="rounded bg-[var(--bg-accent)] px-2 py-0.5 text-xs text-[var(--muted)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleInstallFromDiscover(manifest)}
                        disabled={isInstalling}
                      >
                        {isInstalling ? "安装中..." : "安装"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : filteredSkills.length === 0 ? (
        <EmptyState message="未找到技能。" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredSkills.map((skill) => {
            const isInstalled = Boolean(skill.installed_at);
            const isExpanded = expanded.has(skill.id);

            return (
              <Card key={skill.id}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-strong)]">{skill.name}</div>
                      <div className="text-xs text-[var(--muted)]">{skill.source || "本地"}</div>
                    </div>
                    {isInstalled ? (
                      <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
                    ) : (
                      <XCircle className="h-5 w-5 text-[var(--danger)]" />
                    )}
                  </div>

                  <p className="min-h-10 text-sm text-[var(--muted)]">{skill.description || "暂无描述。"}</p>
                  <div className="text-xs text-[var(--muted)]">
                    应用: {skill.apps.length > 0 ? skill.apps.join(", ") : "无"}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isInstalled ? (
                      <Button size="sm" variant="ghost" onClick={() => setPending({ type: "uninstall", skill })}>
                        卸载
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => setPending({ type: "install", skill })}>
                        安装
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => toggleExpanded(skill.id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      详情
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onSyncSkill(skill)}
                      disabled={syncingId === skill.id}
                    >
                      {syncingId === skill.id ? "同步中..." : "同步"}
                    </Button>
                  </div>

                  {isExpanded ? (
                    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] p-3">
                      <div className="text-xs text-[var(--muted)]">来源: {skill.source || "N/A"}</div>
                      {skill.source_url ? (
                        <div className="break-all text-xs text-[var(--muted)]">来源 URL: {skill.source_url}</div>
                      ) : null}
                      <div className="text-xs text-[var(--muted)]">
                        安装时间: {skill.installed_at ? new Date(skill.installed_at).toLocaleString() : "未安装"}
                      </div>
                      {skill.version ? (
                        <div className="text-xs text-[var(--muted)]">版本: {skill.version}</div>
                      ) : null}
                      <div>
                        <div className="mb-1 text-xs font-medium text-[var(--muted)]">已启用应用</div>
                        <AppToggleList
                          selected={skill.apps}
                          onChange={(apps) => void updateApps(skill.id, apps)}
                        />
                        {savingAppsId === skill.id ? (
                          <div className="mt-1 text-xs text-[var(--muted)]">保存应用中...</div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={`${pending?.type === "install" ? "安装" : "卸载"}技能`}
        message={`确定要${pending?.type === "install" ? "安装" : pending?.type === "uninstall" ? "卸载" : "更新"} ${pending?.skill.name ?? "此技能"} 吗？`}
        confirmLabel={pending?.type === "install" ? "安装" : "卸载"}
        variant={pending?.type === "uninstall" ? "danger" : "default"}
        loading={submitting}
        onCancel={() => setPending(null)}
        onConfirm={() => void onConfirmAction()}
      />
      <ConfirmDialog
        open={Boolean(pendingRepoDelete)}
        title="删除仓库"
        message={`确定要删除 ${pendingRepoDelete?.name ?? "此仓库"} 吗？`}
        confirmLabel="删除"
        variant="danger"
        loading={false}
        onCancel={() => setPendingRepoDelete(null)}
        onConfirm={() => void onDeleteRepo()}
      />
      <Modal
        open={repoModalOpen}
        onClose={() => setRepoModalOpen(false)}
        title="添加仓库"
        footer={(
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRepoModalOpen(false)}>取消</Button>
            <Button type="button" onClick={() => void onAddRepo()}>添加</Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <Input label="名称" value={repoName} onChange={(event) => setRepoName(event.target.value)} />
          <Input label="URL" value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
