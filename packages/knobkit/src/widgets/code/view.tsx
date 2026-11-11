import { puCode, puCodeRo } from "./code.css.js";
import { useEffect, useLayoutEffect, useRef } from "react";
import { changedSpan } from "../_primitives/text-diff.js";
import { EditorState, Compartment, Annotation, type Extension } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { ViewProps } from "@knobkit/core/client";
import type { CodeChange } from "./def.js";

// token-valued theme: CodeMirror follows the --pu-* cascade with no JS re-theming
const cmTheme = EditorView.theme({
  "&": { color: "var(--pu-text)", backgroundColor: "transparent" },
  ".cm-content": { caretColor: "var(--pu-accent)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--pu-accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--pu-accent-subtle)",
  },
  ".cm-activeLine": { backgroundColor: "var(--pu-overlay)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--pu-overlay)", color: "var(--pu-text)" },
});

const cmHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.self], color: "var(--pu-series-4)" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--pu-series-2)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--pu-series-3)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--pu-muted)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.labelName, t.tagName, t.heading], color: "var(--pu-series-1)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--pu-series-6)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--pu-series-5)" },
  { tag: [t.link, t.url], color: "var(--pu-accent)", textDecoration: "underline" },
  { tag: t.invalid, color: "var(--pu-danger)" },
]);

// Each grammar is a dynamic import() so the bundler splits it into its own chunk, served on
// demand — only the languages an app actually uses are ever sent to the browser. (js/ts/jsx/tsx
// share one chunk since they're the same package.)
const LANGS: Record<string, () => Promise<Extension>> = {
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  typescript: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  jsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  tsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true, typescript: true })),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
};

// marks our own doc-replacing dispatches so the update listener doesn't echo them back as edits
const External = Annotation.define<boolean>();

const langOf = (name: string): Promise<Extension> => LANGS[name]?.() ?? Promise.resolve([]);
const editOf = (editable: boolean): Extension => [EditorView.editable.of(editable), EditorState.readOnly.of(!editable)];

export default function CodeView({ props, state, emit, set }: ViewProps<{ value: string; language: string }, { readOnly: boolean; wrap: boolean }>) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const lang = useRef(new Compartment());
  const edit = useRef(new Compartment());
  // the editor is built once; route edits through a ref so it always sees the current props
  const onChange = useRef<(v: string, changes: CodeChange[]) => void>(() => {});
  onChange.current = (v, changes) => {
    set(["value"], v); // local, so reads and the controlled doc reflect typing with no round-trip
    emit("changed", v);
    emit("edited", { changes }); // what changed, for a handler that does not want the whole text each time
  };

  const onSelect = useRef<(s: { start: number; end: number; text: string }) => void>(() => {});
  onSelect.current = (s) => emit("selected", s);
  const selTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSel = useRef("");

  const language = state.language ?? "";
  const editable = !props.readOnly;

  useLayoutEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: state.value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          indentOnInput(),
          bracketMatching(),
          cmTheme,
          syntaxHighlighting(cmHighlight, { fallback: true }),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          lang.current.of([]), // grammar loads async via the [language] effect below
          edit.current.of(editOf(editable)),
          props.wrap ? EditorView.lineWrapping : [],

          // a selection is reported once it has settled: dragging one out changes it at every step
          EditorView.updateListener.of((u) => {
            if (!u.selectionSet) return;
            clearTimeout(selTimer.current);
            selTimer.current = setTimeout(() => {
              const cm = view.current;
              if (!cm) return;
              const { from, to } = cm.state.selection.main;
              const key = `${from}:${to}`;
              if (from === to) lastSel.current = "";
              else if (key !== lastSel.current) {
                lastSel.current = key;
                onSelect.current({ start: from, end: to, text: cm.state.sliceDoc(from, to) });
              }
            }, 200);
          }),

          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            if (u.transactions.some((tr) => tr.annotation(External))) return; // our own sync, not a user edit
            const changes: CodeChange[] = [];
            u.changes.iterChanges((from, to, _fromNew, _toNew, inserted) => changes.push({ from, to, insert: inserted.toString() }));
            onChange.current(u.state.doc.toString(), changes);
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      clearTimeout(selTimer.current);
      v.destroy();
    };
    // mount once; external state / language / editable are synced by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push programmatic value changes (set()/server edit) into the doc without echoing back an edit.
  // Only the span that differs is replaced, so the cursor, the selection and the scroll position
  // are carried through the change by CodeMirror instead of being reset. A layout effect: between
  // a render and a passive effect a keystroke could land, and its text would read as a difference.
  useLayoutEffect(() => {
    const v = view.current;
    if (!v) return;
    const span = changedSpan(v.state.doc.toString(), state.value);
    if (span) v.dispatch({ changes: span, annotations: External.of(true) });
  }, [state.value]);

  // load the grammar chunk, then swap it into the language compartment; guard against a stale load
  // resolving after the language changed again or the editor unmounted
  useEffect(() => {
    let cancelled = false;
    void langOf(language).then((ext) => {
      if (!cancelled) view.current?.dispatch({ effects: lang.current.reconfigure(ext) });
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({ effects: edit.current.reconfigure(editOf(editable)) });
  }, [editable]);

  return <div ref={host} className={`${puCode}${editable ? "" : ` ${puCodeRo}`}`} />;
}
