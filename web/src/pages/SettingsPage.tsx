import { CircleHelp, Palette, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCliTools, getSettings, updateSettings } from "../api";
import Button from "../components/Button";
import Callout from "../components/Callout";
import Card from "../components/Card";
import { Input, Select } from "../components/FormFields";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import Tabs from "../components/Tabs";
import { toast } from "../components/Toast";
import type { Settings } from "../types";

const tabs = [
  { id: "general", label: "通用", icon: SlidersHorizontal },
  { id: "appearance", label: "外观", icon: Palette },
  { id: "about", label: "关于", icon: CircleHelp },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getSettings(), getCliTools()])
      .then(([settings, cliData]) => {
        if (!mounted) return;
        const names = (cliData.tools ?? []).map((tool) => tool.name);
        setTools(names);
        setSaved(settings);
        setDraft(settings);
      })
      .catch((err: unknown) => {
        toast(err instanceof Error ? err.message : "加载设置失败", "error");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const next = await updateSettings(draft);
      setSaved(next);
      setDraft(next);
      toast("设置已保存", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "保存设置失败", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="设置" description="系统和界面偏好配置" />

      {dirty ? <Callout variant="warning">您有未保存的更改</Callout> : null}

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "general" ? (
        <Card>
          <div className="space-y-4">
            <Input
              label="存储路径"
              value={draft.storage_path}
              onChange={(event) => setDraft((prev) => (prev ? { ...prev, storage_path: event.target.value } : prev))}
            />
            <Select
              label="默认工作器"
              value={draft.default_worker}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, default_worker: event.target.value } : prev))
              }
            >
              {tools.map((tool) => (
                <option key={tool} value={tool}>
                  {tool}
                </option>
              ))}
            </Select>
            <label className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm">
              自动检查更新
              <input
                type="checkbox"
                checked={draft.auto_check_updates}
                onChange={(event) =>
                  setDraft((prev) =>
                    prev ? { ...prev, auto_check_updates: event.target.checked } : prev,
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm">
              变更时同步
              <input
                type="checkbox"
                checked={draft.sync_on_change}
                onChange={(event) =>
                  setDraft((prev) => (prev ? { ...prev, sync_on_change: event.target.checked } : prev))
                }
              />
            </label>
          </div>
        </Card>
      ) : null}

      {activeTab === "appearance" ? (
        <Card>
          <div className="space-y-4">
            <Select
              label="主题"
              value={draft.theme}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, theme: event.target.value as Settings["theme"] } : prev,
                )
              }
            >
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="system">跟随系统</option>
            </Select>
            <Select
              label="日志级别"
              value={draft.log_level}
              onChange={(event) =>
                setDraft((prev) =>
                  prev ? { ...prev, log_level: event.target.value as Settings["log_level"] } : prev,
                )
              }
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </Select>
          </div>
        </Card>
      ) : null}

      {activeTab === "about" ? (
        <Card>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-[var(--muted)]">版本</span>
              <span className="font-medium text-[var(--text)]">0.1.0</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-[var(--muted)]">构建</span>
              <span className="font-medium text-[var(--text)]">dev-local</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">源码仓库</span>
              <a
                className="text-[var(--accent)] hover:underline"
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
              >
                代码仓库
              </a>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={() => void onSave()} disabled={!dirty || saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
