type Size = "sm" | "md" | "lg";
type Color = "gold" | "white" | "muted";

interface LoadingSpinnerProps {
  size?: Size;
  color?: Color;
  label?: string;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

const colorClasses: Record<Color, string> = {
  gold: "border-gold/30 border-t-gold",
  white: "border-white/30 border-t-white",
  muted: "border-muted/30 border-t-muted",
};

export function LoadingSpinner({
  size = "md",
  color = "gold",
  label = "Loading…",
}: LoadingSpinnerProps) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center justify-center">
      <span
        className={[
          "animate-spin rounded-full",
          sizeClasses[size],
          colorClasses[color],
        ].join(" ")}
      />
    </span>
  );
}
