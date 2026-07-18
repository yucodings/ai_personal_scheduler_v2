import { cn } from "@/lib/utils";
export function Progress({ value, expected, className, label }: { value: number; expected?: number; className?: string; label?: string }) {
  return <div className={className} aria-label={label ?? `Progress ${Math.round(value)} percent`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
    <div className="relative h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full bg-sky-500 transition-all", value < (expected ?? 0) - 10 && "bg-amber-500")} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />{expected !== undefined && <span className="absolute top-0 h-2 w-0.5 bg-slate-950" style={{ left: `${Math.max(0, Math.min(100, expected))}%` }} />}</div>
  </div>;
}

