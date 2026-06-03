import type { ReactNode } from "react";
import { PageBackdrop } from "@/components/ui/PageBackdrop";
import { MobileBottomNav } from "./MobileBottomNav";
import { TopAppBar } from "./TopAppBar";

interface AppShellProps {
  children: ReactNode;
  userLabel: string;
  backgroundImage?: string;
}

export function AppShell({
  children,
  userLabel,
  backgroundImage,
}: AppShellProps) {
  return (
    <main className="relative min-h-screen bg-background pb-24 md:pb-0">
      {backgroundImage && <PageBackdrop imageSrc={backgroundImage} />}
      <div className="relative z-10 flex min-h-screen flex-col">
        <TopAppBar userLabel={userLabel} />
        {children}
      </div>
      <MobileBottomNav />
    </main>
  );
}
