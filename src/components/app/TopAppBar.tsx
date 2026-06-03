import Link from "next/link";
import { signOut } from "@/actions/auth";
import { APP_NAV_ITEMS } from "./nav-items";
import { NavLinkItem } from "./NavLinkItem";
import { UserMenu } from "./UserMenu";

interface TopAppBarProps {
  userLabel: string;
}

export function TopAppBar({ userLabel }: TopAppBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-extrabold text-gold">
          <span aria-hidden="true">🏆</span>
          <span>WinCup</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {APP_NAV_ITEMS.map((item) => (
            <NavLinkItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </nav>

        <div className="hidden md:block">
          <UserMenu userLabel={userLabel} />
        </div>

        <details className="relative md:hidden">
          <summary
            aria-label="Open menu"
            className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-surface text-lg text-white transition-colors hover:border-white/20"
          >
            ☰
          </summary>
          <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/10 bg-surface p-2 shadow-lift">
            <p className="px-3 py-2 text-xs text-muted">
              Signed in as <span className="font-semibold text-white">{userLabel}</span>
            </p>
            <div className="flex flex-col gap-1">
              {APP_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
                >
                  <span aria-hidden="true" className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
            <form action={signOut} className="mt-2 border-t border-white/10 pt-2">
              <button
                type="submit"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                Sign Out
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
