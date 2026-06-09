import { value } from "./value.js";

// A code editor over the uniform `value` attribute: holds `{ value: string }`, plus `language` (syntax
// highlighting) and `editable` (false = a read-only, still-highlighted viewer) as static props. The
// CodeMirror instance lives in the view; this stays a plain value widget (changed/value()/set()).
export function code(opts: { value?: string; language?: string; editable?: boolean } = {}) {
  return value("code", opts.value ?? "", {
    language: opts.language ?? "",
    editable: opts.editable ?? true,
  });
}
