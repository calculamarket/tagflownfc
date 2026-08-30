import earcut from "earcut";
import { PAINT_FIGURES, type PaintFigure, type PaintKitTheme } from "./paint-kit-3d";
import { normalizeSlot, pack3mf, type MaterialSlot } from "./three-mf";
import type { Tri } from "./pet-tag-3d";

type Point = [number, number];
export type PuzzleStyle = "suave" | "classico" | "geometrico";

export type MontessoriPuzzleOptions = {
  figureIds: string[];
  boardWidthMm?: number;
  boardDepthMm?: number;
  baseMm?: number;
  recessMm?: number;
  pieceReliefMm?: number;
  clearanceMm?: number;
  style?: PuzzleStyle;
  boardSlot?: Partial<MaterialSlot>;
  pieceSlot?: Partial<MaterialSlot>;
  detailSlot?: Partial<MaterialSlot>;
};

export function interpretPuzzleRequest(text: string): { theme: PaintKitTheme | "Todos"; style: PuzzleStyle; count: number } {
  const value = text.toLocaleLowerCase("pt-BR");
  const theme: PaintKitTheme | "Todos" = /mar|oceano|aqu[aá]tico|peixe|baleia/.test(value) ? "Fundo do Mar"
    : /espa[cç]o|fantasia|foguete|planeta|m[aá]gic|unicorn/.test(value) ? "Fantasia/Espaço"
    : /anima|fazenda|selva|pet/.test(value) ? "Animais" : "Todos";
  const style: PuzzleStyle = /geom[eé]tric|reto|moderno/.test(value) ? "geometrico" : /cl[aá]ssic|tradicional/.test(value) ? "classico" : "suave";
  const found = value.match(/\b([1-4])\s*(pe[cç]as?|figuras?|animais?)/);
  return { theme, style, count: found ? Number(found[1]) : 4 };
}

const extrude = (outer: Point[], holes: Point[][], z0: number, z1: number): Tri[] => {
  const coords: number[] = [], holeIndices: number[] = [];
  for (const p of outer) coords.push(...p);
  for (const ring of holes) { holeIndices.push(coords.length / 2); for (const p of ring) coords.push(...p); }
  const indices = earcut(coords, holeIndices, 2), at = (i: number): Point => [coords[i*2], coords[i*2+1]];
  const out: Tri[] = [];
  for (let i=0;i<indices.length;i+=3) { const a=at(indices[i]),b=at(indices[i+1]),c=at(indices[i+2]); out.push([[a[0],a[1],z0],[c[0],c[1],z0],[b[0],b[1],z0]],[[a[0],a[1],z1],[b[0],b[1],z1],[c[0],c[1],z1]]); }
  const wall = (ring: Point[], reverse=false) => { const r=reverse?[...ring].reverse():ring; for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];out.push([[a[0],a[1],z0],[b[0],b[1],z0],[b[0],b[1],z1]],[[a[0],a[1],z0],[b[0],b[1],z1],[a[0],a[1],z1]]);} };
  wall(outer); for(const hole of holes) wall(hole,true); return out;
};

const roundedRect = (x:number,y:number,w:number,h:number,r:number,segments=8):Point[] => { const pts:Point[]=[]; for(const [cx,cy,start] of [[x+w-r,y+r,-Math.PI/2],[x+w-r,y+h-r,0],[x+r,y+h-r,Math.PI/2],[x+r,y+r,Math.PI]] as [number,number,number][]) for(let i=0;i<=segments;i++){const a=start+Math.PI/2*i/segments;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);} return pts; };

function silhouette(figure: PaintFigure, cx:number, cy:number, size:number, style:PuzzleStyle, grow=0):Point[] {
  const hash=[...figure.id].reduce((sum,c)=>sum+c.charCodeAt(0),0), count=style==="geometrico"?8:style==="classico"?12:20;
  const pts:Point[]=[];
  for(let i=0;i<count;i++){const a=Math.PI*2*i/count;const wave=Math.sin(a*3+hash)*.07+Math.cos(a*2+hash*.2)*.05;const rx=size*(.42+wave)+grow,ry=size*(.39-wave*.35)+grow;pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}
  return pts;
}

