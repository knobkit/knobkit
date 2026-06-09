import "./webcam.css";
import { useEffect, useRef } from "react";
import type { ViewProps } from "../../view.js";
import type { WebcamWidget } from "../../../lib/widgets/webcam.js";

export function WebcamView({ widget, state, enabled, emit, set }: ViewProps<WebcamWidget, { live: boolean }>) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: widget.facing } });
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          streamRef.current = stream;
          const video = videoRef.current!;
          video.srcObject = stream;
          await video.play();

          if (widget.every > 0) {
            const canvas = document.createElement("canvas");
            timerRef.current = setInterval(() => {
              if (streamRef.current !== stream || video.readyState < 2 || !video.videoWidth) return;
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              canvas.getContext("2d")?.drawImage(video, 0, 0);
              emit(widget.frame(canvas.toDataURL("image/jpeg", 0.8)));
            }, widget.every);
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

  const mirror = widget.facing === "user" ? " pu-webcam-mirror" : "";

  return (
    <div className="pu-webcam">
      {widget.preview ? (
        <div className="pu-webcam-stage">
          <video ref={videoRef} className={`pu-webcam-video${mirror}`} muted playsInline />
          {!state.live && <div className="pu-webcam-placeholder">Camera off</div>}
        </div>
      ) : (
        // kept alive off-screen so capture still has a frame source, but nothing renders
        <video ref={videoRef} className="pu-webcam-offscreen" muted playsInline />
      )}
      {widget.control && (
        <button className={`pu-submit${state.live ? " pu-rec" : ""}`} disabled={!enabled} onClick={() => toggle(!state.live)}>
          {state.live ? "● Stop camera" : "Go live"}
        </button>
      )}
    </div>
  );
}
