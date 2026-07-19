"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileSearch, Loader2, ScanText, UploadCloud, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { apiClient } from "@/lib/api-client";
import { recognizeImage, recognizeScannedPdf } from "@/lib/ocr";

const accepted = ".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.zip";
type Stage = "idle" | "processing" | "review" | "saving" | "saved";

export function DocumentUploader({ projectId }: { projectId: string }) {
  const { addDocument } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(0);
  const [confidence, setConfidence] = useState<number>();
  const [serverExtraction, setServerExtraction] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");

  async function process(selected: File) {
    setFile(selected);
    setError("");
    setProgress(0);
    setConfidence(undefined);
    setServerExtraction(false);
    setStage("processing");
    try {
      const extension = `.${selected.name.split(".").pop()?.toLowerCase()}`;
      if ([".png", ".jpg", ".jpeg"].includes(extension)) {
        const result = await recognizeImage(selected, setProgress);
        setText(result.text);
        setConfidence(result.confidence);
      } else if (extension === ".pdf") {
        setProgress(10);
        const result = await recognizeScannedPdf(selected, setProgress, 5);
        setText(result.text || "");
        setConfidence(result.confidence);
      } else {
        setServerExtraction(true);
        setProgress(100);
      }
      setStage("review");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Extraction failed");
      setStage("idle");
    }
  }

  async function save() {
    if (!file || (!serverExtraction && !text.trim())) return;
    setError("");
    setStage("saving");
    try {
      const uploaded = await apiClient.uploadDocument(projectId, file);
      const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      const indexed = serverExtraction
        ? await apiClient.extractDocument(uploaded.id, projectId, file)
        : await apiClient.finalizeDocument(uploaded.id, projectId, text, extension === ".pdf" ? "browser_pdf_ocr" : "browser_ocr", confidence);
      addDocument(indexed);
      setStage("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The document could not be indexed.");
      setStage("review");
    }
  }

  function reset() {
    setFile(null);
    setText("");
    setProgress(0);
    setConfidence(undefined);
    setServerExtraction(false);
    setStage("idle");
    setError("");
    if (input.current) input.current.value = "";
  }

  if (stage === "review" || stage === "saving") return <Card className="border-sky-200"><CardContent>
    <div className="flex items-start justify-between"><div><p className="font-semibold">{serverExtraction ? "Ready for secure server extraction" : "Review extracted text"}</p><p className="mt-1 text-sm text-slate-500">{serverExtraction ? `${file?.name} will be uploaded privately and parsed on the server.` : `Correct OCR mistakes before indexing ${file?.name}.`}</p></div><button onClick={reset} aria-label="Cancel upload"><X className="h-5 w-5 text-slate-400" /></button></div>
    {!serverExtraction && <>{confidence !== undefined && <p className="mt-4 text-xs font-semibold text-sky-700">OCR confidence {confidence.toFixed(0)}%</p>}<Textarea aria-label="Extracted text" className="mt-3 min-h-64 font-mono text-xs leading-5" value={text} onChange={(event) => setText(event.target.value)} /></>}
    {serverExtraction && <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">The app will extract real content from this file. It will not insert placeholder text.</div>}
    {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={reset}>Cancel</Button><Button onClick={() => void save()} disabled={stage === "saving"}>{stage === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" />Indexing…</> : <><FileSearch className="h-4 w-4" />Upload and index</>}</Button></div>
  </CardContent></Card>;

  if (stage === "saved") return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" /><p className="mt-2 font-semibold text-emerald-900">File indexed successfully</p><p className="mt-1 text-sm text-emerald-700">Skyler can now retrieve project-specific evidence from it.</p><Button className="mt-4" size="sm" variant="secondary" onClick={reset}>Upload another</Button></div>;

  return <div><button type="button" onClick={() => input.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDrag(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); const selected = event.dataTransfer.files[0]; if (selected) void process(selected); }} className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
    {stage === "processing" ? <><Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-600" /><p className="mt-3 font-semibold">Preparing {file?.name}</p><div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-slate-500">{progress}% · Images and scanned PDFs use browser OCR</p></> : <><UploadCloud className="mx-auto h-9 w-9 text-slate-400" /><p className="mt-3 font-semibold">Drop a project file here</p><p className="mt-1 text-sm text-slate-500">PDF, Office, text, images, or safe ZIP · max 25 MB</p><div className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"><ScanText className="h-3.5 w-3.5" />Real extraction only—no placeholder content</div></>}
    <input ref={input} type="file" accept={accepted} className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void process(selected); }} />
  </button>{error && <p className="mt-2 text-sm text-rose-600">{error}</p>}</div>;
}
