import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-sm text-gray-500">页面未找到</p>
      <Link to="/" className="text-sm text-gray-900 underline underline-offset-2 hover:opacity-80">
        返回仪表盘
      </Link>
    </div>
  );
}
