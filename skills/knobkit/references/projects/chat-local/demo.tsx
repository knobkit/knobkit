import { knobkit, chat } from "knobkit";
import { pipeline, TextStreamer } from "@huggingface/transformers";

const MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";
const generate = await pipeline("text-generation", MODEL, { device: "webgpu" });

const convo = chat({ placeholder: "Say something…", markdown: true });

const app = knobkit({
  title: "Chatbot",
  description: "Chat with a small language model running entirely in your browser (WebGPU). Replies stream in and render as markdown.",
  widgets: [convo],
});

// busy() drops further sends while a reply streams. Open an empty assistant turn, then append tokens.
app.on(
  convo.sent,
  convo.busy(async ({ text }: { text: string }) => {
    const history = await convo.history();
    convo.say({ role: "user", content: text });
    convo.say({ role: "assistant", content: "" });
    const prompt = [
      { role: "system", content: "You are a concise, helpful assistant." },
      ...history,
      { role: "user", content: text },
    ];
    const streamer = new TextStreamer(generate.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token: string) => convo.append(token),
    });
    await generate(prompt as never, { max_new_tokens: 512, streamer });
  }),
);

app.mount("#root");
