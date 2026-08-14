import { describe, expect, test } from "vitest";
import { knobkit } from "../app.js";
import { decode } from "../codec.js";
import { setMediaStore, mediaBytes, toMedia } from "../media.js";
import type { Frame } from "../protocol.js";
import { defineWidget, idOf } from "../widget.js";
import type { MediaRef } from "../types.js";
import { installNodeContext } from "./context.js";
import { createServerMediaStore } from "./media.js";
import { createSession } from "./session.js";

installNodeContext();

const cam = defineWidget({
  type: "cam",
  state: { shots: { initial: 0 } },
  channels: { frame: { policy: "latest" } },
  ops: (at) => ({ bump: at("shots").op("inc", 1) }),
});

describe("media frame loop", () => {
  test("sustains ≥ 8 processed frames/s over MediaRefs", async () => {
    const media = createServerMediaStore();
    setMediaStore(media);

    const w = cam();
    const app = knobkit({ widgets: w });
    app.declare();
    let processed = 0;
    app.on(w.frame, async (ref) => {
      const bytes = await mediaBytes(ref as MediaRef);
      expect(bytes.byteLength).toBe(50_000);
      // a realistic result write: the server registers output media + an edit
      toMedia(bytes, "image/jpeg");
      w.bump();
      processed++;
    });

    let shots = 0;
    const session = createSession(app, { dev: false });
    session.attach(
      {
        send(b) {
          for (const f of decode(b) as Frame[]) {
            if (f.kind === "edit") shots += f.edits.filter((e) => e[1] === "inc").length;
          }
        },
      },
      undefined,
    );

    const frameBytes = new Uint8Array(50_000).fill(7);
    let seq = 0;
    const start = Date.now();
    let sent = 0;
    while (Date.now() - start < 1000) {
      // the client tier: POST the bytes (eager transfer), then the chan frame with just the ref
      const id = `frame-${sent}`;
      media.handlePost(id, "image/jpeg", frameBytes);
      session.handleFrame({
        seq: ++seq,
        ack: 0,
        kind: "chan",
        corr: `c${sent}`,
        src: idOf(w),
        name: "frame",
        data: { $m: id, mime: "image/jpeg", size: frameBytes.byteLength },
      });
      sent++;
      await new Promise((r) => setTimeout(r, 30)); // ~33 fps offered
    }
    await new Promise((r) => setTimeout(r, 100));

    const elapsedS = (Date.now() - start) / 1000;
    expect(processed / elapsedS).toBeGreaterThanOrEqual(8);
    expect(shots).toBeGreaterThan(0); // results flowed back as edits
  });
});
