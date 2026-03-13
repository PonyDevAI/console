import type { ReactNode } from "react";

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-zinc-300 bg-white p-4">
      <h2 className="mb-2 text-base font-semibold text-zinc-900">{title}</h2>
      {children}
    </article>
  );
}
