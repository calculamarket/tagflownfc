import { describe, expect, it } from "vitest";
import { A4, a4Layout, pngAt300Dpi } from "./a4-label-sheet";

describe("A4 300 dpi labels", () => {
  it("uses A4 physical dimensions", () => {
    expect([A4.widthMm, A4.heightMm]).toEqual([210, 297]);
  });
  it("rasterizes at 300 dpi", () => {
    expect(A4.dpi).toBe(300);
    expect([A4.widthPx, A4.heightPx]).toEqual([2480, 3508]);
  });
  it("records 300 dpi in the PNG density chunk", () => {
    const bytes = new Uint8Array(33);
    new DataView(bytes.buffer).setUint32(8, 13);
    bytes.set(new TextEncoder().encode("IHDR"), 12);
    const out = pngAt300Dpi(bytes);
    const view = new DataView(out.buffer);
    expect(new TextDecoder().decode(out.subarray(37, 41))).toBe("pHYs");
    expect(view.getUint32(41)).toBe(11811);
    expect(view.getUint32(45)).toBe(11811);
    expect(out[49]).toBe(1);
  });
  it("paginates without clipping labels", () => {
    const layout = a4Layout(35, 36);
    expect(layout.capacity).toBe(35);
    expect(layout.pages).toBe(2);
    expect(layout.marginMm + layout.columns * 35 + (layout.columns - 1) * layout.gapMm).toBeLessThanOrEqual(202);
  });
});