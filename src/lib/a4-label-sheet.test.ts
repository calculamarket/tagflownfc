import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { A4, a4Layout, pngAt300Dpi, QR_SCHEME_COLORS } from "./a4-label-sheet";

describe("A4 300 dpi labels", () => {
  it("uses A4 physical dimensions", () => {
    assert.deepEqual([A4.widthMm, A4.heightMm], [210, 297]);
  });
  it("rasterizes at 300 dpi", () => {
    assert.equal(A4.dpi, 300);
    assert.deepEqual([A4.widthPx, A4.heightPx], [2480, 3508]);
  });
  it("records 300 dpi in the PNG density chunk", () => {
    const bytes = new Uint8Array(33);
    new DataView(bytes.buffer).setUint32(8, 13);
    bytes.set(new TextEncoder().encode("IHDR"), 12);
    const out = pngAt300Dpi(bytes);
    const view = new DataView(out.buffer);
    assert.equal(new TextDecoder().decode(out.subarray(37, 41)), "pHYs");
    assert.equal(view.getUint32(41), 11811);
    assert.equal(view.getUint32(45), 11811);
    assert.equal(out[49], 1);
  });
  it("paginates without clipping labels", () => {
    const layout = a4Layout(35, 36);
    assert.equal(layout.capacity, 35);
    assert.equal(layout.pages, 2);
    assert.ok(layout.marginMm + layout.columns * 35 + (layout.columns - 1) * layout.gapMm <= 202);
  });
  it("offers white and black background schemes", () => {
    assert.deepEqual(QR_SCHEME_COLORS.light, { page: "#ffffff", outline: "#b8b8b8", modules: "#000000" });
    assert.deepEqual(QR_SCHEME_COLORS.dark, { page: "#000000", outline: "#ffffff", modules: "#ffffff" });
  });
});