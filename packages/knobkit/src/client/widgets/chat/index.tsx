import "./chat.css";
import { lazy, Suspense, useRef, useState } from "react";
import type { ViewProps } from "../../view.js";
import type { ChatWidget, Message } from "../../../lib/widgets/chat.js";

const Markdown = lazy(() => import("../output/markdown.js"));

// shrink a picked image so attachments (and later history reads) stay small
async function downscale(dataUrl: string, max = 768): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  if (scale === 1) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ChatView({ widget, state, emit }: ViewProps<ChatWidget, { messages: Message[] }>) {
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const pressedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const send = (input: HTMLInputElement) => {
    if (!input.value.trim() && !pending) return;
    emit(widget.sent({ text: input.value, image: pending ?? undefined }));
    input.value = "";
    setPending(null);
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => setPending(await downscale(String(r.result)));
    r.readAsDataURL(f);
    e.currentTarget.value = "";
  };

  const start = async () => {
    if (streamRef.current || pressedRef.current || !navigator.mediaDevices?.getUserMedia) return;
    pressedRef.current = true;
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!pressedRef.current) return stream.getTracks().forEach((t) => t.stop());
    streamRef.current = stream;
    const ac = new AudioContext({ sampleRate: 16000 });
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    recRef.current = rec;
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      const a = await ac.decodeAudioData(await new Blob(chunks).arrayBuffer());
      emit(widget.recorded(a.getChannelData(0)));
    };
    rec.start();
  };

  const stop = () => {
    pressedRef.current = false;
    setRecording(false);
    if (recRef.current?.state === "recording") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  };

  return (
    <div className="pu-chat">
      {state.messages.map((m, i) => {
        const asMarkdown = widget.markdown && m.role === "assistant";
        return (
          <div key={i} className={`pu-msg pu-${m.role}${asMarkdown ? " pu-msg-md" : ""}`}>
            <b>{m.role}:</b>{" "}
            {asMarkdown ? (
              <Suspense fallback={<span>{m.content}</span>}>
                <Markdown value={m.content} />
              </Suspense>
            ) : (
              m.content
            )}
            {m.image && <img className="pu-msg-image" src={m.image} alt="" />}
          </div>
        );
      })}
      {pending && (
        <div className="pu-attachment">
          <img src={pending} alt="" />
          <button className="pu-attach-x" onClick={() => setPending(null)} aria-label="Remove image">
            ✕
          </button>
        </div>
      )}
      <div className="pu-composer">
        {widget.images && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
            <button className="pu-attach" onClick={() => fileRef.current?.click()} aria-label="Attach image">
              +
            </button>
          </>
        )}
        <input
          className="pu-input"
          placeholder={widget.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") send(e.currentTarget);
          }}
        />
        {widget.voice && (
          <button
            className={`pu-mic${recording ? " pu-rec" : ""}`}
            onPointerDown={start}
            onPointerUp={stop}
            onPointerLeave={() => pressedRef.current && stop()}
            aria-label="Hold to talk"
          >
            {recording ? "●" : "🎤"}
          </button>
        )}
      </div>
    </div>
  );
}
