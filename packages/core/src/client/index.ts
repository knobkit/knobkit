export { mountApp, collectSnap } from "./mount.js";
export { boot } from "./socket.js";
export { register, viewFor, resolveViewRef } from "./registry.js";
export type { ViewProps, WidgetView } from "./view.js";
export { createStore } from "./store.js";
export type { Store } from "./store.js";
export { createClientMediaStore } from "./media.js";
export type { ClientMediaStore } from "./media.js";
export { Field } from "./field.js";
export type { FieldRuntime } from "./field.js";
export { renderApp } from "./render.js";
export { createNotesHub } from "./notes.js";
export type { NotesHub, NoteEntry } from "./notes.js";
export { createWatchTable } from "./watch-table.js";
export type { WatchTable } from "./watch-table.js";
export { cssVar, seriesPalette, onThemeChange, useThemeVersion } from "./theme.js";
// core's chrome classes: always present (styles.css rides render.tsx), so widgets — ours and
// third-party alike — name them from here rather than hardcoding the strings
export * from "./styles.css.js";
