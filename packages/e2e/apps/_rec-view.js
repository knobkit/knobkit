import { createElement } from "react";

// plain JS: in server mode the client imports a view by its path, with no TypeScript step for app files
export default function RecView({ state }) {
  return createElement("pre", { "data-rec": "", hidden: true }, JSON.stringify(state.value ?? []));
}
