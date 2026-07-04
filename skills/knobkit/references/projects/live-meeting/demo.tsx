import { knobkit, mic, log, chat } from "knobkit";
import { pipeline, TextStreamer } from "@huggingface/transformers";

const transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-base.en");
const generate = await pipeline("text-generation", "onnx-community/Qwen2.5-0.5B-Instruct");

const audio = mic({ every: 3000 });
const transcript = log();
const convo = chat({ placeholder: "Ask about the audio…", markdown: true });

const app = knobkit({
  title: "Live transcription",
  description: "A toggle records the mic; each ~3s clip is transcribed, and the analyst answers from the running transcript.",
  widgets: [audio, transcript, convo],
});

// Each ~3s clip is transcribed and pushed onto the running transcript.
app.on(audio.clip, async (samples) => {
  const { text } = (await transcriber(samples)) as { text: string };
  transcript.push(text.trim() || "(silence)");
});

// The analyst reads the whole transcript (log.all()) as context for each question.
app.on(
  convo.sent,
  convo.busy(async ({ text }: { text: string }) => {
    const lines = await transcript.all();
    const history = await convo.history();
    convo.say({ role: "user", content: text });
    convo.say({ role: "assistant", content: "" });
    const prompt = [
      {
        role: "system",
        content: `You analyze a live audio stream. Transcript so far:\n"""${lines.join(" ") || "(nothing yet)"}"""\nAnswer concisely.`,
      },
      ...history,
      { role: "user", content: text },
    ];
    const streamer = new TextStreamer(generate.tokenizer, {
      skip_prompt: true,
      callback_function: (token: string) => convo.append(token),
    });
    await generate(prompt as never, { max_new_tokens: 200, streamer });
  }),
);

app.serve();
