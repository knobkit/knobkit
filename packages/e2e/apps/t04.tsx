import { button, knobkit, row, toMedia, video } from "knobkit";
import { fixtureBytes } from "./_files.js";
import { recorder } from "./_rec.js";

const player = video();
const rec = recorder();
const b = (label: string) => button({ label });
const ask = b("ask");
const seek = b("seek-6");
const range = b("range");
const pause = b("pause");
const play = b("play");

export const app = knobkit({ title: "t04", widgets: [row(ask, seek, range, pause, play), player, rec.widget] });

app.setup(async () => player.set(toMedia(await fixtureBytes("clip-10s.webm"), "video/webm")));

app.on(ask.clicked, async () => rec.push("position", await player.position()));
app.on(seek.clicked, () => player.seek(6));
app.on(range.clicked, () => player.playRange(2, 5.5));
app.on(pause.clicked, () => player.pause());
app.on(play.clicked, () => player.play());
// a handler's own commands are not reported back to it as the user's
app.on(player.played, (e) => rec.push("played", e));
app.on(player.paused, (e) => rec.push("paused", e));
app.on(player.seeked, (e) => rec.push("seeked", e));
