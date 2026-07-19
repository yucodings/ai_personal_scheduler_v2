"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, Check, CircleAlert, Clock3, FolderKanban, Loader2, TrendingUp } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatHours } from "@/lib/utils";

export default function DashboardPage() {
  const { projects, tasks, dailyPlan, loading, error, updateTask } = useApp();
  const active = projects.filter((project) => !["completed", "archived"].includes(project.status));
  const blocked = tasks.filter((task) => task.status === "blocked");
  const atRisk = active.filter((project) => ["at_risk", "delayed", "blocked"].includes(project.riskStatus));
  const averageProgress = active.length ? Math.round(active.reduce((sum, project) => sum + project.displayedProgress, 0) / active.length) : 0;
  const todayLabel = format(new Date(), "EEEE · d MMMM yyyy");

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-slate-500"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin" /><p className="mt-3">Loading your workspace…</p></div></div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800"><strong>Workspace could not load.</strong><p className="mt-1 text-sm">{error}</p></div>;

  return <div className="space-y-7">
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-sky-700">{todayLabel}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Your project workspace</h1><p className="mt-2 max-w-2xl text-slate-500">Live data from your Supabase database.</p></div><Link href={dailyPlan ? "/daily-plan" : "/projects"}><Button variant="secondary">{dailyPlan ? "View today’s plan" : "Create your first project"} <ArrowRight className="h-4 w-4" /></Button></Link></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={FolderKanban} label="Open projects" value={String(active.length)} detail={`${atRisk.length} need attention`} /><Metric icon={TrendingUp} label="Overall progress" value={`${averageProgress}%`} detail="Weighted across open projects" /><Metric icon={Clock3} label="Planned today" value={formatHours(dailyPlan?.totalPlannedHours ?? 0)} detail={`${dailyPlan?.items.length ?? 0} focus blocks`} /><Metric icon={CircleAlert} label="Blocked tasks" value={String(blocked.length)} detail="Resolve blockers before dependants" alert={blocked.length > 0} /></section>
    {!projects.length && <Card><CardContent className="py-16 text-center"><FolderKanban className="mx-auto h-8 w-8 text-slate-300" /><h2 className="mt-3 text-xl font-semibold">No projects yet</h2><p className="mt-2 text-sm text-slate-500">Create a project to start tracking real deadlines, files, tasks, and AI proposals.</p><Link href="/projects"><Button className="mt-5">Open projects</Button></Link></CardContent></Card>}
    {projects.length > 0 && <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <Card><CardHeader><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-600">Today’s focus</p><h2 className="mt-1 text-xl font-semibold">{dailyPlan ? dailyPlan.summary : "No plan generated yet"}</h2></div></CardHeader><CardContent>{dailyPlan?.items.length ? <div className="space-y-2">{dailyPlan.items.map((item) => { const task = tasks.find((entry) => entry.id === item.taskId); const done = task?.status === "completed" || item.completed; return <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"><button aria-label={`Complete ${item.title}`} disabled={!task || done} onClick={() => task && void updateTask(task.id, 100, "completed")} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-slate-300"}`}><Check className="h-4 w-4" /></button><div className="min-w-0 flex-1"><p className="font-semibold">{item.title}</p><p className="text-sm text-slate-500">{item.projectTitle} · {item.reason}</p></div><span className="text-sm font-semibold">{formatHours(item.plannedMinutes / 60)}</span></div>; })}</div> : <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">The morning workflow will create a plan after you have open tasks.</div>}</CardContent></Card>
      <Card><CardHeader><h2 className="text-lg font-semibold">Upcoming deadlines</h2></CardHeader><CardContent>{active.length ? <div className="space-y-3">{active.slice().sort((a, b) => a.finalDeadline.localeCompare(b.finalDeadline)).slice(0, 5).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-xl border border-slate-100 p-3 hover:border-sky-200"><p className="font-medium">{project.title}</p><p className="mt-1 text-sm text-slate-500">{format(parseISO(project.finalDeadline), "d MMM yyyy")} · {project.riskStatus.replaceAll("_", " ")}</p></Link>)}</div> : <p className="text-sm text-slate-500">No open project deadlines.</p>}</CardContent></Card>
    </section>}
  </div>;
}

function Metric({ icon: Icon, label, value, detail, alert = false }: { icon: typeof FolderKanban; label: string; value: string; detail: string; alert?: boolean }) {
  return <Card><CardContent className="flex items-start gap-4"><div className={`grid h-11 w-11 place-items-center rounded-2xl ${alert ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-700"}`}><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-semibold">{value}</p><p className={`mt-1 text-xs ${alert ? "text-rose-600" : "text-slate-400"}`}>{detail}</p></div></CardContent></Card>;
}
