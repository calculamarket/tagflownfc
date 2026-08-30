import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";
import type { Tri } from "./pet-tag-3d";

export type PaintKitTheme = "Animais" | "Fundo do Mar" | "Fantasia/Espaço";
type Point = [number, number];

export type PaintFigure = {
  id: string;
  name: string;
  theme: PaintKitTheme;
  emoji: string;
  /** Line-art paths in a normalized 0–100 coordinate system. */
  paths: Point[][];
};

const f = (id: string, name: string, theme: PaintKitTheme, emoji: string, paths: Point[][]): PaintFigure => ({ id, name, theme, emoji, paths });

export const PAINT_FIGURES: PaintFigure[] = [
  f("gato", "Gato", "Animais", "🐱", [[[25,70],[25,35],[38,18],[50,34],[62,18],[75,35],[75,70],[62,82],[38,82],[25,70]],[[38,50],[42,50]],[[58,50],[62,50]],[[43,65],[50,69],[57,65]]]),
  f("cachorro", "Cachorro", "Animais", "🐶", [[[28,34],[18,22],[18,54],[29,62]],[[72,34],[82,22],[82,54],[71,62]],[[28,34],[38,25],[62,25],[72,34],[72,72],[62,82],[38,82],[28,72],[28,34]],[[38,49],[42,49]],[[58,49],[62,49]],[[43,64],[50,69],[57,64]]]),
  f("leao", "Leão", "Animais", "🦁", [[[50,14],[70,20],[84,38],[82,62],[66,82],[42,86],[20,72],[14,50],[22,28],[50,14]],[[32,34],[40,24],[60,24],[70,36],[68,66],[56,76],[40,72],[30,60],[32,34]],[[39,47],[43,47]],[[57,47],[61,47]],[[43,61],[50,66],[57,61]]]),
  f("coelho", "Coelho", "Animais", "🐰", [[[34,38],[27,13],[35,9],[45,37]],[[55,37],[65,9],[73,13],[66,39]],[[31,42],[42,33],[59,34],[69,44],[69,70],[59,82],[40,81],[30,69],[31,42]],[[40,51],[44,51]],[[56,51],[60,51]],[[45,66],[50,70],[55,66]]]),
  f("borboleta", "Borboleta", "Animais", "🦋", [[[48,35],[34,20],[18,24],[16,43],[32,51],[17,59],[23,78],[42,66],[48,55]],[[52,35],[66,20],[82,24],[84,43],[68,51],[83,59],[77,78],[58,66],[52,55]],[[50,28],[50,75]],[[46,24],[39,17]],[[54,24],[61,17]]]),
  f("dinossauro", "Dinossauro", "Animais", "🦕", [[[18,72],[23,43],[35,27],[54,23],[68,30],[75,42],[84,45],[82,59],[68,62],[62,77],[48,77],[43,63],[31,62],[29,77],[18,72]],[[54,23],[59,14],[66,28]],[[42,23],[45,14],[52,23]],[[68,43],[72,43]]]),
  f("peixe", "Peixe", "Fundo do Mar", "🐠", [[[18,50],[32,31],[58,27],[76,42],[87,28],[84,50],[87,72],[76,58],[58,73],[32,69],[18,50]],[[31,32],[37,50],[31,68]],[[66,44],[70,44]]]),
  f("polvo", "Polvo", "Fundo do Mar", "🐙", [[[29,57],[27,39],[37,24],[50,19],[64,25],[73,40],[70,57]],[[29,57],[20,70],[28,80],[39,63],[35,81]],[[43,61],[43,82],[52,64],[55,82]],[[61,62],[66,80],[72,72],[70,57]],[[39,43],[43,43]],[[57,43],[61,43]]]),
  f("tartaruga", "Tartaruga", "Fundo do Mar", "🐢", [[[28,35],[44,25],[62,29],[73,43],[70,62],[55,72],[37,68],[25,54],[28,35]],[[29,39],[70,60]],[[38,28],[52,71]],[[73,43],[86,38],[84,51],[72,53]],[[27,45],[14,38]],[[29,59],[17,69]],[[65,65],[75,77]]]),
  f("cavalo-marinho", "Cavalo-marinho", "Fundo do Mar", "🌊", [[[58,19],[43,17],[34,27],[38,38],[55,37],[62,46],[59,62],[47,67],[43,76],[51,83],[63,80],[69,70]],[[58,19],[69,25],[60,31]],[[38,48],[25,53],[38,58]],[[47,26],[51,26]]]),
  f("estrela-mar", "Estrela-do-mar", "Fundo do Mar", "⭐", [[[50,13],[59,38],[85,35],[65,52],[76,78],[51,63],[27,80],[35,54],[15,38],[41,39],[50,13]],[[50,42],[50,57]],[[42,50],[58,50]]]),
  f("baleia", "Baleia", "Fundo do Mar", "🐳", [[[18,53],[31,34],[57,29],[73,38],[80,51],[88,44],[86,60],[75,59],[65,70],[42,73],[24,65],[18,53]],[[72,38],[76,24],[84,19]],[[74,34],[67,22],[65,16]],[[34,47],[38,47]],[[29,61],[43,63],[53,59]]]),
  f("unicornio", "Unicórnio", "Fantasia/Espaço", "🦄", [[[28,69],[31,41],[42,25],[62,23],[73,35],[69,58],[58,76],[39,79],[28,69]],[[48,25],[55,8],[61,25]],[[35,34],[23,24],[29,42]],[[59,42],[63,42]],[[38,58],[49,64],[60,58]]]),
  f("foguete", "Foguete", "Fantasia/Espaço", "🚀", [[[50,12],[63,25],[68,54],[58,68],[42,68],[32,54],[37,25],[50,12]],[[38,53],[23,67],[24,78],[42,67]],[[62,53],[77,67],[76,78],[58,67]],[[43,76],[50,88],[57,76]],[[43,39],[50,32],[57,39],[50,46],[43,39]]]),
  f("astronauta", "Astronauta", "Fantasia/Espaço", "👨‍🚀", [[[35,21],[50,14],[65,21],[70,39],[64,52],[36,52],[30,39],[35,21]],[[37,28],[63,28],[62,43],[38,43],[37,28]],[[38,52],[29,62],[31,78]],[[62,52],[71,62],[69,78]],[[41,52],[39,82]],[[59,52],[61,82]],[[43,35],[57,35]]]),
  f("robo", "Robô", "Fantasia/Espaço", "🤖", [[[31,27],[69,27],[74,63],[64,72],[36,72],[26,63],[31,27]],[[50,27],[50,16],[58,12]],[[38,42],[43,42]],[[57,42],[62,42]],[[39,56],[61,56]],[[26,48],[16,55],[25,62]],[[74,48],[84,55],[75,62]],[[39,72],[37,84]],[[61,72],[63,84]]]),
  f("dragao", "Dragão", "Fantasia/Espaço", "🐲", [[[25,72],[30,38],[42,23],[63,24],[75,38],[68,48],[79,58],[65,62],[61,79],[45,70],[25,72]],[[43,24],[38,13],[51,23]],[[61,25],[69,15],[70,31]],[[32,43],[16,31],[21,56]],[[56,41],[61,41]],[[46,55],[58,58],[65,53]]]),
  f("planeta", "Planeta", "Fantasia/Espaço", "🪐", [[[34,30],[49,21],[65,27],[76,41],[75,58],[64,72],[48,78],[32,70],[23,57],[24,42],[34,30]],[[13,62],[27,63],[48,55],[70,43],[86,39]],[[14,62],[22,72],[43,73],[68,62],[85,48],[86,39]],[[44,35],[49,35]],[[57,58],[62,58]]]),
];

