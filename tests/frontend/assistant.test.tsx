import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import AssistantPage from "@/app/(workspace)/assistant/page";
import { useApp } from "@/components/providers/app-provider";
import { apiClient } from "@/lib/api-client";

vi.mock("@/components/providers/app-provider", () => ({ useApp: vi.fn() }));
vi.mock("@/lib/ocr", () => ({
  recognizeImage: vi.fn(async (_file: File, progress: (value: number) => void) => {
    progress(100);
    return { text: "Submission deadline: Friday", confidence: 92 };
  }),
  recognizeScannedPdf: vi.fn(),
}));

const mockedUseApp = vi.mocked(useApp);

beforeEach(() => {
  vi.clearAllMocks();
});

function appState(sendMessage: ReturnType<typeof vi.fn>, addDocument = vi.fn()) {
  return {
    projects: [{ id: "project-1", title: "Project One", status: "active" }],
    activeProject: { id: "project-1" },
    messages: [],
    addDocument,
    sendMessage,
  } as unknown as ReturnType<typeof useApp>;
}

it("submits once with Enter and keeps the user on the chat page", async () => {
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  mockedUseApp.mockReturnValue(appState(sendMessage));
  const user = userEvent.setup();
  render(<AssistantPage />);

  await user.type(screen.getByRole("textbox", { name: "Message Skyler" }), "hello{enter}");

  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(sendMessage).toHaveBeenCalledWith("hello", "project-1");
  expect(screen.getByRole("heading", { name: "Ask Skyler" })).toBeInTheDocument();
});

it("shows a failed send inside the chat instead of throwing to the route boundary", async () => {
  const sendMessage = vi.fn().mockRejectedValue(new Error("DeepSeek request failed"));
  mockedUseApp.mockReturnValue(appState(sendMessage));
  const user = userEvent.setup();
  render(<AssistantPage />);

  await user.type(screen.getByRole("textbox", { name: "Message Skyler" }), "hello{enter}");

  expect(await screen.findByRole("alert")).toHaveTextContent("DeepSeek request failed");
  expect(screen.getByRole("heading", { name: "Ask Skyler" })).toBeInTheDocument();
});

it("OCRs an attached image, indexes it, and sends it as Skyler context", async () => {
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  const addDocument = vi.fn();
  const pendingDocument = {
    id: "document-1",
    projectId: "project-1",
    originalFilename: "rubric.png",
    extension: ".png",
    mimeType: "image/png",
    fileSize: 5,
    extractionMethod: "",
    extractionStatus: "pending" as const,
    extractedText: "",
    processedSummary: "",
    detectedDeadlines: [],
    detectedDeliverables: [],
  };
  const indexedDocument = {
    ...pendingDocument,
    extractionMethod: "browser_ocr",
    extractionStatus: "completed" as const,
    extractedText: "Submission deadline: Friday",
    ocrConfidence: 92,
  };
  vi.spyOn(apiClient, "uploadDocument").mockResolvedValue(pendingDocument);
  vi.spyOn(apiClient, "finalizeDocument").mockResolvedValue(indexedDocument);
  mockedUseApp.mockReturnValue(appState(sendMessage, addDocument));
  const user = userEvent.setup();
  const view = render(<AssistantPage />);
  const fileInput = view.container.querySelector('input[type="file"]') as HTMLInputElement;

  await user.upload(fileInput, new File(["image"], "rubric.png", { type: "image/png" }));

  expect(await screen.findByText("OCR complete · 92% confidence · ready for Skyler")).toBeInTheDocument();
  expect(apiClient.finalizeDocument).toHaveBeenCalledWith(
    "document-1",
    "project-1",
    "Submission deadline: Friday",
    "browser_ocr",
    92,
  );
  expect(addDocument).toHaveBeenCalledWith(indexedDocument);

  await user.type(screen.getByRole("textbox", { name: "Message Skyler" }), "What is the deadline?{enter}");

  expect(sendMessage).toHaveBeenCalledWith(
    "What is the deadline?\n\nAttached file: rubric.png",
    "project-1",
    "document-1",
  );
});
