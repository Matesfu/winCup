"use client";

import { forwardRef, useState, useId, type InputHTMLAttributes } from "react";

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  helperText?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, helperText, className = "", id: idProp, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
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
            type={visible ? "text" : "password"}
            aria-invalid={!!error}
            aria-describedby={hasDesc ? descId : undefined}
            className={[
              "w-full rounded-xl bg-surface px-4 py-3 pr-12 text-sm text-white placeholder:text-muted",
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
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-white focus:outline-none focus-visible:text-gold"
          >
            {visible ? (
              /* eye-off icon */
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              /* eye icon */
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {hasDesc && (
          <p id={descId} className={`text-xs ${error ? "text-danger" : "text-muted"}`}>
            {error ?? helperText}
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
