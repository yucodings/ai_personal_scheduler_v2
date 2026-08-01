"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertCircle, ArrowLeft, Bot, Check, CheckCircle2, ChevronRight, FileText, GitBranch, History, LayoutList, Loader2, MessageSquareText, RotateCcw, SlidersHorizontal, Sparkles, UploadCloud } from "lucide-react";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { useApp } from "@/components/providers/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import type { AiProposal, Project, Task } from "@/lib/types";
import { formatHours } from "@/lib/utils";

const tabs = ["Overview", "Tasks", "Files & knowledge", "AI analysis", "Proposals"] as const;
type Tab = typeof tabs[number];
const statusTone: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "purple"> = { not_started: "neutral", started: "info", in_progress: "info", nearly_complete: "purple", completed: "success", blocked: "danger", cancelled: "neutral" };

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { projects, tasks, documents, proposals, loading, setManualProgress, updateTask, addDocument, analyzeProject, reviewProposal } = useApp();
  const [tab, setTab] = useState<Tab>("Overview");
  const project = projects.find((item) => item.id === projectId);
  if (loading) return <div className="grid min-h-[50vh] place-items-center text-slate-500"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (!project) return <div className="py-20 text-center"><h1 className="text-2xl font-semibold">Project not found</h1><Link href="/projects" className="mt-4 inline-block text-sky-700">Back to projects</Link></div>;
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  const projectDocuments = documents.filter((document) => document.projectId === projectId);
  const projectProposals = proposals.filter((proposal) => proposal.projectId === projectId);
  return <div className="space-y-6">
    <div><Link href="/projects" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />All projects</Link><div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={project.riskStatus === "on_track" ? "success" : project.riskStatus === "at_risk" ? "warning" : "danger"}>{project.riskStatus.replaceAll("_", " ")}</Badge><Badge>{project.projectType.replaceAll("_", " ")}</Badge>{project.isActiveContext && <Badge tone="info">Active AI context</Badge>}</div><h1 className="mt-3 text-3xl font-semibold tracking-tight">{project.title}</h1><p className="mt-2 max-w-3xl text-slate-500">{project.description || "No project description yet."}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => setTab("Files & knowledge")}><UploadCloud className="h-4 w-4" />Add file</Button><Button onClick={() => setTab("AI analysis")}><Sparkles className="h-4 w-4" />Analyse project</Button></div></div></div>
    <div className="overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-1">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === item ? "border-slate-950 text-slate-950" : "border-transparent text-slate-500"}`}>{item}{item === "Proposals" && projectProposals.some((proposal) => ["pending", "partially_approved"].includes(proposal.status)) && <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">!</span>}</button>)}</div></div>
    {tab === "Overview" && <Overview project={project} tasks={projectTasks} onManual={setManualProgress} />}
    {tab === "Tasks" && <Tasks tasks={projectTasks} onUpdate={updateTask} />}
    {tab === "Files & knowledge" && <Files projectId={projectId} files={projectDocuments} addDocument={addDocument} />}
    {tab === "AI analysis" && <AiAnalysis projectId={projectId} projectTitle={project.title} onAnalyze={analyzeProject} onProposal={() => setTab("Proposals")} />}
    {tab === "Proposals" && <Proposals proposals={projectProposals} onReview={reviewProposal} />}
  </div>;
}

function Overview({ project, tasks, onManual }: { project: Project; tasks: Task[]; onManual(id: string, value: number | null): Promise<void> }) {
  const [value, setValue] = useState(String(project.manualProgress ?? project.displayedProgress));
  const [saving, setSaving] = useState(false);
  const remaining = tasks.filter((task) => !["completed", "cancelled"].includes(task.status)).reduce((sum, task) => sum + task.estimatedHours * (1 - task.progressPercent / 100), 0);
  const blocked = tasks.filter((task) => task.status === "blocked");
  const next = tasks.filter((task) => !["completed", "cancelled"].includes(task.status) && task.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  async function applyManual(nextValue: number | null) { setSaving(true); try { await onManual(project.id, nextValue); } finally { setSaving(false); } }
  return <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
    <div className="space-y-6"><Card><CardContent><div className="flex items-end gap-2"><span className="text-4xl font-semibold">{project.displayedProgress}%</span><span className="pb-1 text-sm text-slate-400">complete</span></div><div className="mt-4"><Progress value={project.displayedProgress} expected={project.expectedProgress} /></div><div className="mt-4 grid gap-4 text-sm sm:grid-cols-4"><Data label="Final deadline" value={formatDate(project.finalDeadline)} /><Data label="Internal target" value={formatDate(project.internalDeadline)} /><Data label="Remaining effort" value={formatHours(remaining)} /><Data label="Open tasks" value={String(tasks.filter((task) => !["completed", "cancelled"].includes(task.status)).length)} /></div></CardContent></Card>
      <Card><CardHeader><div><h2 className="text-lg font-semibold">Project health</h2><p className="mt-1 text-sm text-slate-500">Calculated from your real tasks and deadlines.</p></div><AlertCircle className="h-5 w-5 text-slate-400" /></CardHeader><CardContent><p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{project.riskReason}</p>{blocked.length > 0 && <div className="mt-4 space-y-2">{blocked.map((task) => <div key={task.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="font-semibold text-rose-900">{task.title}</p><p className="mt-1 text-sm text-rose-700">{task.blockedReason}</p></div>)}</div>}</CardContent></Card>
    </div>
    <div className="space-y-6"><Card><CardHeader><h2 className="text-lg font-semibold">Next task</h2></CardHeader><CardContent><p className="font-semibold">{next?.title ?? "No open tasks"}</p><p className="mt-2 text-sm text-slate-500">{next?.description || "Approve an AI plan or add work to begin tracking progress."}</p>{next?.dueDate && <p className="mt-4 text-sm">Due <strong>{formatDate(next.dueDate)}</strong></p>}</CardContent></Card>
      <Card><CardHeader><div><h2 className="text-lg font-semibold">Manual progress</h2><p className="mt-1 text-sm text-slate-500">Override the weighted calculation when necessary.</p></div><SlidersHorizontal className="h-5 w-5 text-slate-400" /></CardHeader><CardContent><Label htmlFor="manual-progress">Displayed progress</Label><div className="flex gap-2"><Input id="manual-progress" type="number" min="0" max="100" value={value} onChange={(event) => setValue(event.target.value)} /><Button disabled={saving} onClick={() => void applyManual(Number(value))}>{saving ? "Saving…" : "Apply"}</Button></div>{project.manualProgress !== null && <button className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-700" onClick={() => void applyManual(null)}><RotateCcw className="h-3.5 w-3.5" />Return to calculated progress</button>}</CardContent></Card>
    </div>
  </div>;
}

function Tasks({ tasks, onUpdate }: { tasks: Task[]; onUpdate(id: string, progress: number, status?: Task["status"], blocker?: string): Promise<void> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const grouped = useMemo(() => Object.groupBy(tasks, (task) => task.milestoneId ?? "Unassigned"), [tasks]);
  if (!tasks.length) return <Empty icon={LayoutList} title="No tasks yet" detail="Run AI analysis after uploading project files to generate a reviewable plan." />;
  async function bulkComplete() { await Promise.all(selected.map((id) => onUpdate(id, 100, "completed"))); setSelected([]); }
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Work breakdown</h2><p className="mt-1 text-sm text-slate-500">Every status update is written to Supabase.</p></div>{selected.length > 0 && <Button size="sm" onClick={() => void bulkComplete()}><Check className="h-4 w-4" />Complete {selected.length}</Button>}</div>{Object.entries(grouped).map(([group, entries]) => <Card key={group}><CardHeader><h3 className="font-semibold">{group === "Unassigned" ? group : "Milestone tasks"}</h3><Badge tone="info">{entries?.length ?? 0} tasks</Badge></CardHeader><CardContent className="space-y-2">{entries?.map((task) => <div key={task.id} className="grid gap-3 rounded-xl border border-slate-100 p-3 md:grid-cols-[auto_1fr_120px_140px] md:items-center"><input type="checkbox" aria-label={`Select ${task.title}`} checked={selected.includes(task.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))} /><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{task.title}</p><Badge tone={statusTone[task.status]}>{task.status.replaceAll("_", " ")}</Badge>{task.dependencies.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><GitBranch className="h-3 w-3" />{task.dependencies.length}</span>}</div><p className="mt-1 text-xs text-slate-500">{task.estimatedHours}h estimate{task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ""}</p></div><div><Progress value={task.progressPercent} /><p className="mt-1 text-right text-xs text-slate-400">{task.progressPercent}%</p></div><select aria-label={`Update ${task.title} status`} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={task.status} onChange={(event) => { const status = event.target.value as Task["status"]; void onUpdate(task.id, status === "completed" ? 100 : status === "not_started" ? 0 : task.progressPercent || 25, status, status === "blocked" ? task.blockedReason ?? "Blocked from the web workspace" : undefined); }}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="nearly_complete">Nearly complete</option><option value="completed">Completed</option><option value="blocked">Blocked</option></select></div>)}</CardContent></Card>)}</div>;
}

function Files({ projectId, files }: { projectId: string; files: ReturnType<typeof useApp>["documents"]; addDocument(record: ReturnType<typeof useApp>["documents"][number]): void }) {
  return <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]"><div><h2 className="text-xl font-semibold">Add project knowledge</h2><p className="mb-4 mt-1 text-sm text-slate-500">Original files remain private; extracted text is scoped to this project.</p><DocumentUploader projectId={projectId} /></div><div><h2 className="text-xl font-semibold">Knowledge library</h2><p className="mb-4 mt-1 text-sm text-slate-500">{files.length} indexed sources</p><div className="space-y-3">{files.map((file) => <Card key={file.id}><CardContent><div className="flex items-start gap-3"><FileText className="mt-1 h-5 w-5 text-sky-700" /><div><p className="font-semibold">{file.originalFilename}</p><p className="mt-1 text-sm text-slate-500">{file.processedSummary}</p></div></div></CardContent></Card>)}{!files.length && <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-500">Upload the first real project source.</div>}</div></div></div>;
}

function AiAnalysis({ projectId, projectTitle, onAnalyze, onProposal }: { projectId: string; projectTitle: string; onAnalyze(id: string): Promise<string>; onProposal(): void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  async function run() { setRunning(true); setError(""); try { setResult(await onAnalyze(projectId)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Analysis failed."); } finally { setRunning(false); } }
  return <Card className="overflow-hidden"><div className="grid lg:grid-cols-[.65fr_1.35fr]"><div className="bg-slate-950 p-7 text-white"><Sparkles className="h-7 w-7 text-sky-300" /><h2 className="mt-5 text-2xl font-semibold">Analyse {projectTitle}</h2><p className="mt-3 text-sm leading-6 text-slate-300">Skyler sends this project’s indexed text to your configured DeepSeek model and stores any proposed plan for your approval.</p><Button disabled={running} className="mt-6 bg-sky-400 text-slate-950 hover:bg-sky-300" onClick={() => void run()}>{running ? <><Loader2 className="h-4 w-4 animate-spin" />Analysing…</> : <><Bot className="h-4 w-4" />Run real analysis</>}</Button></div><div className="p-7">{result ? <><Badge tone="success">DeepSeek response</Badge><p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">{result}</p><Button className="mt-5" variant="secondary" onClick={onProposal}>Review proposals <ChevronRight className="h-4 w-4" /></Button></> : <div className="grid min-h-64 place-items-center text-center"><div><History className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 font-semibold">No analysis has run in this session.</p><p className="mt-1 text-sm text-slate-500">Configure <code>DEEPSEEK_API_KEY</code> in Vercel before running analysis.</p>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}</div></div>}</div></div></Card>;
}

function Proposals({ proposals, onReview }: { proposals: AiProposal[]; onReview(id: string, action: "approve" | "reject" | "approve_milestone", milestoneId?: string): Promise<void> }) {
  if (!proposals.length) return <Empty icon={MessageSquareText} title="No proposals yet" detail="Run AI analysis to create a plan you can review before applying." />;
  return <div className="space-y-5">{proposals.map((proposal) => <Card key={proposal.id}><CardHeader><div><Badge tone={proposal.status === "approved" ? "success" : proposal.status === "rejected" ? "danger" : "warning"}>{proposal.status.replaceAll("_", " ")}</Badge><h2 className="mt-3 text-xl font-semibold">AI plan proposal</h2><p className="mt-2 text-sm text-slate-500">{proposal.summary}</p></div><Sparkles className="h-5 w-5 text-violet-500" /></CardHeader><CardContent><div className="space-y-3">{proposal.milestones.map((milestone) => <div key={milestone.id} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold">{milestone.title}</p><p className="mt-1 text-sm text-slate-500">{milestone.tasks.length} tasks · {milestone.estimatedHours}h{milestone.dueDate ? ` · due ${formatDate(milestone.dueDate)}` : ""}</p></div>)}</div>{["pending", "partially_approved"].includes(proposal.status) && <div className="mt-5 flex justify-end gap-2"><Button variant="danger" onClick={() => void onReview(proposal.id, "reject")}>Reject</Button><Button onClick={() => void onReview(proposal.id, "approve")}><CheckCircle2 className="h-4 w-4" />Approve full plan</Button></div>}</CardContent></Card>)}</div>;
}

function Empty({ icon: Icon, title, detail }: { icon: typeof LayoutList; title: string; detail: string }) { return <div className="rounded-3xl border border-dashed border-slate-300 py-20 text-center"><Icon className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>; }
function Data({ label, value }: { label: string; value: string }) { return <div><p className="text-slate-400">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function formatDate(value?: string) { return value ? format(parseISO(value), "d MMM yyyy") : "—"; }
