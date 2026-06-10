import { knobkit, chat } from "knobkit";
import { AutoProcessor, Qwen3_5ForConditionalGeneration, RawImage, TextStreamer } from "@huggingface/transformers";

const MODEL = "onnx-community/Qwen3.5-0.8B-ONNX";

let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
let model: Awaited<ReturnType<typeof Qwen3_5ForConditionalGeneration.from_pretrained>>;

const conversation = chat({ images: true, markdown: true, placeholder: "Say something, or attach an image…" });

const app = knobkit({
  title: "Chatbot",
  description: "Qwen3.5-0.8B is multimodal and runs entirely in the browser — chat, and attach an image with +.",
  widgets: [conversation],
});

app.setup(async () => {
  conversation.busyStart();
  processor = await AutoProcessor.from_pretrained(MODEL);
  model = await Qwen3_5ForConditionalGeneration.from_pretrained(MODEL, {
    dtype: { embed_tokens: "q4", vision_encoder: "fp16", decoder_model_merged: "q4" },
    device: "webgpu",
  });
  conversation.busyEnd();
});

app.on(
  conversation.sent,
  conversation.busy(async ({ text, image }) => {
    const history = await conversation.history();
    conversation.say({ role: "user", content: text, image });
    conversation.say({ role: "assistant", content: "" });

    // prior turns as text; only the current message carries an image (one placeholder, one image)
    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: image ? [{ type: "image" }, { type: "text", text }] : [{ type: "text", text }] },
    ] as unknown as Parameters<typeof processor.apply_chat_template>[0];
    const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
    const img = image ? await (await RawImage.read(image)).resize(448, 448) : null;
    const inputs = img ? await processor(prompt, img) : await processor(prompt);

    const streamer = new TextStreamer(processor.tokenizer!, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token: string) => conversation.append(token),
    });
    await model.generate({ ...inputs, max_new_tokens: 512, streamer });
  }),
);

app.mount("#root");
