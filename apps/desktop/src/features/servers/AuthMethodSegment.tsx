type AuthMethodSegmentProps = {
  value: "password" | "private_key";
  onChange?: (method: "password" | "private_key") => void;
};

export function AuthMethodSegment({ value, onChange }: AuthMethodSegmentProps) {
  return (
    <div className="flex rounded-[var(--radius-md)] border border-[var(--border)] p-0.5">
      <button
        type="button"
        onClick={() => onChange?.("password")}
        className={`flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-medium transition-colors ${
          value === "password"
            ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
      >
        Password
      </button>
      <button
        type="button"
        onClick={() => onChange?.("private_key")}
        className={`flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-medium transition-colors ${
          value === "private_key"
            ? "bg-[var(--bg-selected)] text-[var(--text-strong)]"
            : "text-[var(--muted)] hover:text-[var(--text)]"
        }`}
      >
        Private Key
      </button>
    </div>
  );
}
