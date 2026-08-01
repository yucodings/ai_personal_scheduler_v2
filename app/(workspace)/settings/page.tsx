"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Clock3, Database, Loader2, Send, ShieldCheck, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { apiClient, type ServiceName, type ServiceStatus } from "@/lib/api-client";

const services: { name: ServiceName; title: string; detail: string; variables: string[]; icon: typeof Database }[] = [
  { name: "supabase", title: "Supabase", detail: "Database + private storage", variables: ["SUPABASE_URL", "SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY (legacy)"], icon: Database },
  { name: "deepseek", title: "DeepSeek", detail: "Active structured planning + chat", variables: ["AI_PROVIDER=deepseek", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL (optional)"], icon: Bot },
  { name: "mimo", title: "Xiaomi MiMo", detail: "Structured planning + chat", variables: ["MIMO_API_KEY"], icon: Bot },
  { name: "telegram", title: "Telegram", detail: "Webhook + daily workflows", variables: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET"], icon: Send },
];

export default function SettingsPage() {
  const [mode, setMode] = useState("full_plan");
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [testing, setTesting] = useState<ServiceName | null>(null);
  const [results, setResults] = useState<Partial<Record<ServiceName, { ok: boolean; message: string }>>>({});

  useEffect(() => {
    apiClient.serviceStatus().then(setStatus).catch((cause) => setStatusError(cause instanceof Error ? cause.message : "Could not load service status."));
  }, []);

  async function testService(name: ServiceName) {
    setTesting(name);
    setResults((current) => ({ ...current, [name]: undefined }));
    try {
      const result = await apiClient.testService(name);
      setResults((current) => ({ ...current, [name]: { ok: result.connected, message: result.message } }));
    } catch (cause) {
      setResults((current) => ({ ...current, [name]: { ok: false, message: cause instanceof Error ? cause.message : "Connection test failed." } }));
    } finally {
      setTesting(null);
    }
  }

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-sky-700">Preferences & connections</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-slate-500">Credentials are read securely from Vercel environment variables and are never exposed in this page.</p></div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><div><h2 className="text-lg font-semibold">Planning preferences</h2><p className="mt-1 text-sm text-slate-500">Used by deterministic daily planning and reminders.</p></div><Clock3 className="h-5 w-5 text-slate-400" /></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="timezone">Timezone</Label><Input id="timezone" value="Asia/Kuala_Lumpur" readOnly /></div><div><Label htmlFor="morning">Morning reminder</Label><Input id="morning" type="time" defaultValue="08:00" /></div><div><Label htmlFor="evening">Evening reminder</Label><Input id="evening" type="time" defaultValue="20:00" /></div><div><Label htmlFor="capacity">Daily work limit</Label><Input id="capacity" type="number" min="1" max="24" step="0.5" defaultValue="6" /></div><div><Label htmlFor="duration">Default task duration</Label><Select id="duration" className="w-full" defaultValue="60"><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></Select></div></CardContent></Card>
      <Card><CardHeader><div><h2 className="text-lg font-semibold">Plan approval mode</h2><p className="mt-1 text-sm text-slate-500">Skyler asks before applying generated plans or date changes.</p></div><ShieldCheck className="h-5 w-5 text-slate-400" /></CardHeader><CardContent className="space-y-3"><button onClick={() => setMode("full_plan")} className={`w-full rounded-2xl border p-4 text-left ${mode === "full_plan" ? "border-sky-400 bg-sky-50" : "border-slate-200"}`}><div className="flex items-center justify-between"><p className="font-semibold">Approve entire plan</p>{mode === "full_plan" && <CheckCircle2 className="h-5 w-5 text-sky-600" />}</div><p className="mt-1 text-sm text-slate-500">Review everything, edit if needed, then approve in one transaction.</p></button><button onClick={() => setMode("milestone_by_milestone")} className={`w-full rounded-2xl border p-4 text-left ${mode === "milestone_by_milestone" ? "border-sky-400 bg-sky-50" : "border-slate-200"}`}><div className="flex items-center justify-between"><p className="font-semibold">Milestone by milestone</p>{mode === "milestone_by_milestone" && <CheckCircle2 className="h-5 w-5 text-sky-600" />}</div><p className="mt-1 text-sm text-slate-500">Approve milestones and individual tasks gradually.</p></button></CardContent></Card>
    </div>
    <Card>
      <CardHeader><div><h2 className="text-lg font-semibold">Service connections</h2><p className="mt-1 text-sm text-slate-500">Add the listed variables in Vercel → Project → Settings → Environment Variables, then redeploy.</p></div><Badge tone="success">Production data</Badge></CardHeader>
      <CardContent>
        {statusError && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{statusError}</p>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{services.map((service) => {
          const configured = status?.[service.name].configured ?? false;
          const active = status?.[service.name].active ?? false;
          const result = results[service.name];
          return <div key={service.name} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><service.icon className="h-5 w-5" /></div><Badge tone={configured ? "success" : "warning"}>{status ? active ? "Active" : configured ? "Configured" : "Missing values" : "Checking…"}</Badge></div>
            <p className="mt-4 font-semibold">{service.title}</p><p className="mt-1 text-sm text-slate-500">{service.detail}</p>
            <div className="mt-3 space-y-1">{service.variables.map((variable) => <code key={variable} className="block break-all text-[11px] text-slate-500">{variable}</code>)}</div>
            {result && <p className={`mt-3 text-xs ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>{result.message}</p>}
            <Button variant="secondary" size="sm" className="mt-4 w-full" disabled={!configured || testing === service.name} onClick={() => void testService(service.name)}>{testing === service.name ? <><Loader2 className="h-4 w-4 animate-spin" />Testing…</> : "Test connection"}</Button>
          </div>;
        })}</div>
      </CardContent>
    </Card>
    <Card><CardHeader><div><h2 className="text-lg font-semibold">Telegram security</h2><p className="mt-1 text-sm text-slate-500">Only your configured chat ID is accepted.</p></div><Smartphone className="h-5 w-5 text-slate-400" /></CardHeader><CardContent><p className="text-sm leading-6 text-slate-600">After the Telegram card reports “Configured,” press <strong>Test connection</strong>. A real message will be sent to <code>TELEGRAM_ALLOWED_CHAT_ID</code>. Then register the webhook using the deployment URL.</p></CardContent></Card>
  </div>;
}
