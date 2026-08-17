import { puRec, puSubmit } from "../_primitives/controls.css.js";
import { puWebcam, puWebcamMirror, puWebcamOffscreen, puWebcamPlaceholder, puWebcamStage, puWebcamVideo } from "./webcam.css.js";
import { useEffect, useRef } from "react";
import { toMedia } from "@knobkit/core";
import type { ViewProps } from "@knobkit/core/client";

interface Props {
  every: number;
  preview: boolean;
}

export default function WebcamView({ props, state, send, set }: ViewProps<{ live: boolean }, Props>) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);
  const enabled = state.$enabled !== false;

  // capture follows `live`; the view sets `live` locally so it starts/stops without a round-trip
  const toggle = (live: boolean): void => set(["live"], live);

  useEffect(() => {
    let cancelled = false;

    if (state.live && enabled && !streamRef.current && !startingRef.current && navigator.mediaDevices?.getUserMedia) {
      startingRef.current = true;
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          streamRef.current = stream;
          const video = videoRef.current!;
          video.srcObject = stream;
          await video.play();

          if (props.every > 0) {
            const canvas = document.createElement("canvas");
            timerRef.current = setInterval(() => {
              if (streamRef.current !== stream || video.readyState < 2 || !video.videoWidth) return;
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              canvas.getContext("2d")?.drawImage(video, 0, 0);
              // bytes go to the media store; only the ref rides the channel
              canvas.toBlob((b) => b && send("frame", toMedia(b, "image/jpeg")), "image/jpeg", 0.8);
            }, props.every);
          }
        } catch (err) {
          console.error(err);
        } finally {
          startingRef.current = false;
        }
      })();
    } else if ((!state.live || !enabled) && streamRef.current) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    return () => {
      cancelled = true;
    };
  }, [state.live, enabled]);

  return (
    <div className={puWebcam}>
      {props.preview ? (
        <div className={puWebcamStage}>
          <video ref={videoRef} className={`${puWebcamVideo} ${puWebcamMirror}`} muted playsInline />
          {!state.live && <div className={puWebcamPlaceholder}>Camera off</div>}
        </div>
      ) : (
        // kept alive off-screen so capture still has a frame source, but nothing renders
        <video ref={videoRef} className={puWebcamOffscreen} muted playsInline />
      )}
      <button className={`${puSubmit}${state.live ? ` ${puRec}` : ""}`} onClick={() => toggle(!state.live)}>
        {state.live ? "● Stop camera" : "Go live"}
      </button>
    </div>
  );
}
