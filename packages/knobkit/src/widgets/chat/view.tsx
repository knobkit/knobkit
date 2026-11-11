import "../_primitives/controls.css";
import {
  puAttach,
  puAttachX,
  puAttachment,
  puChat,
  puChatMessages,
  puChatStop,
  puChatTool,
  puChatToolAccept,
  puChatToolActions,
  puChatToolBody,
  puChatToolBrief,
  puChatToolDiff,
  puChatToolDot,
  puChatToolFail,
  puChatToolHead,
  puChatToolName,
  puChatToolReject,
  puChatToolStatus,
  puComposer,
  puInput,
  puMic,
  puMsg,
  puMsgError,
  puMsgImage,
  puMsgMd,
  puMsgQueued,
  puMsgQueuedTag,
  puMsgWaiting,
  puRec,
  puUser,
} from "./chat.css.js";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { mediaUrl, toMedia } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";
import type { Message, ToolCall, ToolDiff } from "./def.js";
import { computeDiff, splitLines, UnifiedView } from "../diff/lines.js";

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

const brief = (input: unknown): string => (input === undefined ? "" : typeof input === "string" ? input : JSON.stringify(input));
const pretty = (input: unknown): string => (typeof input === "string" ? input : JSON.stringify(input, null, 2));

function CallDiff({ diff }: { diff: ToolDiff }) {
  const lines = useMemo(() => computeDiff(splitLines(diff.oldContent), splitLines(diff.newContent)), [diff.oldContent, diff.newContent]);
  return (
    <div className={puChatToolDiff}>
      <UnifiedView lines={lines} />
    </div>
  );
}

function ToolCard({ call, decide }: { call: ToolCall; decide: (decision: "accept" | "reject") => void }) {
  const awaiting = call.status === "awaiting";
  // a call that wants a decision opens itself: what is being decided should not be a click away
  const [open, setOpen] = useState(awaiting);
  const shown = open || awaiting;
  return (
    <div className={puChatTool} data-call={call.id} data-status={call.status}>
      <button type="button" className={puChatToolHead} aria-expanded={shown} onClick={() => setOpen(!shown)}>
        <span className={`${puChatToolDot} pu-chat-tool-dot--${call.status}`} />
        <span className={puChatToolName}>{call.name}</span>
        <span className={puChatToolBrief}>{call.diff?.path ?? brief(call.input)}</span>
        <span className={puChatToolStatus}>{awaiting ? "needs a decision" : call.status}</span>
      </button>
      {shown && call.diff && <CallDiff diff={call.diff} />}
      {shown && !call.diff && call.input !== undefined && <pre className={puChatToolBody}>{pretty(call.input)}</pre>}
      {shown && call.result !== undefined && (
        <pre className={`${puChatToolBody}${call.status === "error" ? ` ${puChatToolFail}` : ""}`}>{call.result}</pre>
      )}
      {awaiting && (
        <div className={puChatToolActions}>
          <button type="button" className={puChatToolAccept} onClick={() => decide("accept")}>
            Accept
          </button>
          <button type="button" className={puChatToolReject} onClick={() => decide("reject")}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

interface State {
  messages: Message[];
  streams: Record<string, string>;
  tools: Record<string, ToolCall>;
  queued: string[];
  running: boolean;
  /** set by the dispatcher: the corr of the latest `sent` whose handler has begun */
  $started?: string;
}

interface Props {
  placeholder: string;
  voice: boolean;
  images: boolean;
  markdown: boolean;
}

export default function ChatView({ props, state, emit, send, set }: ViewProps<State, Props>) {
  const messages = state.messages ?? [];
  const streams = state.streams ?? {};
  const tools = state.tools ?? {};
  const queued = state.queued ?? [];

  // follow the conversation while the reader is at the end of it; leave them alone once they scroll up
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  });
  // the box itself changes height too (a pane is dragged, the layout settles around it)
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => {
      if (following.current) el.scrollTop = el.scrollHeight;
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const decide = (id: string, decision: "accept" | "reject"): void => {
    // settle the card at once, so a second click has nothing to press
    set(["tools", id, "status"], decision === "accept" ? "running" : "rejected");
    emit("decided", { id, decision });
  };

  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const pressedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<MediaRef | null>(null);

  // What was sent and has not reached its handler yet. With handlers run one after another, a
  // message sent during a run waits for the run to end; it is shown, marked, until its turn comes
  // — at which point the handler says it, as it would have anyway.
  const [waiting, setWaiting] = useState<{ corr: string; text: string }[]>([]);
  const started = state.$started;
  useEffect(() => {
    // handlers start in the order sent, so everything up to the one that began is no longer waiting
    setWaiting((w) => {
      const i = w.findIndex((m) => m.corr === started);
      return i < 0 ? w : w.slice(i + 1);
    });
  }, [started]);

  const submit = (input: HTMLInputElement): void => {
    if (!input.value.trim() && !pending) return;
    const text = input.value;
    const corr = emit("sent", { text, image: pending ?? undefined });
    if (corr) setWaiting((w) => [...w, { corr, text }]);
    following.current = true; // sending is asking to see what comes back
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
    <div className={puChat}>
      <div
        ref={scroller}
        className={puChatMessages}
        onScroll={(e) => {
          const el = e.currentTarget;
          following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {messages.map((m, i) => {
          if (m.role === "tool") {
            const call = m.call ? tools[m.call] : undefined;
            return call ? <ToolCard key={i} call={call} decide={(d) => decide(call.id, d)} /> : null;
          }
          const content = m.id && streams[m.id] ? m.content + streams[m.id] : m.content;
          const asMarkdown = props.markdown && m.role === "assistant";
          return (
            <div
              key={i}
              className={`${puMsg} pu-${m.role}${asMarkdown ? ` ${puMsgMd}` : ""}${m.role === "error" ? ` ${puMsgError}` : ""}`}
              role={m.role === "error" ? "alert" : undefined}
            >
              <b>{m.role}:</b>{" "}
              {asMarkdown ? (
                <Suspense fallback={<span>{content}</span>}>
                  <Markdown value={content} />
                </Suspense>
              ) : (
                content
              )}
              {m.image && <img className={puMsgImage} src={imageSrc(m.image)} alt="" />}
            </div>
          );
        })}
        {waiting.map((m) => (
          <div key={m.corr} className={`${puMsg} ${puUser} ${puMsgQueued} ${puMsgWaiting}`}>
            {m.text}
            <span className={puMsgQueuedTag}>waiting</span>
          </div>
        ))}
        {queued.map((text, i) => (
          <div key={`queued-${i}`} className={`${puMsg} ${puUser} ${puMsgQueued}`}>
            {text}
            <span className={puMsgQueuedTag}>queued</span>
          </div>
        ))}
      </div>
      {pending && (
        <div className={puAttachment}>
          <img src={mediaUrl(pending)} alt="" />
          <button className={puAttachX} onClick={() => setPending(null)} aria-label="Remove image">
            ✕
          </button>
        </div>
      )}
      <div className={puComposer}>
        {props.images && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
            <button className={puAttach} onClick={() => fileRef.current?.click()} aria-label="Attach image">
              +
            </button>
          </>
        )}
        <input
          className={puInput}
          placeholder={props.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(e.currentTarget);
          }}
        />
        {state.running && (
          // beside the input, not in place of it: the next message can be typed during a run
          <button type="button" className={puChatStop} onClick={() => emit("stopped")} aria-label="Stop">
            <span aria-hidden="true" />
            Stop
          </button>
        )}
        {props.voice && (
          <button
            className={`${puMic}${recording ? ` ${puRec}` : ""}`}
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
