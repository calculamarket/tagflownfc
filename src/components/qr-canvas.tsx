import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/** Renders any string payload as a QR code on a canvas. */
export function QrCanvas({
  value,
  size = 200,
  dark = "#0f172a",
  light = "#ffffff",
  className,
}: {
  value: string;
  size?: number;
  dark?: string;
  light?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      color: { dark, light },
      errorCorrectionLevel: "M",
    }).catch(() => {});
  }, [value, size, dark, light]);

  if (!value) return null;
  return <canvas ref={canvasRef} className={className} />;
}
