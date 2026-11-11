import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

/** Where the player is, in seconds from the start of the clip. */
export interface VideoPosition {
  position: number;
}

export const video = defineWidget({
  type: "video",
  state: {
    src: { initial: null as MediaRef | string | null },
    // written by the player as it runs, so a handler's read is the player's own clock
    position: { initial: 0 },
    playing: { initial: false },
    duration: { initial: 0 },
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
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
