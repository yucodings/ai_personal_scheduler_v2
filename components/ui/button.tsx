import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "icon" };
export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50", variant === "primary" && "bg-slate-950 text-white hover:bg-slate-800", variant === "secondary" && "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50", variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-slate-950", variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700", size === "sm" && "h-9 px-3 text-sm", size === "md" && "h-11 px-4 text-sm", size === "icon" && "h-10 w-10", className)} {...props} />;
}

