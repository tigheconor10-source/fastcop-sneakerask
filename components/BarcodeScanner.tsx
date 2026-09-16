"use client";

import { useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    let animFrame: number;
    let reader: any = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ("BarcodeDetector" in window) {
          const bd = new (window as any).BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"],
          });
          const scan = async () => {
            if (detectedRef.current || !videoRef.current) return;
            try {
              const codes = await bd.detect(videoRef.current);
              if (codes.length > 0) {
                handleCode(codes[0].rawValue);
                return;
              }
            } catch {}
            animFrame = requestAnimationFrame(scan);
          };
          animFrame = requestAnimationFrame(scan);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          reader = new BrowserMultiFormatReader();
          reader.decodeFromVideoElement(videoRef.current, (result: any) => {
            if (result && !detectedRef.current) handleCode(result.getText());
          });
        }
      } catch (e: any) {
        setError(
          e.name === "NotAllowedError"
            ? "Camera permission denied. Please allow access."
            : "Could not open camera: " + e.message
        );
        setScanning(false);
      }
    }

    function handleCode(code: string) {
      if (detectedRef.current) return;
      detectedRef.current = true;
      setDetected(code);
      setScanning(false);
      stopStream();
      setTimeout(() => onDetected(code), 600);
    }

    function stopStream() {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (reader) { try { reader.reset(); } catch {} }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }

    start();
    return () => {
      detectedRef.current = true;
      if (animFrame) cancelAnimationFrame(animFrame);
      if (reader) { try { reader.reset(); } catch {} }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-sm mx-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Scan box barcode</p>
            <p className="text-xs text-white/60">EAN-13 or UPC-A from the shoe box</p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4]">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />

          {scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative z-10 h-36 w-64">
                {["top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
                  "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
                  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
                  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
                ].map((cls, i) => (
                  <div key={i} className={`absolute h-6 w-6 border-white ${cls}`} />
                ))}
                <div className="absolute inset-x-3 top-1/2 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
              </div>
            </div>
          )}

          {detected && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
              <div className="text-center px-4">
                <div className="mb-3 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/40">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7"/>
                  </svg>
                </div>
                <p className="font-mono text-sm font-bold text-white">{detected}</p>
                <p className="mt-1 text-xs text-white/70">Looking up in StockX…</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="text-center">
                <p className="text-sm text-white/80 mb-3">{error}</p>
                <button onClick={handleClose} className="text-xs text-white/60 underline">Close</button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-white/40">
          Scan → StockX lookup → auto-fill SKU
        </p>
      </div>
    </div>
  );
}
