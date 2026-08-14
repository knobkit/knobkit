import { describe, expect, test } from "vitest";
import { knobkit } from "../app.js";
import { decode } from "../codec.js";
import type { Frame } from "../protocol.js";
import { defineWidget, idOf } from "../widget.js";
import { installNodeContext } from "./context.js";
import { createSession } from "./session.js";

installNodeContext();

const sink = defineWidget({
  type: "sink",
  state: { value: { initial: "" } },
  events: { go: {} },
  ops: (at) => ({ append: at("value").op("appendText") }),
});

describe("streaming", () => {
  test("5k tokens sustained: all bytes arrive, frames stay bounded", async () => {
    const w = sink();
    const app = knobkit({ widgets: w });
    app.declare();
    const TOKENS = 5000;
    app.on(w.go, async () => {
      for (let i = 0; i < TOKENS; i++) {
        w.append("x");
        if (i % 250 === 249) await new Promise((r) => setTimeout(r, 1)); // yield like a generator
      }
    });

    let received = 0;
    let editFrames = 0;
    const session = createSession(app, { dev: false });
    session.attach(
      {
        send(bytes) {
          for (const frame of decode(bytes) as Frame[]) {
            if (frame.kind !== "edit") continue;
            editFrames++;
            for (const e of frame.edits) received += (e[3] as string).length;
          }
        },
      },
      undefined,
    );

    const start = Date.now();
    session.handleFrame({ seq: 1, ack: 0, kind: "event", corr: "c1", src: idOf(w), name: "go", payload: undefined });
    while (received < TOKENS && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const elapsedS = (Date.now() - start) / 1000;

    expect(received).toBe(TOKENS); // nothing lost in coalescing
    expect(TOKENS / elapsedS).toBeGreaterThan(5000); // sustained ≥ 5k tokens/s
    expect(editFrames).toBeLessThanOrEqual(Math.max(10, elapsedS * 80)); // O(flushes), ~16ms pacing
  });
});
