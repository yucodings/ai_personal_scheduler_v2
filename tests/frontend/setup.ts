import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

Object.defineProperty(globalThis, "crypto", { value: { randomUUID: () => "99999999-9999-4999-8999-999999999999" }, configurable: true });
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard" }));
