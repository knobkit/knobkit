import { text } from "knobkit";
import { lines, refreshApp } from "./_refresh.js";

export const app = refreshApp("t02", text({ lines: 12, value: lines(20) }), false);
