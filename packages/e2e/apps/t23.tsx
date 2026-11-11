import { code, grow, knobkit, row } from "knobkit";
import { recorder } from "./_rec.js";

const rec = recorder();
// one line of 200 characters, between two short ones; its last word is its own
const long = Array.from({ length: 19 }, (_, i) => `word${String(i).padStart(2, "0")} `).join("") + "the-end-of-it" + "!".repeat(54);
const text = `short line\n${long}\nanother short line`;
const wrapped = code({ value: text, wrap: true });
const unwrapped = code({ value: text });

export const app = knobkit({ title: "t23", fill: true, widgets: [row(grow(wrapped), grow(unwrapped)), rec.widget] });