const stroke=(a:Point,b:Point,width:number,z0:number,z1:number):Tri[]=>{const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),r=width/2,pts:Point[]=[];for(let i=0;i<=7;i++){const t=angle+Math.PI/2+Math.PI*i/7;pts.push([a[0]+r*Math.cos(t),a[1]+r*Math.sin(t)]);}for(let i=0;i<=7;i++){const t=angle-Math.PI/2+Math.PI*i/7;pts.push([b[0]+r*Math.cos(t),b[1]+r*Math.sin(t)]);}return extrude(pts,[],z0,z1);};
const mesh=(tris:Tri[])=>{const fmt=(n:number)=>(Math.round(n*1000)/1000).toString();let v=0;const vs:string[]=[],ts:string[]=[];for(const t of tris){for(const p of t)vs.push(`<vertex x="${fmt(p[0])}" y="${fmt(p[1])}" z="${fmt(p[2])}"/>`);ts.push(`<triangle v1="${v}" v2="${v+1}" v3="${v+2}"/>`);v+=3;}return `<mesh><vertices>${vs.join("")}</vertices><triangles>${ts.join("")}</triangles></mesh>`;};

export async function buildMontessoriPuzzle3mf(options: MontessoriPuzzleOptions):Promise<Blob>{
  const figures=options.figureIds.map(id=>PAINT_FIGURES.find(f=>f.id===id)).filter(Boolean) as PaintFigure[];
  if(!figures.length)throw new Error("Escolha ao menos uma figura para o quebra-cabeça."); if(figures.length>4)throw new Error("Escolha no máximo 4 figuras por tabuleiro.");
  const w=options.boardWidthMm??160,d=options.boardDepthMm??120,base=options.baseMm??2,recess=options.recessMm??4,detail=options.pieceReliefMm??.6,clearance=options.clearanceMm??.5,style=options.style??"suave";
  if(w<100||d<80||base<=0||recess<2||detail<=0||clearance<.2||clearance>1.5)throw new Error("Confira as medidas e use folga entre 0,2 e 1,5 mm.");
  const cols=figures.length===1?1:2,rows=Math.ceil(figures.length/cols),cellW=(w-20)/cols,cellD=(d-20)/rows,pieceSize=Math.min(cellW,cellD)*.7;
  const boardOuter=roundedRect(0,0,w,d,8),holes:Point[][]=[],pieces:{figure:PaintFigure;shape:Point[];printShape:Point[];cx:number;cy:number}[]=[];
  figures.forEach((figure,i)=>{const col=i%cols,row=Math.floor(i/cols),cx=10+cellW*(col+.5),cy=d-10-cellD*(row+.5);const shape=silhouette(figure,cx,cy,pieceSize,style);holes.push(silhouette(figure,cx,cy,pieceSize,style,clearance));const pcx=w+20+pieceSize*.5,pcy=pieceSize*.55+i*(pieceSize+8);pieces.push({figure,shape,printShape:silhouette(figure,pcx,pcy,pieceSize,style),cx:pcx,cy:pcy});});
  const baseTris=extrude(boardOuter,[],0,base),frameTris=extrude(boardOuter,holes,base-.15,base+recess),pieceTris:Tri[]=[],detailTris:Tri[]=[];
  for(const p of pieces){pieceTris.push(...extrude(p.printShape,[],0,recess-.2));const scale=pieceSize/100*.68;for(const path of p.figure.paths)for(let i=0;i<path.length-1;i++){const map=([x,y]:Point):Point=>[p.cx+(x-50)*scale,p.cy+(y-50)*scale];detailTris.push(...stroke(map(path[i]),map(path[i+1]),Math.max(1.2,pieceSize*.035),recess-.35,recess+detail));}}
  const boardSlot=normalizeSlot(options.boardSlot,{extruder:1,material:"PLA",color:"#F4D58D"}),pieceSlot=normalizeSlot(options.pieceSlot,{extruder:2,material:"PLA",color:"#70C1B3"}),detailSlot=normalizeSlot(options.detailSlot,{extruder:3,material:"PLA",color:"#F25F5C"});
  const objects=[{name:"Tabuleiro - base",mesh:mesh(baseTris),triangleCount:baseTris.length,slot:boardSlot},{name:"Tabuleiro - moldura com encaixes",mesh:mesh(frameTris),triangleCount:frameTris.length,slot:boardSlot},{name:"Pecas removiveis",mesh:mesh(pieceTris),triangleCount:pieceTris.length,slot:pieceSlot},{name:"Detalhes das pecas",mesh:mesh(detailTris),triangleCount:detailTris.length,slot:detailSlot}];
  if(objects.some(o=>!o.triangleCount))throw new Error("Não foi possível criar a geometria do quebra-cabeça.");const blob=await pack3mf(objects);if(blob.size<1000)throw new Error("O arquivo gerado está vazio.");return blob;
}
