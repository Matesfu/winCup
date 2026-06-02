import { type ReactNode } from "react";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-surface/50 p-5">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
