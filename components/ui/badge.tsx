import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" | "purple"; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", tone === "neutral" && "bg-slate-100 text-slate-600", tone === "success" && "bg-emerald-50 text-emerald-700", tone === "warning" && "bg-amber-50 text-amber-700", tone === "danger" && "bg-rose-50 text-rose-700", tone === "info" && "bg-sky-50 text-sky-700", tone === "purple" && "bg-violet-50 text-violet-700", className)}>{children}</span>;
}

