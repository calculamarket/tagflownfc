import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
    assert.deepEqual(decorated.base[0], [0, 0, 0, 61, 39, 1]);
    plain.modules.forEach((box, i) => {
      const moved = [...box]; moved[0] += 22; moved[3] += 22;
      assert.deepEqual(decorated.modules[i], moved);
    });
    const artwork = decorated.modules.slice(plain.modules.length);
    assert.equal(artwork.length, 2);
    assert.ok(artwork.every((box) => box[3] < 22 && box[2] < 1 && box[5] === 1.6));
  });
  it("includes the same decorated geometry in STL and the two-material 3MF", async () => {
    const opts = { ...options, socialIcons: [icon] };
    const geometry = buildQrGeometry("test", opts);
    const stl = await buildQrStl("test", opts).arrayBuffer();
    assert.equal(new DataView(stl).getUint32(80, true), (geometry.base.length + geometry.modules.length) * 12);
    const mf = await buildQr3mf("test", opts);
    assert.equal(mf.type, "model/3mf");
    assert.ok(mf.size > 1000);
  });
});