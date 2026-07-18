import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { AppProvider } from "@/components/providers/app-provider";
import { PROJECT_IDS } from "@/lib/mock-data";

vi.mock("@/lib/ocr", () => ({
  recognizeImage: vi.fn(async (_file: File, progress: (value: number) => void) => { progress(100); return { text: "Rnbric: submit rep0rt", confidence: 87 }; }),
  recognizeScannedPdf: vi.fn(),
}));

it("lets the user correct OCR text before indexing", async () => {
  const user = userEvent.setup(); const view = render(<AppProvider><DocumentUploader projectId={PROJECT_IDS.assignment} /></AppProvider>);
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(["image"], "rubric.png", { type: "image/png" }));
  const textarea = await screen.findByLabelText("Extracted text"); expect(textarea).toHaveValue("Rnbric: submit rep0rt");
  await user.clear(textarea); await user.type(textarea, "Rubric: submit report"); await user.click(screen.getByRole("button", { name: /Index under project/ }));
  expect(await screen.findByText("File indexed successfully")).toBeInTheDocument();
});

