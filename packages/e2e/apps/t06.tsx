import { button, chat, col, dropdown, knobkit } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
const one = button({ label: "make-one" });
const three = button({ label: "make-three" });
const early = button({ label: "make-early" });
const stage = col();

export const app = knobkit({ title: "t06", widgets: [one, three, early, stage, rec.widget] });

// each widget is created, added to the screen and subscribed to while the handler runs
app.on(one.clicked, () => {
  const pick = dropdown({ choices: ["red", "green", "blue"] });
  stage.add(pick);
  app.on(pick.changed, (v) => rec.push("picked", v));

  const convo = chat({ placeholder: "made during a run" });
  stage.add(convo);
  app.on(convo.sent, ({ text }) => rec.push("sent", text));

  const press = button({ label: "made" });
  stage.add(press);
  app.on(press.clicked, () => rec.push("clicked"));
});

app.on(three.clicked, () => {
  for (const name of ["a", "b", "c"]) {
    const pick = dropdown({ choices: ["-", `${name}1`, `${name}2`] });
    stage.add(pick);
    app.on(pick.changed, (v) => rec.push(`picked-${name}`, v));
  }
});

// subscribed to before it is added: the order a harness may well write
app.on(early.clicked, () => {
  const press = button({ label: "made-early" });
  app.on(press.clicked, () => rec.push("clicked-early"));
  stage.add(press);
});
