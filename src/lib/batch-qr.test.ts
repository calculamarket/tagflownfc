import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBatchItems } from "./batch-qr";

describe("QR generator batch contents for A4 export", () => {
  it("exports the selected quantity with the same QR content", () => {
    const items = buildBatchItems({ quantity: 36, mode: "same", baseUrl: "", sameText: "https://www.3dqr.com.br" });
    assert.equal(items.length, 36);
    assert.ok(items.every((item) => item.text === "https://www.3dqr.com.br"));
  });
  it("exports the selected quantity with distinct QR contents", () => {
    const items = buildBatchItems({ quantity: 36, mode: "unique", baseUrl: "https://www.3dqr.com.br/t", sameText: "" });
    assert.equal(items.length, 36);
    assert.equal(new Set(items.map((item) => item.text)).size, 36);
    assert.ok(items.every((item) => item.text.startsWith("https://www.3dqr.com.br/t/")));
  });
});