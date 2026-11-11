import { button, col, grow, knobkit, row } from "knobkit";
import type { App, EventCtor } from "knobkit";
import { recorder } from "./_rec.js";

export const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1} of the document`).join("\n");

interface TextWidget {
  set(text: string): void;
  value(): Promise<string>;
  changed: EventCtor<string>;
}

/**
 * The app behind the "text is refreshed" checks (KNOBKIT.md tasks 1 and 2): one text widget, and a
 * button for each way a handler rewrites its text.
 */
export function refreshApp(title: string, widget: TextWidget, fill: boolean): App {
  const rec = recorder();
  const b = (label: string) => button({ label });
  const [addEnd, addAt2, same, long, change390, read, auto] = ["add-end", "add-at-2", "same", "long", "change-390", "read", "auto"].map(b) as ReturnType<typeof b>[];
  let autoOn = false;
  let typed = 0;

  const buttons = row(addEnd, addAt2, same, long, change390, read, auto);
  const app = knobkit({
    title,
    fill, // a bounded box, so a long document scrolls inside the widget
    widgets: fill ? col(buttons, grow(widget), rec.widget) : [buttons, widget, rec.widget],
  });

  app.setup(() => {
    autoOn = false; // per session: the server process outlives one test's window
    typed = 0;
  });
  app.on(addEnd!.clicked, async () => widget.set((await widget.value()) + "\nadded 1\nadded 2\nadded 3"));
  app.on(addAt2!.clicked, async () => {
    const l = (await widget.value()).split("\n");
    l.splice(1, 0, "added 1", "added 2", "added 3");
    widget.set(l.join("\n"));
  });
  app.on(same!.clicked, async () => widget.set(await widget.value()));
  app.on(long!.clicked, () => widget.set(lines(400)));
  app.on(change390!.clicked, async () => {
    const l = (await widget.value()).split("\n");
    l[389] = "line 390 was changed by a handler";
    widget.set(l.join("\n"));
  });
  app.on(read!.clicked, async () => rec.push("text", await widget.value()));
  app.on(auto!.clicked, () => {
    autoOn = true;
    typed = 0;
  });

  // every change the user makes is recorded; with "auto" on, the fifth one makes the handler add a
  // section at the end, as an agent writing to the file the user is typing in would
  app.on(widget.changed, async (text) => {
    rec.push("changed", text.length);
    if (autoOn && ++typed === 5) widget.set((await widget.value()) + "\n\n## A section added by the handler\nwith two lines");
  });
  return app;
}
