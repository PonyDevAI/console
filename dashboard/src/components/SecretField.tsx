import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState, type InputHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type SecretFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  error?: string;
};

const fieldClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 pr-10 text-sm text-[var(--text)] shadow-[inset_0_1px_0_var(--card-highlight)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30";

export default function SecretField({ label, error, className, value, onChange, ...props }: SecretFieldProps) {
  const [visible, setVisible] = useState(false);
  const maskedValue = useMemo(() => {
    if (!value) return "";
    return "••••••••";
  }, [value]);

  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{label}</span> : null}
      <div className="relative">
        <input
          {...props}
          value={visible ? value : maskedValue}
          readOnly={!visible && Boolean(onChange)}
          onChange={onChange}
          className={cn(fieldClass, className)}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] cursor-pointer"
          aria-label={visible ? "Hide secret" : "Show secret"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <span className="mt-1 block text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}
