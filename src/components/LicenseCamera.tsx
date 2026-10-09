'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaCamera, FaRedo, FaCheck, FaVideoSlash } from 'react-icons/fa';

interface LicenseCameraProps {
  // The captured photo (JPEG), or null after "Retake".
  onPhoto: (photo: Blob | null) => void;
}

const MAX_WIDTH = 1600;
const CARD_RATIO = 85.6 / 54; // ID-1 card size

type CameraState = 'off' | 'starting' | 'live' | 'taken' | 'denied' | 'none';

// The license photo is taken here, with the camera, never picked from the
// gallery (E, follow-up): harder to submit an edited or borrowed image.
// The camera turns on only when the user taps "Open camera", and off again
// after the photo, on Cancel, when the page is hidden, or when it's left.
export default function LicenseCamera({ onPhoto }: LicenseCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // False once the user cancels or leaves, so a camera still starting turns straight off.
  const wantedRef = useRef(false);
  const [state, setState] = useState<CameraState>('off');
  const [preview, setPreview] = useState<string | null>(null);

  const stop = useCallback(() => {
    wantedRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setState('starting');
    wantedRef.current = true;
    if (!navigator.mediaDevices?.getUserMedia) return setState('none');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (!wantedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState('live');
    } catch (err) {
      const name = (err as DOMException)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'none');
    }
  }, []);

  // Off on leaving the page, and when the user switches app or tab.
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden' && (streamRef.current || wantedRef.current)) {
        stop();
        setState('off');
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      stop();
    };
  }, [stop]);

  function cancel() {
    stop();
    setState('off');
  }

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function take() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPreview(URL.createObjectURL(blob));
        onPhoto(blob);
        setState('taken');
        stop();
      },
      'image/jpeg',
      0.9
    );
  }

  function retake() {
    setPreview(null);
    onPhoto(null);
    setState('off');
  }

  if (state === 'denied' || state === 'none') {
    return (
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
        <p className="font-semibold">{state === 'denied' ? 'Allow the camera for this site' : 'No camera found'}</p>
        <p>
          {state === 'denied'
            ? 'Your browser blocked the camera. Allow it in the site settings (the icon next to the address), then try again.'
            : 'The license photo has to be taken with a camera. Open this page on your phone.'}
        </p>
        {state === 'denied' && (
          <button type="button" onClick={() => void start()} className="rsu-btn-secondary px-3 py-1.5 text-xs">
            Try again
          </button>
        )}
      </div>
    );
  }

  if (state === 'off') {
    return (
      <div className="space-y-2">
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center"
          style={{ aspectRatio: '4 / 3' }}
        >
          <FaVideoSlash className="h-6 w-6 text-gray-400" aria-hidden />
          <p className="text-sm font-semibold text-gray-700">Camera is off</p>
          <p className="max-w-xs text-xs text-gray-500">It turns on only when you tap the button below, and off again right after the photo.</p>
        </div>
        <button type="button" onClick={() => void start()} className="rsu-btn-primary flex w-full items-center justify-center gap-2">
          <FaCamera className="h-4 w-4" aria-hidden /> Open camera
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '4 / 3' }}>
        {state === 'taken' && preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your license photo" className="h-full w-full object-contain" />
            {/* A status, not a button: a label on the photo itself. */}
            <p role="status" className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
              <FaCheck className="h-3 w-3 text-emerald-400" aria-hidden /> Photo taken
            </p>
          </>
        ) : (
          <>
            <video ref={videoRef} playsInline muted aria-label="Camera preview" className="h-full w-full object-cover" />
            {/* A card-shaped guide to line the license up with. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={{ aspectRatio: String(CARD_RATIO) }}
            />
            {state === 'starting' && <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white">Starting the camera…</p>}
          </>
        )}
      </div>
      {state === 'taken' ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Check that your name, the number and the expiry date are readable.</p>
          <button type="button" onClick={retake} className="rsu-btn-secondary flex shrink-0 items-center gap-2 px-3 py-2 text-sm">
            <FaRedo className="h-3 w-3" aria-hidden /> Retake
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={cancel} className="rsu-btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={state !== 'live'}
            onClick={take}
            className="rsu-btn-primary flex flex-1 items-center justify-center gap-2 disabled:opacity-60"
          >
            <FaCamera className="h-4 w-4" aria-hidden /> Take photo
          </button>
        </div>
      )}
      {state !== 'taken' && <p className="text-xs text-gray-500">Fit the license inside the frame. Make sure your name, the number and the expiry date are sharp, with no glare.</p>}
    </div>
  );
}
