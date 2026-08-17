import { puBreadcrumb, puBreadcrumbCurrent, puBreadcrumbItem, puBreadcrumbLink, puBreadcrumbSep } from "./breadcrumb.css.js";
import type { ViewProps } from "@knobkit/core/client";
import type { Crumb } from "./def.js";

export default function BreadcrumbView({ state, emit }: ViewProps<{ crumbs: Crumb[] }>) {
  const crumbs = state.crumbs ?? [];
  return (
    <nav className={puBreadcrumb} aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span className={puBreadcrumbItem} key={crumb.id}>
            {last ? (
              <span className={puBreadcrumbCurrent} aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                className={puBreadcrumbLink}
                onClick={() => emit("selected", { id: crumb.id })}
              >
                {crumb.label}
              </button>
            )}
            {last ? null : (
              <span className={puBreadcrumbSep} aria-hidden="true">
                ›
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
