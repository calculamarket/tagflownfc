import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export type QrStyle = {
  dark?: string;
  light?: string;
  logo_url?: string;
  caption?: string;
};

/**
 * Renders the tag's short-URL QR code with optional branding (colors, center
 * logo, caption). Everything is drawn onto the canvas so the PNG download
 * matches the preview exactly.
 */
export function TagQrPreview({
  id,
  size = 200,
  style = {},
  downloadable = false,
}: {
  id: string;
  size?: number;
  style?: QrStyle;
  downloadable?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dark = style.dark || "#0f172a";
  const light = style.light || "#ffffff";
  const caption = style.caption?.trim() || "";
  const logoUrl = style.logo_url?.trim() || "";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;
    const url = `${window.location.origin}/t/${id}`;
    const captionH = caption ? Math.round(size * 0.14) : 0;

    let cancelled = false;

    (async () => {
      const tmp = document.createElement("canvas");
      await QRCode.toCanvas(tmp, url, {
        width: size,
        margin: 1,
        color: { dark, light },
        errorCorrectionLevel: logoUrl ? "H" : "M",
      });
      if (cancelled) return;

      canvas.width = size;
      canvas.height = size + captionH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tmp, 0, 0);

      if (caption) {
        ctx.fillStyle = dark;
        ctx.font = `600 ${Math.round(size * 0.075)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(caption, size / 2, size + captionH / 2, size * 0.94);
      }

      const drawLogo = () => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (cancelled) return;
          const s = size * 0.24;
          const x = (size - s) / 2;
          const y = (size - s) / 2;
          const pad = s * 0.12;
          ctx.fillStyle = light;
          ctx.fillRect(x - pad, y - pad, s + pad * 2, s + pad * 2);
          ctx.drawImage(img, x, y, s, s);
        };
        img.onerror = () => {};
        img.src = logoUrl;
      };
      if (logoUrl) drawLogo();
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, size, dark, light, caption, logoUrl]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `3dqr-${id}.png`;
    a.click();
  };

  return (
    <div className="space-y-2">
      <div className="grid place-items-center rounded-md border border-border bg-white p-3">
        <canvas ref={canvasRef} />
      </div>
      {downloadable && (
        <button
          type="button"
          onClick={download}
          className="w-full rounded-md border border-input bg-background py-1.5 text-xs font-medium hover:bg-accent"
        >
          Baixar PNG
        </button>
      )}
    </div>
  );
}