export type PaintKitOptions = {
  figureIds: string[];
  sizeMm?: number;
  baseMm?: number;
  reliefMm?: number;
  lineMm?: number;
  gapMm?: number;
  baseSlot?: Partial<MaterialSlot>;
  reliefSlot?: Partial<MaterialSlot>;
};

const extrude = (poly: Point[], z0: number, z1: number): Tri[] => {
  const out: Tri[] = [];
  for (let i = 1; i < poly.length - 1; i++) {
    out.push([[poly[0][0],poly[0][1],z0],[poly[i+1][0],poly[i+1][1],z0],[poly[i][0],poly[i][1],z0]]);
    out.push([[poly[0][0],poly[0][1],z1],[poly[i][0],poly[i][1],z1],[poly[i+1][0],poly[i+1][1],z1]]);
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    out.push([[a[0],a[1],z0],[b[0],b[1],z0],[b[0],b[1],z1]], [[a[0],a[1],z0],[b[0],b[1],z1],[a[0],a[1],z1]]);
  }
  return out;
};

const roundedRect = (x: number, y: number, w: number, h: number, r: number): Point[] => {
  const pts: Point[] = [];
  for (const [cx, cy, start] of [[x+w-r,y+r,-Math.PI/2],[x+w-r,y+h-r,0],[x+r,y+h-r,Math.PI/2],[x+r,y+r,Math.PI]] as [number,number,number][]) {
    for (let i = 0; i <= 8; i++) { const a = start + Math.PI/2*i/8; pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]); }
  }
  return pts;
};

