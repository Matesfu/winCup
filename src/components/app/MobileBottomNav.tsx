import { APP_NAV_ITEMS } from "./nav-items";
import { NavLinkItem } from "./NavLinkItem";

export function MobileBottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.32)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-md gap-1">
        {APP_NAV_ITEMS.map((item) => (
          <NavLinkItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            variant="bottom"
          />
        ))}
      </div>
    </nav>
  );
}
