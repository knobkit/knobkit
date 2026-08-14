import { defineWidget, t, viewRef } from "@knobkit/core";

export interface Crumb {
  id: string;
  label: string;
}

export const breadcrumb = defineWidget({
  type: "breadcrumb",
  state: { crumbs: { initial: [] as Crumb[] } },
  events: { selected: { payload: t<{ id: string }>() } },
  ops: (at) => ({ set: at("crumbs").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});