const stroke = (a: Point, b: Point, width: number, z0: number, z1: number): Tri[] => {
  const angle = Math.atan2(b[1]-a[1], b[0]-a[0]);
  const pts: Point[] = [];
  const r = width / 2;
  for (let i = 0; i <= 8; i++) { const t = angle+Math.PI/2+Math.PI*i/8; pts.push([a[0]+r*Math.cos(t),a[1]+r*Math.sin(t)]); }
  for (let i = 0; i <= 8; i++) { const t = angle-Math.PI/2+Math.PI*i/8; pts.push([b[0]+r*Math.cos(t),b[1]+r*Math.sin(t)]); }
  return extrude(pts, z0, z1);
};

const mesh = (tris: Tri[]) => {
  const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();
  let vertex = 0;
  const vertices: string[] = [], triangles: string[] = [];
  for (const tri of tris) {
    for (const p of tri) vertices.push(`<vertex x="${fmt(p[0])}" y="${fmt(p[1])}" z="${fmt(p[2])}"/>`);
    triangles.push(`<triangle v1="${vertex}" v2="${vertex+1}" v3="${vertex+2}"/>`); vertex += 3;
  }
  return `<mesh><vertices>${vertices.join("")}</vertices><triangles>${triangles.join("")}</triangles></mesh>`;
};

export function getPaintKitLayout(count: number, sizeMm: number, gapMm = 6) {
  const columns = Math.min(4, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  return { columns, rows, widthMm: columns * sizeMm + Math.max(0, columns-1) * gapMm, depthMm: rows * sizeMm + Math.max(0, rows-1) * gapMm };
}

export async function buildPaintKit3mf(options: PaintKitOptions): Promise<Blob> {
  const figures = options.figureIds.map((id) => PAINT_FIGURES.find((item) => item.id === id)).filter(Boolean) as PaintFigure[];
  if (!figures.length) throw new Error("Selecione pelo menos uma figura para gerar o kit.");
  if (figures.length > 8) throw new Error("O kit aceita no máximo 8 figuras.");
  const size = options.sizeMm ?? 60, base = options.baseMm ?? 2, relief = options.reliefMm ?? 1.2;
  const line = Math.max(1.2, options.lineMm ?? 1.2), gap = options.gapMm ?? 6;
  if (![size,base,relief,line,gap].every(Number.isFinite) || size < 30 || base <= 0 || relief <= 0 || gap < 0) throw new Error("Confira as medidas do kit.");
  const layout = getPaintKitLayout(figures.length, size, gap);
  const baseSlot = normalizeSlot(options.baseSlot, { extruder: 1, material: "PLA", color: "#F7E7C6" });
  const reliefSlot = normalizeSlot(options.reliefSlot, { extruder: 2, material: "PLA", color: "#7C3AED" });
  const objects = figures.flatMap((figure, index) => {
    const col = index % layout.columns, row = Math.floor(index / layout.columns);
    const ox = col * (size + gap), oy = (layout.rows - 1 - row) * (size + gap);
    const baseTris = extrude(roundedRect(ox, oy, size, size, Math.max(3, size * .1)), 0, base);
    const scale = size / 100;
    const reliefTris: Tri[] = [];
    for (const path of figure.paths) for (let i = 0; i < path.length - 1; i++) {
      reliefTris.push(...stroke([ox+path[i][0]*scale,oy+path[i][1]*scale],[ox+path[i+1][0]*scale,oy+path[i+1][1]*scale],line,base-.15,base+relief));
    }
    return [
      { name: `${figure.name} - base`, mesh: mesh(baseTris), triangleCount: baseTris.length, slot: baseSlot },
      { name: `${figure.name} - relevo`, mesh: mesh(reliefTris), triangleCount: reliefTris.length, slot: reliefSlot },
    ];
  });
  if (!objects.some((o) => o.triangleCount > 0)) throw new Error("Não foi possível criar geometria para este kit.");
  const blob = await pack3mf(objects);
  if (blob.size < 500) throw new Error("O arquivo gerado está vazio.");
  return blob;
}
