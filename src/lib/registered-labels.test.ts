import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registeredLabelItems } from "./registered-labels";

describe("Registered activation labels", () => {
  it("registers every unique QR before returning printable contents", async () => {
    const saved: string[] = [];
    const items = await registeredLabelItems(36, "unique", async (count) => {
      assert.equal(count, 36);
      const tags = Array.from({ length: count }, (_, i) => ({ id: `tag${i}` }));
      saved.push(...tags.map((tag) => tag.id));
      return tags;
    });
    assert.equal(items.length, 36);
    assert.equal(new Set(items.map((item) => item.text)).size, 36);
    for (const item of items) {
      assert.ok(saved.includes(item.id));
      assert.equal(item.text, `https://www.3dqr.com.br/t/${item.id}`);
    }
  });
  it("registers one code when 36 labels share the same QR", async () => {
    const items = await registeredLabelItems(36, "same", async (count) => {
      assert.equal(count, 1);
      return [{ id: "shared01" }];
    });
    assert.equal(items.length, 36);
    assert.ok(items.every((item) => item.text === "https://www.3dqr.com.br/t/shared01"));
  });
  it("prevents export when registration fails", async () => {
    await assert.rejects(registeredLabelItems(1, "same", async () => { throw new Error("registration failed"); }), /registration failed/);
  });
  it("prevents export if the server has not confirmed every distinct code", async () => {
    await assert.rejects(registeredLabelItems(2, "unique", async () => [{ id: "one" }]), /cadastrar todas/);
    await assert.rejects(registeredLabelItems(2, "unique", async () => [{ id: "one" }, { id: "one" }]), /cadastrar todas/);
  });
});