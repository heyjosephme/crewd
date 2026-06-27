"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ensureMe } from "@/lib/identity";
import { BottomTabs } from "./bottom-tabs";

// Standalone, non-tabbed routes: the projected big screen and the print QR poster.
const FULLSCREEN = ["/screen", "/qr"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullscreen = FULLSCREEN.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Give every visitor a default identity (local only) so Rooms/chat work without
  // Find. They become a real /screen attendee only when they tap "Find my crew".
  useEffect(() => {
    if (!fullscreen) ensureMe();
  }, [fullscreen]);

  if (fullscreen) return <>{children}</>;

  return (
    <>
      {/* pad the bottom so content never hides behind the fixed tab bar (h-16) */}
      <div className="flex min-h-[100dvh] flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomTabs />
    </>
  );
}
