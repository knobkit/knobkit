import { chat, col, grow, knobkit } from "knobkit";
import { recorder } from "./_rec.js";

const convo = chat();
const rec = recorder();

export const app = knobkit({ title: "t08", fill: true, widgets: col(grow(convo), rec.widget) });

// registered the default way: one message's handler at a time. Nothing here is about waiting.
app.on(convo.sent, async ({ text }) => {
  rec.push("started", text);
  convo.say({ role: "user", content: text });
  await new Promise((r) => setTimeout(r, text.startsWith("quick") ? 0 : 3000));
  convo.say({ role: "assistant", content: `done: ${text}` });
  rec.push("ended", text);
});
