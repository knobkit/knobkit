import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  image?: string; // optional attached image, as a data URL
}

export interface ChatWidget extends Widget<{ messages: Message[] }> {
  sent: EventCtor<{ text: string; image?: string }>;
  recorded: EventCtor<Float32Array>;
  placeholder: string;
  voice: boolean;
  images: boolean;
  history(): Promise<Message[]>;
  say(message: Message): void; // append a whole message
  append(token: string): void; // stream a token into the last message's content
}

export function chat(opts: { placeholder?: string; voice?: boolean; images?: boolean } = {}): ChatWidget {
  return {
    type: "chat",
    state: { messages: [] },
    sent: event<{ text: string; image?: string }>("chat.sent"),
    recorded: event<Float32Array>("chat.recorded"),
    placeholder: opts.placeholder ?? "Say something…",
    voice: opts.voice ?? false,
    images: opts.images ?? false,
    ...controls,
    history(): Promise<Message[]> {
      return bound(this).read<Message[]>(this, ["messages"]);
    },
    say(message: Message): void {
      bound(this).edit(this, "append", ["messages"], message);
    },
    append(token: string): void {
      bound(this).edit(this, "appendText", ["messages", -1, "content"], token);
    },
  };
}
