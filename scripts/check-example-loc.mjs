// each example must stay at or under its pre-rewrite LOC
import { readFileSync } from "node:fs";

const BASELINES = {
  "speech-to-text": 23,
  "voice-assistant": 45,
  "live-meeting-help": 46,
  "browser-chat": 52,
  "tables-and-charts": 56,
  "describe-image": 61,
  "webcam-live-filter": 76,
  "agent-dashboard": 104,
};

let failed = false;
for (const [name, max] of Object.entries(BASELINES)) {
  const lines = readFileSync(`examples/${name}/demo.tsx`, "utf8").trimEnd().split("\n").length;
  const ok = lines <= max;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${lines} / ${max}`);
}
process.exit(failed ? 1 : 0);
