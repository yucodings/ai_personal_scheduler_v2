import { AppShell } from "@/components/dashboard/app-shell";
import { AppProvider } from "@/components/providers/app-provider";
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) { return <AppProvider><AppShell>{children}</AppShell></AppProvider>; }

