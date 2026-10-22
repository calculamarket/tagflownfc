import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { buildQrGeometry, buildQrStl } from "./qr-stl";
import { buildQr3mf } from "./qr-3mf";
import type { SocialIconMask } from "./social-label-icons";

const options = { sizeMm: 35, quietZoneMm: 2, baseHeightMm: 1, moduleHeightMm: 0.6 };
const icon: SocialIconMask = { id: "instagram", cols: 2, rows: 2, data: [true, false, true, true] };
describe("Optional social icons in 3D QR batches", () => {
  it("preserves the undecorated square when icons are off", () => {
    assert.deepEqual(buildQrGeometry("test", { ...options, socialIcons: [] }), buildQrGeometry("test", options));
    assert.deepEqual(buildQrGeometry("test", options).base[0], [0, 0, 0, 39, 39, 1]);
  });
  it("adds icons on the left without scaling or changing the QR quiet zone", () => {
    const plain = buildQrGeometry("test", options);
    const decorated = buildQrGeometry("test", { ...options, socialIcons: [icon] });
    assert.deepEqual(decorated.base[0], [0, 0, 0, 58, 39, 1]);
    plain.modules.forEach((box, i) => {
      const moved = [...box]; moved[0] += 19; moved[3] += 19;
      assert.deepEqual(decorated.modules[i], moved);
    });
    const artwork = decorated.modules.slice(plain.modules.length);
    assert.equal(artwork.length, 2);
    assert.ok(artwork.every((box) => box[3] < 19 && box[2] < 1 && box[5] === 1.6));
  });
  it("includes the same decorated geometry in STL and the two-material 3MF", async () => {
    const opts = { ...options, socialIcons: [icon] };
    const geometry = buildQrGeometry("test", opts);
    const stl = await buildQrStl("test", opts).arrayBuffer();
    assert.equal(new DataView(stl).getUint32(80, true), (geometry.base.length + geometry.modules.length) * 12);
    const mf = await buildQr3mf("test", opts);
    const bytes = new Uint8Array(await mf.arrayBuffer());
    const view = new DataView(bytes.buffer);
    let offset = 0;
    let model = "";
    while (view.getUint32(offset, true) === 0x04034b50) {
      const method = view.getUint16(offset + 8, true);
      const length = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
      const start = offset + 30 + nameLength + extraLength;
      const payload = bytes.subarray(start, start + length);
      if (name === "3D/3dmodel.model") model = new TextDecoder().decode(method === 8 ? inflateRawSync(payload) : payload);
      offset = start + length;
    }
    assert.ok(model.includes('<vertex x="61"'));
    assert.equal((model.match(/<triangle /g) ?? []).length, (geometry.base.length + geometry.modules.length) * 12);
    assert.ok(model.includes('name="Codigo"'));
    assert.ok(model.includes('<components>'));
  });
});