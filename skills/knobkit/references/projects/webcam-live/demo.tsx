import { knobkit, webcam, image } from "knobkit";

// A live webcam filter: the camera emits a frame every `every` ms; each frame is inverted on a
// canvas and shown. The `processing` guard drops frames we can't keep up with — essential for any
// continuous stream so the handler never backs up.
const stage = document.createElement("canvas");
const ctx = stage.getContext("2d")!;

const camera = webcam({ every: 120, preview: false });
const result = image();

const app = knobkit({
  title: "Live filter",
  description: "Inverts each webcam frame in real time.",
  widgets: [camera, result],
});

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

let processing = false;
app.on(camera.frame, async (dataUrl: string) => {
  if (processing) return; // drop frames we can't keep up with
  processing = true;
  try {
    const img = await loadImage(dataUrl);
    stage.width = img.naturalWidth;
    stage.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const frame = ctx.getImageData(0, 0, stage.width, stage.height);
    const px = frame.data;
    for (let i = 0; i < px.length; i += 4) {
      px[i] = 255 - px[i]!;
      px[i + 1] = 255 - px[i + 1]!;
      px[i + 2] = 255 - px[i + 2]!;
    }
    ctx.putImageData(frame, 0, 0);
    result.set(stage.toDataURL("image/jpeg", 0.85));
  } finally {
    processing = false;
  }
});

app.mount("#root");
