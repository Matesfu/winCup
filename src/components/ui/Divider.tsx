interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className = "" }: DividerProps) {
  if (!label) {
    return <hr className={`border-white/5 ${className}`} />;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <hr className="flex-1 border-white/5" />
      <span className="text-xs font-medium text-muted">{label}</span>
      <hr className="flex-1 border-white/5" />
    </div>
  );
}
