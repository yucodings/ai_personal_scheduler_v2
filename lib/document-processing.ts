"use client";

import { apiClient } from "@/lib/api-client";
import { recognizeImage, recognizeScannedPdf } from "@/lib/ocr";
import type { DocumentRecord } from "@/lib/types";

export const CHAT_ATTACHMENT_ACCEPT = ".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.zip";
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const imageExtensions = new Set([".png", ".jpg", ".jpeg"]);
const supportedExtensions = new Set(CHAT_ATTACHMENT_ACCEPT.split(","));

function extensionOf(filename: string) {
  const suffix = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  return suffix;
}

export async function indexProjectAttachment(
  projectId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<DocumentRecord> {
  const extension = extensionOf(file.name);
  if (!supportedExtensions.has(extension)) {
    throw new Error("Unsupported file type. Use PDF, Office, text, image, or ZIP files.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("The attachment is larger than the 25 MB upload limit.");
  }

  let text = "";
  let confidence: number | undefined;
  let extractionMethod = "";
  if (imageExtensions.has(extension)) {
    const result = await recognizeImage(file, onProgress);
    text = result.text.trim();
    confidence = result.confidence;
    extractionMethod = "browser_ocr";
  } else if (extension === ".pdf") {
    const result = await recognizeScannedPdf(file, onProgress, 8);
    text = result.text.trim();
    confidence = result.confidence;
    extractionMethod = "browser_pdf_ocr";
  }

  if ((imageExtensions.has(extension) || extension === ".pdf") && !text) {
    throw new Error("Skyler could not find readable text in this image or PDF.");
  }

  const uploaded = await apiClient.uploadDocument(projectId, file);
  if (text) {
    return apiClient.finalizeDocument(uploaded.id, projectId, text, extractionMethod, confidence);
  }
  onProgress?.(100);
  return apiClient.extractDocument(uploaded.id, projectId, file);
}
