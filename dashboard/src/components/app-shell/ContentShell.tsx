export default function ContentShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-full flex-col overflow-hidden bg-white">
      {children}
    </main>
  );
}
