import { knobkit, toMedia, video } from "knobkit";
import { fixtureBytes } from "./_files.js";

const player = video();

export const app = knobkit({ title: "t05", widgets: [player] });

// the clip reaches the player as bytes, not as an address
app.setup(async () => player.set(toMedia(await fixtureBytes("clip-10s.webm"), "video/webm")));
