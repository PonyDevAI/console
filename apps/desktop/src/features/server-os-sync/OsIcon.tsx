import { cn } from "../../lib/utils";
import { Monitor, Apple, Loader2, AlertTriangle } from "lucide-react";

type OsIconProps = {
  os: string;
  size?: number;
  state?: "unknown" | "syncing" | "failed" | "ok";
  className?: string;
};

export function OsIcon({ os, size = 20, state = "ok", className }: OsIconProps) {
  const icon = getOsIcon(os);

  if (state === "syncing") {
    return (
      <div className={cn("flex items-center justify-center text-[var(--info)]", className)}>
        <Loader2 size={size} className="animate-spin" />
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className={cn("flex items-center justify-center text-[var(--danger)]", className)}>
        <AlertTriangle size={size} />
      </div>
    );
  }

  if (state === "unknown") {
    return (
      <div className={cn("flex items-center justify-center text-[var(--muted)]", className)}>
        <Monitor size={size} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center text-[var(--text)]", className)}>
      {icon}
    </div>
  );
}

function getOsIcon(os: string) {
  switch (os.toLowerCase()) {
    case "macos":
    case "darwin":
      return <Apple size={20} />;
    case "ubuntu":
      return <UbuntuIcon size={20} />;
    case "debian":
      return <DebianIcon size={20} />;
    case "centos":
    case "rhel":
    case "fedora":
      return <RedHatIcon size={20} />;
    case "alpine":
      return <AlpineIcon size={20} />;
    case "windows":
      return <WindowsIcon size={20} />;
    default:
      return <Monitor size={20} />;
  }
}

/* Minimal inline SVG icons for distros not in lucide */

function UbuntuIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 7.5c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5" />
      <path d="M18.5 13.5c-1.5 2-4 3-6.5 3" />
      <path d="M5.5 13.5c1.5 2 4 3 6.5 3" />
    </svg>
  );
}

function DebianIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function RedHatIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 4-3.5 7.5-8 10-4.5-2.5-8-6-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function AlpineIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L4 21h16L12 3z" />
      <path d="M8 15l4-8 4 8" />
    </svg>
  );
}

function WindowsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  );
}
