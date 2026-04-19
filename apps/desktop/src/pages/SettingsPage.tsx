import { Card } from "../components/Card";
import { ThemeModeToggle } from "../components/ThemeModeToggle";

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Preferences
        </span>
        <h3 className="mt-0.5 text-[15px] font-semibold text-[var(--text-strong)]">
          Settings
        </h3>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4">
        {/* Shell Defaults */}
        <Card
          header={
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Shell Defaults
              </span>
            </div>
          }
        >
          <div className="flex flex-col gap-0">
            <div className="flex items-center justify-between border-b border-[var(--border)] py-3 first:pt-0 last:border-b-0">
              <span className="text-[13px] text-[var(--text)]">Window density</span>
              <strong className="text-[13px] font-medium text-[var(--text-strong)]">
                Comfortable
              </strong>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--border)] py-3 first:pt-0 last:border-b-0">
              <span className="text-[13px] text-[var(--text)]">Update channel</span>
              <strong className="text-[13px] font-medium text-[var(--text-strong)]">
                Stable
              </strong>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--border)] py-3 first:pt-0 last:border-b-0">
              <span className="text-[13px] text-[var(--text)]">Background sync</span>
              <strong className="text-[13px] font-medium text-[var(--text-strong)]">
                Paused for mock shell
              </strong>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--border)] py-3 first:pt-0 last:border-b-0">
              <span className="text-[13px] text-[var(--text)]">Theme</span>
              <ThemeModeToggle />
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card
          header={
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Notes
              </span>
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">
            Keep this desktop UI independent. Reuse contracts and Rust logic later, but
            do not merge component structure with the web surface.
          </p>
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-accent)] px-3 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Current implementation rule
            </span>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
              Desktop must remain an independent UI surface. Only visual language and
              styling patterns are shared — no component reuse, no shared UI library.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
