import { forwardRef, type InputHTMLAttributes, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  showCount?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, showCount, className = "", id: idProp, maxLength, value, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const descId = `${id}-desc`;
    const hasDesc = !!(error || helperText);

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium text-white">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            aria-invalid={!!error}
            aria-describedby={hasDesc ? descId : undefined}
            maxLength={maxLength}
            value={value}
            className={[
              "w-full rounded-xl bg-surface px-4 py-3 text-sm text-white placeholder:text-muted",
              "border transition-colors duration-200 outline-none",
              "focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-background",
              error
                ? "border-danger focus:ring-danger"
                : "border-white/10 focus:border-gold",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
          {showCount && maxLength !== undefined && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              {typeof value === "string" ? value.length : 0}/{maxLength}
            </span>
          )}
        </div>
        {hasDesc && (
          <p
            id={descId}
            className={`text-xs ${error ? "text-danger" : "text-muted"}`}
          >
            {error ?? helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
