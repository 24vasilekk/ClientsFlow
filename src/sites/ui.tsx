import { ReactNode } from "react";
import { sitesTokens } from "./tokens";

type ButtonTone = "primary" | "secondary" | "success" | "ghost";

export function SitesButton({
  tone = "primary",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  const toneClass =
    tone === "secondary"
      ? sitesTokens.buttonSecondary
      : tone === "success"
      ? sitesTokens.buttonSuccess
      : tone === "ghost"
      ? sitesTokens.buttonGhost
      : sitesTokens.buttonPrimary;
  return (
    <button {...props} className={`${sitesTokens.buttonBase} ${toneClass} ${className}`}>
      {children}
    </button>
  );
}

export function SitesInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${sitesTokens.input} ${props.className || ""}`} />;
}

export function SitesTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${sitesTokens.textarea} ${props.className || ""}`} />;
}

export function SitesCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`${sitesTokens.surface} ${className}`}>{children}</div>;
}

export function SitesBadge({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`${sitesTokens.pill} ${className}`}>{children}</span>;
}

export function SitesModal({
  open,
  title,
  description,
  children
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 text-white backdrop-blur-md">
        <p className="text-lg font-bold">{title}</p>
        {description ? <p className="mt-2 text-sm text-slate-200">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function SitesToast({
  show,
  tone = "success",
  message
}: {
  show: boolean;
  tone?: "success" | "error" | "info";
  message: string;
}) {
  if (!show) return null;
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "info"
      ? "border-cyan-200 bg-cyan-50 text-cyan-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div className="fixed bottom-5 left-1/2 z-[95] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
      <div className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${toneClass}`}>{message}</div>
    </div>
  );
}

export function SitesStepper({
  items,
  active,
  onSelect
}: {
  items: Array<{ key: string; label: string }>;
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item, index) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
              isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isActive ? "bg-white/20" : "bg-white border border-slate-200 text-slate-500"}`}>
              {index + 1}
            </span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
