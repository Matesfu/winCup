import { type ReactNode, type HTMLAttributes } from "react";

type Variant = "default" | "gold" | "success" | "danger";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-white/10 text-white",
  gold:    "bg-gold/15 text-gold",
  success: "bg-success/15 text-success",
  danger:  "bg-danger/15 text-danger",
};

export function Badge({ children, variant = "default", className = "", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
