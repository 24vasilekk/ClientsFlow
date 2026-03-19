import { motion } from "framer-motion";
import type { ReactNode } from "react";

const reveal = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={reveal}
      transition={{ duration: 0.45 }}
      className={`rounded-3xl border border-slate-200 bg-white shadow-soft ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  badge
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
      {badge ? (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">{badge}</p>
      ) : null}
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-4 text-base text-slate-600 sm:text-lg">{subtitle}</p> : null}
    </div>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
      {children}
    </span>
  );
}

export function PrimaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 ${className}`}
    >
      {children}
    </button>
  );
}

export function GateNotice({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
      {text}
    </div>
  );
}
