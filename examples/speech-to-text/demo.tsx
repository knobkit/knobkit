import { knobkit, mic, output } from "knobkit";
import { pipeline } from "@huggingface/transformers";

const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/whisper-base.en",
);

const recorder = mic();
const transcript = output();

const app = knobkit({
  title: "Transcribe",
  description: "Record audio; a local Whisper model turns it into text. Runs on the server.",
  widgets: [recorder, transcript],
});

app.on(recorder.clip, async (samples) => {
  const out = (await transcriber(samples)) as { text: string };
  transcript.set(out.text.trim() || "(silence)");
});

app.serve();
