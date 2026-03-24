import { ReactNode } from "react";
import { sitesTokens } from "./tokens";
import { SitesButton } from "./ui";

type SitesPageShellProps = {
  children: ReactNode;
  onNavigate: (path: string) => void;
};

export default function SitesPageShell({ children, onNavigate }: SitesPageShellProps) {
  return (
    <div className={`relative min-h-screen overflow-hidden ${sitesTokens.pageBg}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.16) 1px, transparent 1px)",
          backgroundSize: "56px 56px"
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-200/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute right-0 top-40 h-80 w-80 rounded-full bg-indigo-200/20 blur-3xl" />

      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">CFlow Sites</p>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Premium AI Website Builder</h1>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <SitesButton tone="secondary" className="flex-1 rounded-full sm:flex-none" onClick={() => onNavigate("/")}>Главная</SitesButton>
            <SitesButton className="flex-1 rounded-full sm:flex-none" onClick={() => onNavigate("/dashboard")}>Личный кабинет</SitesButton>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
