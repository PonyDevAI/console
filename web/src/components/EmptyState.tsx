type EmptyStateProps = {
  message: string;
};

export default function EmptyState({ message }: EmptyStateProps) {
  return <div className="py-12 text-center text-zinc-400">{message}</div>;
}
