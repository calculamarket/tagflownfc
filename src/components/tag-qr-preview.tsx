import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function TagQrPreview({ id, size = 200 }: { id: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;
    const url = `${window.location.origin}/t/${id}`;
    QRCode.toCanvas(canvas, url, {
      width: size, margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(() => {});
  }, [id, size]);

  return (
    <div className="grid place-items-center rounded-md border border-border bg-white p-3">
      <canvas ref={canvasRef} />
    </div>
  );
}
