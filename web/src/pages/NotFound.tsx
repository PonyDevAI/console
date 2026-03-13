import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold text-zinc-900">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-500">
        Back to Dashboard
      </Link>
    </div>
  );
}
