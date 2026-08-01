import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import SettingsPage from "@/app/(workspace)/settings/page";
import { apiClient } from "@/lib/api-client";

afterEach(() => vi.restoreAllMocks());

it("shows real configuration state while keeping secret values hidden", async () => {
  vi.spyOn(apiClient, "serviceStatus").mockResolvedValue({ supabase: { configured: true }, deepseek: { configured: true, active: true }, mimo: { configured: true, active: false }, telegram: { configured: true } });
  const user = userEvent.setup();
  render(<SettingsPage />);
  await user.click(screen.getByRole("button", { name: /Milestone by milestone/ }));
  expect(screen.getByRole("button", { name: /Milestone by milestone/ })).toHaveClass("border-sky-400");
  expect(await screen.findByText("Active")).toBeInTheDocument();
  expect(await screen.findAllByText("Configured")).toHaveLength(3);
  expect(screen.getByText("DEEPSEEK_API_KEY")).toBeInTheDocument();
  expect(screen.getByText("TELEGRAM_WEBHOOK_SECRET")).toBeInTheDocument();
  expect(screen.queryByText(/bot\d+:/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/mock verified/i)).not.toBeInTheDocument();
});
