import "./mic.css";
import { useEffect, useRef } from "react";
import type { ViewProps } from "../../view.js";
import type { MicWidget } from "../../../lib/widgets/mic.js";

export function MicView({ widget, state, enabled, emit, set }: ViewProps<MicWidget, { live: boolean }>) {
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const startingRef = useRef(false);

  // capture follows `live`; the view sets `live` locally so it starts/stops without a round-trip
  const toggle = (live: boolean): void => {
    set(["live"], live);
    emit(widget.toggled(live));
  };

  useEffect(() => {
    let cancelled = false;

    if (state.live && enabled && !streamRef.current && !startingRef.current && navigator.mediaDevices?.getUserMedia) {
      startingRef.current = true;
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          streamRef.current = stream;
          const ac = new AudioContext({ sampleRate: 16000 });
          const record = (): void => {
            if (streamRef.current !== stream) return;
            const chunks: Blob[] = [];
            const rec = new MediaRecorder(stream);
            recRef.current = rec;
            rec.ondataavailable = (e) => chunks.push(e.data);
            rec.onstop = async () => {
              const a = await ac.decodeAudioData(await new Blob(chunks).arrayBuffer());
              emit(widget.clip(a.getChannelData(0)));
              if (widget.every > 0 && streamRef.current === stream) record();
            };
            rec.start();
            if (widget.every > 0) setTimeout(() => rec.stop(), widget.every);
          };
          record();
        } catch (err) {
          console.error(err);
        } finally {
          startingRef.current = false;
        }
      })();
    } else if ((!state.live || !enabled) && streamRef.current) {
      if (recRef.current?.state === "recording") recRef.current.stop();
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recRef.current = null;
    }

    return () => {
      cancelled = true;
    };
  }, [state.live, enabled]);

  if (!widget.control) return null;

  const streaming = widget.every > 0;
  const cls = `pu-submit${state.live ? " pu-rec" : ""}`;

  if (!streaming && widget.hold) {
    return (
      <button
        className={cls}
        disabled={!enabled}
        onPointerDown={() => toggle(true)}
        onPointerUp={() => toggle(false)}
        onPointerLeave={() => state.live && toggle(false)}
      >
        {state.live ? "● Recording…" : "Hold to talk"}
      </button>
    );
  }

  return (
    <button className={cls} disabled={!enabled} onClick={() => toggle(!state.live)}>
      {state.live ? (streaming ? "● Live" : "● Recording…") : streaming ? "Go live" : "Record"}
    </button>
  );
}
