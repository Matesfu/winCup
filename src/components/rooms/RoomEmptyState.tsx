import { Button } from "@/components/ui/Button";

interface RoomEmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function RoomEmptyState({
  icon = "🏟️",
  title,
  message,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: RoomEmptyStateProps) {
  return (
    <div className="rounded-3xl border border-white/8 bg-surface/70 p-6 text-center">
      <div className="text-4xl" aria-hidden="true">
        {icon}
      </div>
      <h3 className="mt-3 text-lg font-bold text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{message}</p>
      {(primaryHref || secondaryHref) && (
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          {primaryHref && primaryLabel && (
            <Button href={primaryHref} variant="primary" size="sm">
              {primaryLabel}
            </Button>
          )}
          {secondaryHref && secondaryLabel && (
            <Button href={secondaryHref} variant="outline" size="sm">
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
