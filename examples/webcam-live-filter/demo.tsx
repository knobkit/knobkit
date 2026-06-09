import { knobkit, webcam, image } from "knobkit";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarker: FaceLandmarker;

const HAT = "🎩";
const FOREHEAD = 10;
const CHEEK_L = 454;
const CHEEK_R = 234;
const EYE_L = 263;
const EYE_R = 33;

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

const stage = document.createElement("canvas");
const ctx = stage.getContext("2d")!;

const camera = webcam({ every: 120, preview: false });
const result = image();

const app = knobkit({
  title: "Funny hats",
  description: "MediaPipe finds your face in each webcam frame and drops a hat on it — tilted and scaled to your head.",
  widgets: [camera, result],
});

app.setup(async () => {
  camera.busyStart();
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 1,
  });
  camera.busyEnd();
});

let processing = false;
app.on(camera.frame, async (dataUrl: string) => {
  if (processing) return; // drop frames we can't keep up with
  processing = true;
  try {
    const img = await loadImage(dataUrl);
    stage.width = img.naturalWidth;
    stage.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const face = landmarker.detectForVideo(img, performance.now()).faceLandmarks?.[0];
    if (face) {
      const px = (i: number) => ({ x: face[i]!.x * stage.width, y: face[i]!.y * stage.height });
      const head = px(FOREHEAD);
      const faceW = Math.hypot(px(CHEEK_L).x - px(CHEEK_R).x, px(CHEEK_L).y - px(CHEEK_R).y);
      const roll = Math.atan2(px(EYE_L).y - px(EYE_R).y, px(EYE_L).x - px(EYE_R).x);
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(roll);
      ctx.font = `${faceW * 1.6}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(HAT, 0, faceW * 0.25);
      ctx.restore();
    }
    result.set(stage.toDataURL("image/jpeg", 0.85));
  } finally {
    processing = false;
  }
});

app.mount("#root");
