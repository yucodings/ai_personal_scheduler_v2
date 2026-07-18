"use client";

export interface OcrResult { text: string; confidence: number }

export async function recognizeImage(file: File | Blob, onProgress?: (progress: number) => void, language = "eng"): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js"); const worker = await createWorker(language, 1, { logger: (message) => { if (message.status === "recognizing text") onProgress?.(Math.round(message.progress * 100)); } });
  try { const result = await worker.recognize(file); return { text: result.data.text, confidence: result.data.confidence }; } finally { await worker.terminate(); }
}

export async function recognizeScannedPdf(file: File, onProgress?: (progress: number) => void, maxPages = 8): Promise<OcrResult> {
  const pdfjs = await import("pdfjs-dist"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; const pageCount = Math.min(document.numPages, maxPages); const pieces: string[] = []; let confidence = 0;
  for (let index = 1; index <= pageCount; index++) { const page = await document.getPage(index); const viewport = page.getViewport({ scale: 1.8 }); const canvas = window.document.createElement("canvas"); canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height); const context = canvas.getContext("2d"); if (!context) continue; await page.render({ canvasContext: context, canvas, viewport }).promise; const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not render PDF page")), "image/png")); const result = await recognizeImage(blob, (pageProgress) => onProgress?.(Math.round(((index - 1 + pageProgress / 100) / pageCount) * 100))); pieces.push(`[Page ${index}]\n${result.text}`); confidence += result.confidence; }
  return { text: pieces.join("\n\n"), confidence: pageCount ? confidence / pageCount : 0 };
}
