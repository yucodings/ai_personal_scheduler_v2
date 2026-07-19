import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { AppProvider } from "@/components/providers/app-provider";
import { apiClient } from "@/lib/api-client";
import { PROJECT_ID, workspaceFixture } from "@/tests/frontend/fixtures";

vi.mock("@/lib/ocr", () => ({
  recognizeImage: vi.fn(async (_file: File, progress: (value: number) => void) => { progress(100); return { text: "Rnbric: submit rep0rt", confidence: 87 }; }),
  recognizeScannedPdf: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

it("lets the user correct real OCR text before uploading and indexing", async () => {
  const pendingDocument = { id: "d1", projectId: PROJECT_ID, originalFilename: "rubric.png", extension: ".png", mimeType: "image/png", fileSize: 5, extractionMethod: "", extractionStatus: "pending" as const, extractedText: "", processedSummary: "", detectedDeadlines: [], detectedDeliverables: [] };
  vi.spyOn(apiClient, "uploadDocument").mockResolvedValue(pendingDocument);
  vi.spyOn(apiClient, "finalizeDocument").mockResolvedValue({ ...pendingDocument, extractionMethod: "browser_ocr", extractionStatus: "completed", extractedText: "Rubric: submit report", processedSummary: "Indexed project document." });
  const user = userEvent.setup();
  const view = render(<AppProvider initialData={workspaceFixture} loadOnMount={false}><DocumentUploader projectId={PROJECT_ID} /></AppProvider>);
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(["image"], "rubric.png", { type: "image/png" }));
  const textarea = await screen.findByLabelText("Extracted text");
  expect(textarea).toHaveValue("Rnbric: submit rep0rt");
  await user.clear(textarea);
  await user.type(textarea, "Rubric: submit report");
  await user.click(screen.getByRole("button", { name: /Upload and index/ }));
  expect(await screen.findByText("File indexed successfully")).toBeInTheDocument();
  expect(apiClient.finalizeDocument).toHaveBeenCalledWith("d1", PROJECT_ID, "Rubric: submit report", "browser_ocr", 87);
});
