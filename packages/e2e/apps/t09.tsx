import { chat, col, grow, knobkit } from "knobkit";
import { recorder } from "./_rec.js";

const convo = chat();
const rec = recorder();

export const app = knobkit({ title: "t09", fill: true, widgets: col(grow(convo), rec.widget) });

app.on(convo.sent, async ({ text }) => {
  rec.push("started", text);
  convo.say({ role: "user", content: text });
  convo.runStarted();
  await new Promise((r) => setTimeout(r, text === "short" ? 600 : 3000));
  convo.runEnded();
  rec.push("ended", text);
});
app.on(convo.stopped, () => rec.push("stopped"));
