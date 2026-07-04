import { knobkit, upload, button, output, col } from "knobkit";
import { pipeline, RawImage } from "@huggingface/transformers";

// A server-side image-captioning model, loaded once when the Node server starts.
const captioner = await pipeline("image-to-text", "Xenova/vit-gpt2-image-captioning");

const photo = upload({ accept: "image/*" });
const go = button({ label: "Caption" });
const caption = output();

const app = knobkit({
  title: "Image captioner",
  description: "Upload an image; a server-side model writes a caption for it.",
  widgets: col(photo, go, caption),
});

app.on(
  go.clicked,
  go.busy(async () => {
    const file = await photo.value();
    if (!file) return void caption.set("(upload an image first)");
    const m = /^data:([^;]+);base64,(.*)$/s.exec(file.url);
    if (!m) return void caption.set("(could not read that image)");
    const img = await RawImage.fromBlob(new Blob([Buffer.from(m[2]!, "base64")], { type: m[1] }));
    caption.set("Captioning…");
    const out = (await captioner(img)) as Array<{ generated_text: string }>;
    caption.set(out[0]?.generated_text?.trim() || "(no caption)");
  }),
);

app.serve();
