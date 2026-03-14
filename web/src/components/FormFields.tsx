import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type FieldWrapperProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

function FieldWrapper({ label, error, children }: FieldWrapperProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}

const fieldClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] shadow-[inset_0_1px_0_var(--card-highlight)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <input {...props} className={cn(fieldClass, className)} />
    </FieldWrapper>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export function Select({ label, error, className, children, ...props }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <select {...props} className={cn(fieldClass, className)}>
        {children}
      </select>
    </FieldWrapper>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <textarea {...props} className={cn(fieldClass, className)} />
    </FieldWrapper>
  );
}
