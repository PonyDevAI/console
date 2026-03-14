import { cn } from "../lib/utils";

type AppBadgeListProps = {
  apps: string[];
};

export default function AppBadgeList({ apps }: AppBadgeListProps) {
  if (apps.length === 0) {
    return <span className="text-xs text-[var(--muted)]">No apps</span>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {apps.map((app) => (
        <span key={app} className={cn("rounded-full px-2.5 py-0.5 text-xs", "bg-[var(--accent-subtle)] text-[var(--accent)]")}>
          {app}
        </span>
      ))}
    </div>
  );
}
