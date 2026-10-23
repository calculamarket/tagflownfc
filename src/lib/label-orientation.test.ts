import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import { labelDimensions } from "./a4-label-sheet";
describe("orientação da etiqueta retangular", () => {
  it("vertical com QR 32 mm fica 32 × 51 mm", () => {
    const d = labelDimensions(32, "rectangle", "vertical");
    assert.equal(d.widthMm, 32); assert.equal(d.heightMm, 51);
  });
  it("horizontal com QR 32 mm fica 51 × 32 mm", () => {
    const d = labelDimensions(32, "rectangle", "horizontal");
    assert.equal(d.widthMm, 51); assert.equal(d.heightMm, 32);
  });
});
