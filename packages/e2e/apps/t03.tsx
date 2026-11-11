import { knobkit, toMedia, video } from "knobkit";
import { fixtureBytes } from "./_files.js";
import { recorder } from "./_rec.js";

const player = video();
const rec = recorder();

export const app = knobkit({ title: "t03", widgets: [player, rec.widget] });

app.setup(async () => player.set(toMedia(await fixtureBytes("clip-10s.webm"), "video/webm")));

app.on(player.played, (e) => rec.push("played", e));
app.on(player.paused, (e) => rec.push("paused", e));
app.on(player.seeked, (e) => rec.push("seeked", e));
app.on(player.progress, (e) => rec.push("progress", { ...e, at: Date.now() }));
