import type { ReactNode } from "react";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div data-motion="heading" className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div>
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {description && (
          <p className="mt-3 text-sm text-text-muted max-w-xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
