"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, FileImage, FileText, Loader2, Paperclip, Send, Sparkles, User, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { CHAT_ATTACHMENT_ACCEPT, indexProjectAttachment } from "@/lib/document-processing";
import type { DocumentRecord } from "@/lib/types";

const prompts = [
  "What should I work on today?",
  "Why is this project at risk?",
  "What is overdue?",
  "What is still missing for submission?",
];

function attachmentStatus(document?: DocumentRecord) {
  if (!document) return "Ready for Skyler";
  if (document.extractionMethod.includes("ocr")) {
    const confidence = document.ocrConfidence === undefined ? "" : ` · ${document.ocrConfidence.toFixed(0)}% confidence`;
    return `OCR complete${confidence} · ready for Skyler`;
  }
  return "Text extraction complete · ready for Skyler";
}

export default function AssistantPage() {
  const { projects, activeProject, messages, addDocument, sendMessage } = useApp();
  const [projectId, setProjectId] = useState(activeProject?.id ?? "");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [attachment, setAttachment] = useState<{
    file: File;
    status: "processing" | "ready";
    progress: number;
    document?: DocumentRecord;
  } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const selectedProjectId = projectId || activeProject?.id || "";
  const attachmentReady = attachment?.status === "ready" ? attachment.document : undefined;
  const attachmentBusy = attachment?.status === "processing";

  useEffect(() => {
    const target = end.current;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages.length]);

  async function send(content = input) {
    const message = content.trim() || (attachmentReady
      ? `Please summarize ${attachmentReady.originalFilename} and identify its important tasks, deadlines, and risks.`
      : "");
    if (!message || sending || attachmentBusy) return;

    const outgoing = attachmentReady
      ? `${message}\n\nAttached file: ${attachmentReady.originalFilename}`
      : message;

    setInput("");
    setSendError("");
    setSending(true);
    try {
      if (attachmentReady) {
        await sendMessage(outgoing, selectedProjectId || undefined, attachmentReady.id);
      } else {
        await sendMessage(outgoing, selectedProjectId || undefined);
      }
      if (attachmentReady) setAttachment(null);
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : "Skyler could not send the message.");
    } finally {
      setSending(false);
    }
  }

  async function attachFile(file: File) {
    if (!selectedProjectId) {
      setSendError("Create or select a project before attaching a file to Skyler.");
      return;
    }
    setSendError("");
    setAttachment({ file, status: "processing", progress: 0 });
    try {
      const indexed = await indexProjectAttachment(selectedProjectId, file, (progress) => {
        setAttachment((current) => current?.file === file ? { ...current, progress } : current);
      });
      addDocument(indexed);
      setAttachment({ file, status: "ready", progress: 100, document: indexed });
    } catch (cause) {
      setAttachment(null);
      setSendError(cause instanceof Error ? cause.message : "Skyler could not read this attachment.");
    } finally {
      if (attachmentInput.current) attachmentInput.current.value = "";
    }
  }

  function clearAttachment() {
    setAttachment(null);
    if (attachmentInput.current) attachmentInput.current.value = "";
  }

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-sky-700">Shared AI workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ask Skyler</h1>
        <p className="mt-2 text-slate-500">Advice is conversational. Any database change appears as a proposal first.</p>
      </div>
      <Select
        aria-label="Project context"
        className="max-w-xs"
        value={selectedProjectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          clearAttachment();
        }}
      >
        {projects.filter((project) => project.status !== "archived").map((project) => (
          <option key={project.id} value={project.id}>{project.title}</option>
        ))}
      </Select>
    </div>

    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={sending || attachmentBusy}
          onClick={() => void send(prompt)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>

    <Card className="overflow-hidden">
      <div className="flex h-[620px] flex-col">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white"><Bot className="h-4 w-4" /></div>
          <div><p className="text-sm font-semibold">Skyler</p><p className="text-xs text-emerald-600">Project retrieval ready</p></div>
          <div className="ml-auto flex gap-2"><Badge tone="info">Project scoped</Badge><Badge tone="success">Actions gated</Badge></div>
        </div>

        <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto bg-slate-50/50 p-5" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><Sparkles className="h-3.5 w-3.5" /></div>}
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-700 shadow-sm"}`}>
                <p>{message.content}</p>
                {message.citations && <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sources</p>
                  {message.citations.map((citation) => (
                    <span key={`${citation.filename}-${citation.reference}`} className="mr-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      <FileText className="h-3 w-3" />{citation.filename} · {citation.reference}
                    </span>
                  ))}
                </div>}
              </div>
              {message.role === "user" && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700"><User className="h-3.5 w-3.5" /></div>}
            </div>
          ))}
          {sending && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Skyler is thinking…</div>}
          <div ref={end} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="border-t border-slate-100 bg-white p-4"
        >
          {sendError && <p role="alert" className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{sendError}</p>}
          {attachment ? <div className="mb-3 flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-sky-700"><FileImage className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{attachment.file.name}</p>
              <p className="text-xs text-sky-700">{attachment.status === "ready" ? attachmentStatus(attachment.document) : `Reading and indexing… ${attachment.progress}%`}</p>
            </div>
            {attachment.status === "processing" ? <Loader2 className="h-4 w-4 animate-spin text-sky-600" /> : <button type="button" onClick={clearAttachment} aria-label="Remove attachment"><X className="h-4 w-4" /></button>}
          </div> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              disabled={sending || attachmentBusy || !selectedProjectId}
              onClick={() => attachmentInput.current?.click()}
              aria-label="Attach image or file"
              title={selectedProjectId ? "Attach image or project file" : "Select a project first"}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={attachmentInput}
              type="file"
              accept={CHAT_ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void attachFile(file);
              }}
            />
            <textarea
              aria-label="Message Skyler"
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask about this project’s work, evidence, or risk…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
            <Button type="submit" size="icon" disabled={(!input.trim() && !attachmentReady) || sending || attachmentBusy} aria-label="Send message">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  </div>;
}
