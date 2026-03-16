type EmptyStateProps = {
  message: string;
};

export default function EmptyState({ message }: EmptyStateProps) {
  return <div className="py-12 text-center text-sm text-[var(--muted)]">{message}</div>;
}
