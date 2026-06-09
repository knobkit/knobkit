import { knobkit, chat, audio } from "knobkit";
import { pipeline } from "@huggingface/transformers";
import { KokoroTTS } from "kokoro-js";

const transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-base.en");
const generate = await pipeline("text-generation", "onnx-community/Qwen2.5-0.5B-Instruct");
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q4f16" });

async function answer(question: string): Promise<string> {
  const out = (await generate(
    [
      { role: "system", content: "You are a helpful voice assistant. Answer in one or two short sentences." },
      { role: "user", content: question },
    ] as never,
    { max_new_tokens: 128, do_sample: true, temperature: 0.7, top_p: 0.9 },
  )) as Array<{ generated_text: Array<{ content: string }> }>;
  return out[0]!.generated_text.at(-1)!.content.trim();
}

const conversation = chat({ voice: true, placeholder: "Speak, or type a question…" });
const spoken = audio({ autoplay: true });

const app = knobkit({
  title: "Voice assistant",
  description: "Speak; Whisper transcribes, Qwen2.5 answers, Kokoro speaks the reply — all local.",
  widgets: [conversation, spoken],
});

app.on(conversation.recorded, async (samples) => {
  const { text } = (await transcriber(samples)) as { text: string };
  return conversation.sent({ text: text.trim() || "(silence)" });
});

app.on(
  conversation.sent,
  conversation.busy(async ({ text: said }: { text: string }) => {
    conversation.say({ role: "user", content: said });
    const text = await answer(said);
    conversation.say({ role: "assistant", content: text });
    const out = await tts.generate(text, { voice: "af_heart" });
    spoken.set(`data:audio/wav;base64,${Buffer.from(out.toWav()).toString("base64")}`);
  }),
);

app.serve();
