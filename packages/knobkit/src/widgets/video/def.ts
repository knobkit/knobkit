import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

/** Where the player is, in seconds from the start of the clip. */
export interface VideoPosition {
  position: number;
}

/** One instruction from a handler to the player. They are a list so that none is lost to the next. */
export type VideoCommand =
  | { op: "seek"; to: number }
  | { op: "play" }
  | { op: "pause" }
  | { op: "range"; from: number; to: number };

export const video = defineWidget({
  type: "video",
  state: {
    src: { initial: null as MediaRef | string | null },
    // written by the player as it runs, so a handler's read is the player's own clock
    position: { initial: 0 },
    playing: { initial: false },
    duration: { initial: 0 },
    commands: { initial: [] as VideoCommand[] },
    handled: { initial: 0 }, // how many of `commands` the player has carried out
  },
  props: { autoplay: { default: false }, loop: { default: false } },
  events: {
    // what the user does with the player's controls
    played: { payload: t<VideoPosition>() },
    paused: { payload: t<VideoPosition>() },
    seeked: { payload: t<VideoPosition>() },
    /** while playing, about twice a second */
    progress: { payload: t<VideoPosition>() },
  },
  ops: (at) => ({ set: at("src").op("set") }),
  methods: (self) => ({
    position: () => self.at("position").get(),
    playing: () => self.at("playing").get(),
    duration: () => self.at("duration").get(),
    /** Move to a time in seconds. The clip is not loaded again. */
    seek: (seconds: number): void => self.at("commands").append({ op: "seek", to: seconds }),
    play: (): void => self.at("commands").append({ op: "play" }),
    pause: (): void => self.at("commands").append({ op: "pause" }),
    /** Play from one time to another, then stop there. */
    playRange: (from: number, to: number): void => self.at("commands").append({ op: "range", from, to }),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
