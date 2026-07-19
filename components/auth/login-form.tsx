"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { loginSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = loginSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter your password");
      return;
    }
    setLoading(true);
    try {
      await apiClient.login(password);
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <div className="mb-8"><div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm"><LockKeyhole className="h-5 w-5" /></div><h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1><p className="mt-2 text-slate-500">Enter your private workspace password.</p></div>
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <div><Label htmlFor="password">Password</Label><div className="relative"><Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="pr-12" aria-describedby={error ? "login-error" : undefined} autoFocus /><button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1 top-1 grid h-9 w-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{error && <p id="login-error" className="mt-2 text-sm text-rose-600" role="alert">{error}</p>}</div>
      <Button className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Unlocking…" : "Open workspace"}</Button>
    </form>
  </>;
}
