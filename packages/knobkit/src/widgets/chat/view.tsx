import "./chat.css";
import { lazy, Suspense, useRef, useState } from "react";
import { mediaUrl, toMedia } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";
import type { Message } from "./def.js";

const Markdown = lazy(() => import("../output/markdown.js"));

// bytes go to the media store; only the ref rides in the payload and state
async function pickImage(file: File, max = 768): Promise<MediaRef> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
  return toMedia(blob, "image/jpeg");
}

const imageSrc = (image: MediaRef | string): string => (typeof image === "string" ? image : mediaUrl(image));

interface Props {
  placeholder: string;
  voice: boolean;
  images: boolean;
  markdown: boolean;
}

export default function ChatView({ props, state, emit, send }: ViewProps<{ messages: Message[] }, Props>) {
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const pressedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<MediaRef | null>(null);

  const submit = (input: HTMLInputElement): void => {
    if (!input.value.trim() && !pending) return;
    emit("sent", { text: input.value, image: pending ?? undefined });
    input.value = "";
    setPending(null);
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (f) setPending(await pickImage(f));
  };

  const start = async (): Promise<void> => {
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
      send("recorded", a.getChannelData(0));
    };
    rec.start();
  };

  const stop = (): void => {
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
        const asMarkdown = props.markdown && m.role === "assistant";
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
            {m.image && <img className="pu-msg-image" src={imageSrc(m.image)} alt="" />}
          </div>
        );
      })}
      {pending && (
        <div className="pu-attachment">
          <img src={mediaUrl(pending)} alt="" />
          <button className="pu-attach-x" onClick={() => setPending(null)} aria-label="Remove image">
            ✕
          </button>
        </div>
      )}
      <div className="pu-composer">
        {props.images && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
            <button className="pu-attach" onClick={() => fileRef.current?.click()} aria-label="Attach image">
              +
            </button>
          </>
        )}
        <input
          className="pu-input"
          placeholder={props.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(e.currentTarget);
          }}
        />
        {props.voice && (
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
