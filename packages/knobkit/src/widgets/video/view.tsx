import { puVideo, puVideoEmpty } from "./video.css.js";
import { useEffect, useRef } from "react";
import { mediaUrl } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";
import type { VideoCommand } from "./def.js";

interface State {
  src: MediaRef | string | null;
  position: number;
  playing: boolean;
  duration: number;
  commands: VideoCommand[];
  handled: number;
}

// how often the player's clock is copied into state while it runs, and how often it is sent on
const WRITE_MS = 50;
const PROGRESS_MS = 500;

export default function VideoView({ props, state, emit, set }: ViewProps<State, { autoplay: boolean; loop: boolean }>) {
  const src = state.src;
  const url = src ? (typeof src === "string" ? src : mediaUrl(src)) : null;
  const player = useRef<HTMLVideoElement>(null);
  // the listeners are bound once per clip; these let them reach the current callbacks
  const out = useRef({ emit, set });
  out.current = { emit, set };
  // Events tell a handler what the *user* did. What a handler's own command causes is counted
  // here and passed over, or a handler that seeks on `seeked` would answer itself for ever.
  const own = useRef({ played: 0, paused: 0, seeked: 0 });
  // the time at which a playRange() stops
  const stopAt = useRef<number | null>(null);

  useEffect(() => {
    const v = player.current;
    if (!v) return;
    let frame = 0;
    let wrote = 0;
    let sent = 0;
    let last = -1;
    const here = (): { position: number } => ({ position: v.currentTime });
    const mine = (what: "played" | "paused" | "seeked"): boolean => {
      if (own.current[what] === 0) return false;
      own.current[what]--;
      return true;
    };
    const endOfRange = (): void => {
      if (stopAt.current === null || v.currentTime < stopAt.current) return;
      stopAt.current = null;
      if (!v.paused) {
        own.current.paused++;
        v.pause();
      }
    };

    const write = (): void => {
      if (v.currentTime === last) return;
      last = v.currentTime;
      out.current.set(["position"], last);
    };
    // `timeupdate` alone is too coarse for a read to be the player's own position (it may come
    // only four times a second), and animation frames alone stop when the page is hidden
    const tick = (now: number): void => {
      if (now - wrote >= WRITE_MS) {
        wrote = now;
        write();
      }
      endOfRange();
      frame = requestAnimationFrame(tick);
    };
    const onTime = (): void => {
      write();
      endOfRange();
      const now = performance.now();
      if (!v.paused && now - sent >= PROGRESS_MS) {
        sent = now;
        out.current.emit("progress", here());
      }
    };
    const onPlay = (): void => {
      out.current.set(["playing"], true);
      if (!mine("played")) out.current.emit("played", here());
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    const onPause = (): void => {
      cancelAnimationFrame(frame);
      write();
      out.current.set(["playing"], false);
      if (mine("paused")) return;
      stopAt.current = null; // the user took over
      out.current.emit("paused", here());
    };
    const onSeeked = (): void => {
      write();
      if (mine("seeked")) return;
      stopAt.current = null;
      out.current.emit("seeked", here());
    };
    const onMeta = (): void => out.current.set(["duration"], Number.isFinite(v.duration) ? v.duration : 0);

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    return () => {
      cancelAnimationFrame(frame);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
    };
  }, [url]);

  // carry out what handlers asked for since last time, in order
  const commands = state.commands ?? [];
  const handled = state.handled ?? 0;
  useEffect(() => {
    const v = player.current;
    if (!v || handled >= commands.length) return;
    const seek = (to: number): void => {
      own.current.seeked++;
      v.currentTime = to;
    };
    const play = (): void => {
      if (!v.paused) return;
      own.current.played++;
      // refused when the browser wants a click first (a clip with sound): nothing was played
      v.play().catch(() => (own.current.played = Math.max(0, own.current.played - 1)));
    };
    for (const c of commands.slice(handled)) {
      if (c.op === "seek") {
        stopAt.current = null;
        seek(c.to);
      } else if (c.op === "play") play();
      else if (c.op === "pause") {
        stopAt.current = null;
        if (!v.paused) {
          own.current.paused++;
          v.pause();
        }
      } else {
        seek(c.from);
        stopAt.current = c.to;
        play();
      }
    }
    set(["handled"], commands.length);
  }, [commands, handled, url, set]);

  if (!url) return <div className={puVideoEmpty}>—</div>;
  return (
    <video
      ref={player}
      className={puVideo}
      src={url}
      controls
      autoPlay={props.autoplay}
      loop={props.loop}
      muted={props.autoplay}
    />
  );
}
