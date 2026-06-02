import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  lift?: boolean;
}

export function Card({ lift = false, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={[
        "bg-surface rounded-2xl p-6",
        lift ? "hover-lift cursor-pointer" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
