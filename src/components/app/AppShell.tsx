import type { ReactNode } from "react";
import { MobileBottomNav } from "./MobileBottomNav";
import { TopAppBar } from "./TopAppBar";

interface AppShellProps {
  children: ReactNode;
  userLabel: string;
}

export function AppShell({ children, userLabel }: AppShellProps) {
  return (
    <main className="min-h-screen bg-background pb-24 md:pb-0">
      <TopAppBar userLabel={userLabel} />
      {children}
      <MobileBottomNav />
    </main>
  );
}
