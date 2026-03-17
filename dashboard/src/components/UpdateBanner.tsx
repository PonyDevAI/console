type UpdateBannerProps = {
  currentVersion: string;
  latestVersion: string;
  onUpdate?: () => void;
};

export default function UpdateBanner({ currentVersion, latestVersion, onUpdate }: UpdateBannerProps) {
  if (currentVersion === latestVersion) return null;

  return (
    <div className="mb-4 flex items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-[var(--accent)]/20 bg-[var(--accent-subtle)] px-4 py-2.5 text-sm text-[var(--accent)]">
      <span>
        有新版本可用：v{latestVersion}（当前 v{currentVersion}）
      </span>
      {onUpdate ? (
        <button
          onClick={onUpdate}
          className="rounded-[var(--radius-md)] border border-[var(--accent)]/30 bg-transparent px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10 cursor-pointer"
        >
          立即更新
        </button>
      ) : null}
    </div>
  );
}
