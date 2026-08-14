import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  /** optional attached image — a MediaRef (bytes out of state) or a plain URL */
  image?: MediaRef | string;
}

export const chat = defineWidget({
  type: "chat",
  state: { messages: { initial: [] as Message[] } },
  props: {
    placeholder: { default: "Say something…" },
    voice: { default: false },
    images: { default: false },
    markdown: { default: false },
  },
  events: { sent: { payload: t<{ text: string; image?: MediaRef }>() } },
  channels: { recorded: { data: t<Float32Array>() } },
  ops: (at) => ({
    say: at("messages").op("append"),
    append: at("messages", -1, "content").op("appendText"), // stream a token into the last message
    clear: at("messages").op("set", []),
  }),
  methods: (self) => ({ history: () => self.at("messages").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
