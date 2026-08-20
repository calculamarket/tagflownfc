// Envio de e-mail via Resend (server-only). NUNCA lança e é no-op quando
// RESEND_API_KEY não está definido — assim o escaneamento nunca quebra e o
// recurso fica "adormecido" até você configurar a chave no Lovable.
//
// Config (variáveis de ambiente no Lovable):
//   RESEND_API_KEY  — chave da API do Resend (obrigatória para ligar o e-mail)
//   RESEND_FROM     — remetente verificado, ex.: "3D QR <avisos@3dqr.com.br>"
//                     (sem isso, usa o remetente de teste do Resend, que só
//                      entrega para o e-mail dono da conta Resend)
import { BRAND } from "./brand";

type ScanInfo = {
  tagId: string;
  tagName?: string;
  city?: string | null;
  country?: string | null;
  source?: string | null;
  appOrigin?: string;
};

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendScanEmail(ownerId: string, info: ScanInfo): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return; // e-mail desligado até configurar a chave

    const from = process.env.RESEND_FROM || `${BRAND.name} <onboarding@resend.dev>`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", ownerId)
      .maybeSingle();
    const to = profile?.email;
    if (!to) return;

    const tagName = info.tagName || "Sua etiqueta";
    const place = [info.city, info.country].filter(Boolean).join(", ");
    const medium = info.source === "nfc" ? "NFC" : info.source === "qr" ? "QR Code" : null;
    const when = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const link = info.appOrigin ? `${info.appOrigin}/notificacoes` : "";

    const rows = [
      place ? `<tr><td style="color:#666;padding:2px 12px 2px 0">Local aproximado</td><td>${esc(place)}</td></tr>` : "",
      medium ? `<tr><td style="color:#666;padding:2px 12px 2px 0">Origem</td><td>${esc(medium)}</td></tr>` : "",
      `<tr><td style="color:#666;padding:2px 12px 2px 0">Quando</td><td>${esc(when)}</td></tr>`,
    ].join("");

    const subject = `🔔 "${tagName}" foi escaneada`;
    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:system-ui,Arial,sans-serif;color:#111">
<div style="max-width:480px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
  <div style="padding:20px 24px;border-bottom:1px solid #eee;font-weight:600">${esc(BRAND.name)}</div>
  <div style="padding:24px">
    <h1 style="font-size:18px;margin:0 0 6px">Sua etiqueta foi escaneada</h1>
    <p style="margin:0 0 16px;color:#444">Alguém acabou de acessar <strong>"${esc(tagName)}"</strong>.</p>
    <table style="font-size:14px;border-collapse:collapse;margin-bottom:20px">${rows}</table>
    ${link ? `<a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">Ver no ${esc(BRAND.name)}</a>` : ""}
    <p style="margin:20px 0 0;color:#999;font-size:12px">Você recebe este aviso porque ativou "Avisar quando escanearem" nesta etiqueta.</p>
  </div>
</div></body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch {
    // silencioso — aviso por e-mail nunca pode quebrar o escaneamento
  }
}
