import QRCode from "qrcode";

// Gera uma FOLHA SVG vetorial com vários QR codes, cada um como uma "plaquinha"
// para impressão 3D: a arte é em milímetros (1 unidade SVG = 1 mm), então
// importa direto no Fusion/Tinkercad/slicer e é só extrudar.
//
// Cada QR sai como um <g> próprio (dá para selecionar/extrudar individualmente):
//   - retângulo da plaquinha (borda arredondada) — opcional;
//   - módulos escuros do QR, já com zona de silêncio de 4 módulos ao redor
//     (senão não escaneia numa peça monocromática).

export type QrSvgSheetCfg = {
  qrMm: number; // lado da área do QR (sem a borda), em mm
  border: boolean; // desenhar o contorno da plaquinha
  columns: number; // colunas na folha
  gapMm?: number; // espaço entre plaquinhas
};

const QUIET_MODULES = 4; // zona de silêncio padrão do QR
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Une módulos escuros contíguos de uma linha num único retângulo (SVG menor). */
function rowRuns(data: Uint8Array, size: number, row: number): [number, number][] {
  const runs: [number, number][] = [];
  let col = 0;
  while (col < size) {
    if (data[row * size + col] === 1) {
      const start = col;
      while (col < size && data[row * size + col] === 1) col++;
      runs.push([start, col - start]);
    } else {
      col++;
    }
  }
  return runs;
}

/** Um QR desenhado em mm, dentro de um <g> transladado para (ox, oy). */
function qrGroup(text: string, cfg: QrSvgSheetCfg, ox: number, oy: number): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;

  const moduleMm = cfg.qrMm / size;
  const margin = QUIET_MODULES * moduleMm; // zona de silêncio branca
  const plaque = cfg.qrMm + margin * 2;

  const parts: string[] = [];
  parts.push(`<g transform="translate(${round(ox)},${round(oy)})">`);

  // Plaquinha (fundo branco + contorno opcional).
  const stroke = cfg.border ? ` stroke="#999" stroke-width="0.2"` : "";
  parts.push(
    `<rect x="0" y="0" width="${round(plaque)}" height="${round(plaque)}" rx="2" ry="2" fill="#ffffff"${stroke}/>`,
  );

  // Módulos escuros, deslocados pela margem/zona de silêncio.
  const rects: string[] = [];
  for (let r = 0; r < size; r++) {
    for (const [start, len] of rowRuns(data, size, r)) {
      const x = margin + start * moduleMm;
      const y = margin + r * moduleMm;
      rects.push(
        `<rect x="${round(x)}" y="${round(y)}" width="${round(len * moduleMm)}" height="${round(moduleMm)}"/>`,
      );
    }
  }
  parts.push(`<g fill="#000000">${rects.join("")}</g>`);
  parts.push(`</g>`);
  return parts.join("");
}

/** Monta a folha SVG inteira com todos os QR do lote. */
export function buildQrSvgSheet(
  rows: { id: string }[],
  origin: string,
  cfg: QrSvgSheetCfg,
): string {
  const cols = Math.max(1, Math.floor(cfg.columns) || 1);
  const gap = cfg.gapMm ?? 3;
  const pageMargin = 8;

  // Tamanho de uma célula = plaquinha + espaço. A plaquinha depende do QR:
  // recalcula a partir de um QR de referência (todos têm tamanho parecido).
  const refSize = QRCode.create(`${origin}/t/${rows[0]?.id ?? "x"}`, { errorCorrectionLevel: "M" })
    .modules.size;
  const moduleMm = cfg.qrMm / refSize;
  const plaque = cfg.qrMm + QUIET_MODULES * moduleMm * 2;
  const cell = plaque + gap;

  const n = rows.length;
  const rowsCount = Math.ceil(n / cols);
  const width = round(pageMargin * 2 + cols * plaque + (cols - 1) * gap);
  const height = round(pageMargin * 2 + rowsCount * plaque + (rowsCount - 1) * gap);

  const groups = rows.map((r, i) => {
    const c = i % cols;
    const rw = Math.floor(i / cols);
    const ox = pageMargin + c * cell;
    const oy = pageMargin + rw * cell;
    return qrGroup(`${origin}/t/${r.id}`, cfg, ox, oy);
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
    groups.join("") +
    `</svg>`
  );
}
