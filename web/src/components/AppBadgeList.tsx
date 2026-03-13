type AppBadgeListProps = {
  apps: string[];
};

export default function AppBadgeList({ apps }: AppBadgeListProps) {
  if (apps.length === 0) {
    return <span className="text-xs text-zinc-400">No apps</span>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {apps.map((app) => (
        <span key={app} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
          {app}
        </span>
      ))}
    </div>
  );
}
