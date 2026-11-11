import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export interface Message {
  /** names the message, so `appendTo(id, token)` reaches it wherever it sits in the conversation */
  id?: string;
  /** `tool` shows the call named by `call`; `error` is a failure notice */
  role: "user" | "assistant" | "system" | "tool" | "error";
  content: string;
  /** optional attached image — a MediaRef (bytes out of state) or a plain URL */
  image?: MediaRef | string;
  /** role `tool`: the id of the call this entry shows */
  call?: string;
}

/** `awaiting` asks the user to accept or reject the call; the answer arrives as `decided`. */
export type ToolStatus = "running" | "awaiting" | "done" | "error" | "rejected";

/** A change to a file's text, shown on the call's card as a diff. */
export interface ToolDiff {
  path?: string;
  oldContent: string;
  newContent: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: unknown;
  status: ToolStatus;
  result?: string;
  /** shown in place of `input`: what the call would change, as added and removed lines */
  diff?: ToolDiff;
}

export const chat = defineWidget({
  type: "chat",
  // in a container that offers height the messages scroll and the composer stays put
  size: { y: "fill" },
  state: {
    messages: { initial: [] as Message[] },
    // keyed, not positional: a path through an id stays valid while the conversation grows
    streams: { initial: {} as Record<string, string> },
    tools: { initial: {} as Record<string, ToolCall> },
    queued: { initial: [] as string[] },
  },
  props: {
    placeholder: { default: "Say something…" },
    voice: { default: false },
    images: { default: false },
    markdown: { default: false },
  },
  events: {
    sent: { payload: t<{ text: string; image?: MediaRef }>() },
    decided: { payload: t<{ id: string; decision: "accept" | "reject" }>() },
  },
  channels: { recorded: { data: t<Float32Array>() } },
  ops: (at) => ({
    say: at("messages").op("append"),
    append: at("messages", -1, "content").op("appendText"), // stream a token into the last message
    queue: at("queued").op("append"),
    dequeue: at("queued").op("removeAt", 0),
    setQueued: at("queued").op("set"),
  }),
  methods: (self) => ({
    /** Stream a token into the message said with this `id`. */
    appendTo: (id: string, token: string): void => self.at("streams", id).appendText(token),
    /** Show a tool call at the end of the conversation. */
    tool(call: { id: string; name: string; input?: unknown; status?: ToolStatus; diff?: ToolDiff }): void {
      self.at("tools", call.id).set({ ...call, status: call.status ?? "running" });
      self.at("messages").append({ role: "tool", content: "", call: call.id });
    },
    toolStatus: (id: string, status: ToolStatus): void => self.at("tools", id).patch({ status }),
    toolResult: (id: string, result: string, isError = false): void =>
      self.at("tools", id).patch({ status: isError ? "error" : "done", result }),
    clear: (): void => self.at().patch({ messages: [], streams: {}, tools: {}, queued: [] }),
    /** The conversation, with text streamed by id folded into each message's content. */
    async history(): Promise<Message[]> {
      const [messages, streams] = await Promise.all([self.at("messages").get(), self.at("streams").get()]);
      return messages.map((m) => (m.id && streams[m.id] ? { ...m, content: m.content + streams[m.id] } : m));
    },
    toolCalls: () => self.at("tools").get(),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
