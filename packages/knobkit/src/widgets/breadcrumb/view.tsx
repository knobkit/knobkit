import "./breadcrumb.css";
import type { ViewProps } from "@knobkit/core/client";
import type { Crumb } from "./def.js";

export default function BreadcrumbView({ state, emit }: ViewProps<{ crumbs: Crumb[] }>) {
  const crumbs = state.crumbs ?? [];
  return (
    <nav className="pu-breadcrumb" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span className="pu-breadcrumb-item" key={crumb.id}>
            {last ? (
              <span className="pu-breadcrumb-current" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                className="pu-breadcrumb-link"
                onClick={() => emit("selected", { id: crumb.id })}
              >
                {crumb.label}
              </button>
            )}
            {last ? null : (
              <span className="pu-breadcrumb-sep" aria-hidden="true">
                ›
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
