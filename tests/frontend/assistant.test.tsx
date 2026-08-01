import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import AssistantPage from "@/app/(workspace)/assistant/page";
import { useApp } from "@/components/providers/app-provider";

vi.mock("@/components/providers/app-provider", () => ({ useApp: vi.fn() }));

const mockedUseApp = vi.mocked(useApp);

beforeEach(() => {
  vi.clearAllMocks();
});

function appState(sendMessage: ReturnType<typeof vi.fn>) {
  return {
    projects: [{ id: "project-1", title: "Project One", status: "active" }],
    activeProject: { id: "project-1" },
    messages: [],
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
