"use client";

import { Compass, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Exactly three tabs. /screen and /qr are standalone (handled by AppShell, not here).
const TABS = [
  { href: "/", label: "Find", Icon: Compass, active: (p: string) => p === "/" },
  {
    href: "/rooms",
    label: "Rooms",
    Icon: Users,
    active: (p: string) => p.startsWith("/rooms"),
  },
  {
    href: "/me",
    label: "Me",
    Icon: UserRound,
    active: (p: string) => p === "/me" || p.startsWith("/result"),
  },
];

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 backdrop-blur-lg">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, Icon, active }) => {
          const isActive = active(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("size-5 transition-transform", isActive && "scale-110")}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
