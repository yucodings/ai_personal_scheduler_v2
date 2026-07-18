import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import SettingsPage from "@/app/(workspace)/settings/page";

it("switches approval modes and keeps secrets hidden", async () => {
  const user = userEvent.setup(); render(<SettingsPage />);
  await user.click(screen.getByRole("button", { name: /Milestone by milestone/ }));
  expect(screen.getByRole("button", { name: /Milestone by milestone/ })).toHaveClass("border-sky-400");
  expect(screen.getByText("Webhook secret")).toBeInTheDocument();
  expect(screen.queryByText(/bot\d+:/i)).not.toBeInTheDocument();
});

