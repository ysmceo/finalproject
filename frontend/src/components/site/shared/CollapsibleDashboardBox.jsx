import { useState } from "react";

export default function CollapsibleDashboardBox({ title, count, children, color = "bg-panel/92", headerColor = "bg-brand-deep/90", icon, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`mb-6 rounded-3xl border border-line/70 shadow-xl backdrop-blur-sm ${color} transition-all duration-300 ${className}`}>  
      <button
        className={`flex w-full items-center justify-between rounded-t-3xl px-6 py-4 text-lg font-semibold ${headerColor} focus:outline-none transition-colors duration-200`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          {title}
          {typeof count === "number" && (
            <span className="ml-2 text-xs font-bold text-brand-light bg-brand-dark/20 rounded px-2 py-1">{count}</span>
          )}
        </span>
        <span className="text-xl">{open ? "▼" : "►"}</span>
      </button>
      {open && (
        <div className="px-6 pb-6 pt-3">{children}</div>
      )}
    </div>
  );
}
