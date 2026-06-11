import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface Crumb {
  id: string;
  label: string;
}

export interface BreadcrumbWidget extends Widget<{ crumbs: Crumb[] }> {
  selected: EventCtor<{ id: string }>;
  path(): Promise<Crumb[]>;
  set(crumbs: Crumb[]): void;
  push(crumb: Crumb): void;
}

export function breadcrumb(opts: { crumbs?: Crumb[] } = {}): BreadcrumbWidget {
  return {
    type: "breadcrumb",
    state: { crumbs: opts.crumbs ?? [] },
    selected: event<{ id: string }>("breadcrumb.selected"),
    ...controls,
    path(): Promise<Crumb[]> {
      return bound(this).read<Crumb[]>(this, ["crumbs"]);
    },
    set(crumbs: Crumb[]): void {
      bound(this).edit(this, "set", ["crumbs"], crumbs);
    },
    push(crumb: Crumb): void {
      bound(this).edit(this, "append", ["crumbs"], crumb);
    },
  };
}
