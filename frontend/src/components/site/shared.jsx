import { AlertCircle, CheckCircle2, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/site";

const selectClassName =
  "h-11 w-full rounded-[1.35rem] border border-line bg-panel/88 px-4 text-sm text-ink shadow-sm backdrop-blur-sm transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15";

const noticeVariants = {
  success: "border-success/30 bg-success/12 text-success",
  error: "border-danger/30 bg-danger/12 text-danger",
  info: "border-info/30 bg-info/12 text-info"
};

const statusVariants = {
  approved: "bg-success/14 text-success",
  completed: "bg-success/14 text-success",
  delivered: "bg-success/14 text-success",
  paid: "bg-success/14 text-success",
  read: "bg-success/14 text-success",
  pending: "bg-warning/14 text-warning",
  initiated: "bg-warning/14 text-warning",
  receipt_submitted: "bg-warning/14 text-warning",
  processed: "bg-info/14 text-info",
  shipped: "bg-info/14 text-info",
  on_the_way: "bg-info/14 text-info",
  unread: "bg-danger/14 text-danger",
  cancelled: "bg-danger/14 text-danger",
  rejected: "bg-danger/14 text-danger"
};

export function Surface({ className, children }) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-line/80 bg-panel/92 p-5 shadow-card backdrop-blur-sm sm:rounded-4xl sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-3">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-deep/75">{eyebrow}</p>
        ) : null}
        <div className="space-y-2">
          <h2 className="font-display text-3xl leading-none text-ink sm:text-4xl lg:text-5xl">{title}</h2>
          {description ? <p className="text-sm leading-6 text-ink-soft sm:text-base">{description}</p> : null}
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, accent, helper }) {
  return (
    <div className="rounded-[1.55rem] border border-line/80 bg-panel/92 px-4 py-4 shadow-soft sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-soft">{label}</p>
      <p className={cn("mt-3 text-2xl font-semibold text-ink sm:text-3xl", accent)}>{value}</p>
      {helper ? <p className="mt-2 text-sm text-ink-soft">{helper}</p> : null}
    </div>
  );
}

export function Field({ label, htmlFor, required, help, className, children }) {
  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
          {label}
          {required ? " *" : ""}
        </Label>
      ) : null}
      {children}
      {help ? <p className="text-xs leading-5 text-ink-soft">{help}</p> : null}
    </div>
  );
}

export function TextField({ label, help, className, required, ...props }) {
  return (
    <Field label={label} help={help} htmlFor={props.id} className={className} required={required}>
      <Input {...props} />
    </Field>
  );
}

export function TextareaField({ label, help, className, required, ...props }) {
  return (
    <Field label={label} help={help} htmlFor={props.id} className={className} required={required}>
      <Textarea {...props} />
    </Field>
  );
}

export function SelectField({ label, help, className, required, children, ...props }) {
  return (
    <Field label={label} help={help} htmlFor={props.id} className={className} required={required}>
      <select className={selectClassName} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Notice({ tone = "info", message, className }) {
  if (!message) {
    return null;
  }

  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-3xl border px-4 py-3 text-sm",
        noticeVariants[tone] || noticeVariants.info,
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-6">{message}</p>
    </div>
  );
}

export function DetailRow({ label, value, className }) {
  return (
    <div className={cn("flex flex-col items-start justify-between gap-1 text-sm sm:flex-row sm:items-center sm:gap-4", className)}>
      <span className="text-ink-soft">{label}</span>
      <span className="text-left font-semibold text-ink sm:text-right">{value}</span>
    </div>
  );
}

export function StatusPill({ value }) {
  const label = String(value || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        statusVariants[String(value || "").toLowerCase()] || "bg-panel-strong/70 text-ink-soft"
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({ title, description, variant = "default" }) {
  const containerClassName = variant === "contrast"
    ? "border-white/14 bg-white/8 text-white"
    : "border-line bg-panel/72 text-ink";
  const descriptionClassName = variant === "contrast" ? "text-white/72" : "text-ink-soft";

  return (
    <div className={cn("rounded-[1.45rem] border border-dashed px-5 py-6 text-sm", containerClassName)}>
      <p className={cn("font-semibold", variant === "contrast" ? "text-white" : "text-ink")}>{title}</p>
      <p className={cn("mt-2 leading-6", descriptionClassName)}>{description}</p>
    </div>
  );
}

export function QuantityControl({ value, onChange, max = 99, min = 0, className }) {
  const nextValue = Number.isFinite(Number(value)) ? Number(value) : 0;

  return (
    <div className={cn("flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.max(min, nextValue - 1))}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Input
        type="number"
        min={min}
        max={max}
        value={nextValue}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value || 0))))}
        className="h-10 w-20 rounded-full px-3 text-center"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.max(min, Math.min(max, nextValue + 1)))}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function Timeline({ items, emptyText }) {
  if (!Array.isArray(items) || !items.length) {
    return <EmptyState title="No updates yet" description={emptyText} />;
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id || `${item.type || "timeline"}-${index}`} className="flex gap-3">
          <div className="mt-1 h-3 w-3 rounded-full bg-brand" />
          <div className="min-w-0 flex-1 rounded-[1.4rem] border border-line/70 bg-panel/92 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {item.type ? <StatusPill value={item.type} /> : null}
              <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                {formatDateTime(item.createdAt || item.sentAt || item.updatedAt)}
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink">{item.message || "Update received."}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
