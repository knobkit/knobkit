import { code } from "knobkit";
import { lines, refreshApp } from "./_refresh.js";

export const app = refreshApp("t01", code({ value: lines(20) }), true);
