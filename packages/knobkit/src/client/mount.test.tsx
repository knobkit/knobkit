// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { act } from "react";
import { knobkit } from "../lib/knobkit.js";
import { button, json, log, text } from "../lib/widgets/index.js";
import { mount } from "./mount.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-density");
  document.documentElement.removeAttribute("data-fill");
});

async function waitFor(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < 20; i++) {
    try {
      assertion();
      return;
    } catch (err) {
      lastError = err;
      await tick();
    }
  }
  throw lastError;
}

function type(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

test("mount throws for a missing host selector before creating any app state", () => {
  const box = text();
  const app = knobkit({ widgets: [box] });

  expect(() => mount(app, "#missing")).toThrow('knobkit: no element matches "#missing"');
});

test("mount runs setup and handlers against browser-owned state", async () => {
  const box = text();
  const stats = json();
  const app = knobkit({ widgets: [box, stats] })
    .setup(() => {
      stats.set({ ready: true });
    })
    .on(box.changed, async (payload: string) => {
      const value = await box.value();
      stats.set({ payload, value, words: value.trim() ? value.trim().split(/\s+/).length : 0 });
    });
  document.body.innerHTML = '<div id="root"></div>';

  await act(async () => {
    mount(app, "#root");
    await tick();
  });
  await waitFor(() => expect(document.querySelector("pre")!.textContent).toContain('"ready": true'));

  const input = document.querySelector("input") as HTMLInputElement;
  await act(async () => {
    type(input, "hello there world");
    await tick();
  });

  expect(input.value).toBe("hello there world");
  expect(document.querySelector("pre")!.textContent).toContain('"payload": "hello there world"');
  expect(document.querySelector("pre")!.textContent).toContain('"value": "hello there world"');
  expect(document.querySelector("pre")!.textContent).toContain('"words": 3');
});

test("mount executes multiple handlers and re-enters the local store for returned events", async () => {
  const source = text();
  const followup = button({ label: "Follow up" });
  const lines = log();
  const app = knobkit({ widgets: [source, followup, lines] })
    .on(source.changed, (value: string) => {
      lines.push(`source:${value}`);
      return followup.clicked();
    })
    .on(source.changed, () => {
      lines.push("second-handler");
    })
    .on(followup.clicked, () => {
      lines.push("returned-event");
    });
  document.body.innerHTML = '<div id="root"></div>';

  await act(async () => {
    mount(app, "#root");
  });
  await act(async () => {
    type(document.querySelector("input")!, "go");
    await tick();
  });

  const logText = document.querySelector(".pu-log")!.textContent!;
  expect(logText).toContain("source:go");
  expect(logText).toContain("second-handler");
  expect(logText).toContain("returned-event");
});

test("busy handlers expose busy UI, suppress duplicate events, and still read latest client state", async () => {
  const box = text();
  const lines = log();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const app = knobkit({ widgets: [box, lines] }).on(
    box.changed,
    box.busy(async (payload: string) => {
      lines.push(`start:${payload}`);
      await gate;
      lines.push(`done:${await box.value()}`);
    }),
  );
  document.body.innerHTML = '<div id="root"></div>';

  await act(async () => {
    mount(app, "#root");
  });
  const input = document.querySelector("input")!;

  await act(async () => {
    type(input, "first");
    await tick();
  });
  await waitFor(() => expect(document.querySelector('[role="status"]')?.getAttribute("aria-label")).toBe("Loading"));
  await act(async () => {
    type(input, "second");
    await tick();
  });

  expect(input.value).toBe("second");
  expect(document.querySelector(".pu-log")!.textContent).toContain("start:first");
  expect(document.querySelector(".pu-log")!.textContent).not.toContain("start:second");

  await act(async () => {
    release();
    await tick();
  });

  await waitFor(() => expect(document.querySelector('[role="status"]')).toBeNull());
  const logText = document.querySelector(".pu-log")!.textContent!;
  expect(logText).toContain("done:second");
  expect(logText).not.toContain("done:first");
});

test("mount handlers can enable and disable widgets through bound controls", async () => {
  const run = button({ label: "Run" });
  const reset = button({ label: "Reset" });
  const events = log();
  const app = knobkit({ widgets: [run, reset, events] })
    .on(run.clicked, () => {
      events.push("run");
      run.disable();
    })
    .on(reset.clicked, () => {
      events.push("reset");
      run.enable();
    });
  document.body.innerHTML = '<div id="root"></div>';

  await act(async () => {
    mount(app, "#root");
  });
  const [runButton, resetButton] = [...document.querySelectorAll("button")];

  await act(async () => {
    click(runButton);
    await tick();
  });
  expect(runButton.disabled).toBe(true);
  expect(runButton.closest(".pu-field")!.classList.contains("pu-disabled")).toBe(true);

  await act(async () => {
    click(runButton);
    click(resetButton);
    await tick();
  });
  expect(runButton.disabled).toBe(false);
  expect(runButton.closest(".pu-field")!.classList.contains("pu-disabled")).toBe(false);

  await act(async () => {
    click(runButton);
    await tick();
  });
  const logText = document.querySelector(".pu-log")!.textContent!;
  expect(logText.match(/run/g)).toHaveLength(2);
  expect(logText.match(/reset/g)).toHaveLength(1);
});
