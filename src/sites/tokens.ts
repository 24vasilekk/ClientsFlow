export const sitesTokens = {
  pageBg: "bg-[#f6f8fb]",
  surface: "rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)] sm:p-6",
  surfaceSoft: "rounded-2xl border border-slate-200 bg-slate-50",
  title: "text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl",
  subtitle: "text-sm leading-6 text-slate-600",
  pill: "rounded-full border px-3 py-1 text-xs font-semibold",
  input: "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100",
  textarea:
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100",
  buttonBase:
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
  buttonPrimary: "bg-slate-900 text-white hover:bg-slate-800",
  buttonSecondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  buttonSuccess: "bg-emerald-600 text-white hover:bg-emerald-500",
  buttonGhost: "border border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200"
} as const;

export const statusTone = {
  loading: "bg-amber-50 text-amber-700 border-amber-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
  idle: "bg-slate-100 text-slate-700 border-slate-200"
} as const;
