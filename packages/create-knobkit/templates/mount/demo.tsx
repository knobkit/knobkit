import { knobkit, text, button, output, col } from "knobkit";

const name = text({ placeholder: "Ada" });
const greet = button({ label: "Greet" });
const out = output();

const app = knobkit({
  title: "Hello, knobkit",
  description: "Type a name and click Greet.",
  widgets: col(name, greet, out),
});

app.on(greet.clicked, async () => {
  const who = (await name.value()).trim() || "world";
  out.set(`Hello, ${who}!`);
});

app.mount("#root");
