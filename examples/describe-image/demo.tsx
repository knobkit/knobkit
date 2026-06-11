import { knobkit, upload, dropdown, button, output, row, col } from "knobkit";
import {
  AutoProcessor,
  Qwen2VLForConditionalGeneration,
  RawImage,
  TextStreamer,
} from "@huggingface/transformers";

const MODEL = "onnx-community/Qwen2-VL-2B-Instruct";
const model = await Qwen2VLForConditionalGeneration.from_pretrained(MODEL, {
  dtype: { vision_encoder: "q4", embed_tokens: "fp16", decoder_model_merged: "q4" },
});
const processor = await AutoProcessor.from_pretrained(MODEL);

async function downscale(img: RawImage, maxSize: number | null): Promise<RawImage> {
  const longest = Math.max(img.width, img.height);
  if (!maxSize || longest <= maxSize) return img;
  const scale = maxSize / longest;
  return img.resize(Math.round(img.width * scale), Math.round(img.height * scale));
}

async function describe(img: RawImage, push: (text: string) => void): Promise<void> {
  const messages = [
    { role: "user", content: [{ type: "image" }, { type: "text", text: "Describe this image." }] },
  ] as unknown as Parameters<typeof processor.apply_chat_template>[0];
  const text = processor.apply_chat_template(messages, { add_generation_prompt: true });
  const inputs = await processor(text, img);
  let answer = "";
  const streamer = new TextStreamer(processor.tokenizer!, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (token: string) => push((answer += token).trim()),
  });
  await model.generate({ ...inputs, max_new_tokens: 256, streamer });
}

const photo = upload({ accept: "image/*" });
const size = dropdown({ choices: ["256", "512", "768", "1024", "Original"], value: "768" });
const go = button({ label: "Describe" });
const caption = output();

const app = knobkit({
  title: "Describe an image",
  description: "Upload an image, pick a downscale size; Qwen2-VL describes what it sees.",
  widgets: col(photo, row(size, go), caption),
});

app.on(
  go.clicked,
  go.busy(async () => {
    const file = await photo.value();
    if (!file) return void caption.set("(upload an image first)");
    const m = /^data:([^;]+);base64,(.*)$/s.exec(file.url)!;
    const raw = await RawImage.fromBlob(new Blob([Buffer.from(m[2], "base64")], { type: m[1] }));
    const size_ = await size.value();
    const maxSize = size_ === "Original" ? null : Number(size_);
    await describe(await downscale(raw, maxSize), (text) => caption.set(text));
  }),
);

app.serve();
