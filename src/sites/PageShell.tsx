import { ReactNode } from "react";
import { sitesTokens } from "./tokens";
import { SitesButton } from "./ui";

type SitesPageShellProps = {
  children: ReactNode;
  onNavigate: (path: string) => void;
};

export default function SitesPageShell({ children, onNavigate }: SitesPageShellProps) {
  return (
    <div className={`min-h-screen ${sitesTokens.pageBg}`}>
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
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

      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
