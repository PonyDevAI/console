import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-4xl font-bold text-[var(--text-strong)]">404</h1>
      <p className="text-sm text-[var(--muted)]">页面未找到</p>
      <Link to="/" className="text-sm text-[var(--accent)] hover:opacity-80">
        返回仪表盘
      </Link>
    </div>
  );
}
