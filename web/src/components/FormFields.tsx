import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldWrapperProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

function FieldWrapper({ label, error, children }: FieldWrapperProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <input
        {...props}
        className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-500 ${className}`}
      />
    </FieldWrapper>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

export function Select({ label, error, className = "", children, ...props }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <select
        {...props}
        className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-500 ${className}`}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export function Textarea({ label, error, className = "", ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <textarea
        {...props}
        className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-500 ${className}`}
      />
    </FieldWrapper>
  );
}
