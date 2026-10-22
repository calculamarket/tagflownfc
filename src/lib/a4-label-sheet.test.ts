import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { A4, a4Layout, labelDimensions, pngAt300Dpi, QR_SCHEME_COLORS, packageA4Pdf } from "./a4-label-sheet";
import { PDFDocument } from "pdf-lib";

describe("A4 600 dpi labels", () => {
  it("packages every rendered sheet into a PDF at 210 × 297 mm", async () => {
    const png = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")], { type: "image/png" });
    const file = await packageA4Pdf([png, png]);
    const pdf = await PDFDocument.load(await file.blob.arrayBuffer());
    assert.equal(pdf.getPageCount(), 2);
    for (const page of pdf.getPages()) {
      assert.ok(Math.abs(page.getWidth() * 25.4 / 72 - 210) < 0.001);
      assert.ok(Math.abs(page.getHeight() * 25.4 / 72 - 297) < 0.001);
    }
    assert.equal(file.blob.type, "application/pdf");
  });
  it("keeps the selected square QR dimensions inside a wider rectangular label", () => {
    const dimensions = labelDimensions(35, "rectangle");
    assert.equal(dimensions.qrSizeMm, 35);
    assert.equal(dimensions.widthMm, 57);
    assert.equal(dimensions.heightMm, 39);
    assert.equal(dimensions.qrLeftMm, 20);
    assert.ok(dimensions.qrLeftMm + 35 < dimensions.widthMm);
  });
  it("paginates rectangular labels using their full width, not the QR width", () => {
    const layout = a4Layout(35, 36, "rectangle");
    assert.equal(layout.columns, 3);
    assert.equal(layout.rows, 6);
    assert.equal(layout.capacity, 18);
    assert.equal(layout.pages, 2);
    assert.ok(layout.marginMm + layout.columns * layout.widthMm + (layout.columns - 1) * layout.gapMm <= 202);
  });
  it("uses A4 physical dimensions", () => {
    assert.deepEqual([A4.widthMm, A4.heightMm], [210, 297]);
  });
  it("rasterizes at 600 dpi", () => {
    assert.equal(A4.dpi, 600);
    assert.deepEqual([A4.widthPx, A4.heightPx], [4961, 7016]);
  });
  it("records 600 dpi in the PNG density chunk", () => {
    const bytes = new Uint8Array(33);
    new DataView(bytes.buffer).setUint32(8, 13);
    bytes.set(new TextEncoder().encode("IHDR"), 12);
    const out = pngAt300Dpi(bytes);
    const view = new DataView(out.buffer);
    assert.equal(new TextDecoder().decode(out.subarray(37, 41)), "pHYs");
    assert.equal(view.getUint32(41), 23622);
    assert.equal(view.getUint32(45), 23622);
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