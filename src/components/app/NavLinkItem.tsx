"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkItemProps {
  href: string;
  label: string;
  icon: string;
  variant?: "top" | "bottom";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinkItem({
  href,
  label,
  icon,
  variant = "top",
}: NavLinkItemProps) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, href);

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={[
          "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[11px] font-bold transition-colors",
          isActive
            ? "bg-gold/15 text-gold"
            : "text-muted hover:bg-white/5 hover:text-white",
        ].join(" ")}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {icon}
        </span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={[
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
        isActive
          ? "bg-gold/10 text-gold"
          : "text-muted hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
