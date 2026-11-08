const test = require("node:test");
const assert = require("node:assert");
const { paint } = require("../renderer/pet");

// a pet element that counts how often its sprite sheet is rewritten
function element() {
  const classes = new Set();
  const el = {
    dataset: {}, innerHTML: "x", sheetWrites: 0,
    classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)) },
    style: { backgroundSize: "" },
  };
  let image = "";
  Object.defineProperty(el.style, "backgroundImage", { get: () => image, set: v => { image = v; el.sheetWrites++; } });
  return el;
}
const pack = (sheet, rows = 9) => ({ id: "robot", rows, sheet });

test("a pack re-imported under the same id shows the new sheet", () => {
  const el = element();
  paint([el], "idle", pack("data:image/png;base64,OLD"));
  paint([el], "idle", pack("data:image/png;base64,NEW"));
  assert.ok(el.style.backgroundImage.includes("NEW"));
  assert.ok(!el.style.backgroundImage.includes("OLD"));
});

test("a same-id pack with a different row count updates the frame geometry", () => {
  const el = element();
  paint([el], "idle", pack("data:s", 9));
  paint([el], "idle", pack("data:s", 11));
  assert.strictEqual(el.dataset.rows, "11");
  assert.strictEqual(el.style.backgroundSize, "800% 1100%");
});

test("an unchanged pack is not rewritten on later calls", () => {
  const el = element();
  const p = pack("data:s");
  paint([el], "idle", p);
  paint([el], "sleep", p);
  paint([el], "idle", pack("data:s")); // same content, new object
  assert.strictEqual(el.sheetWrites, 1);
});

test("switching ids and back to the cat still repaints", () => {
  const el = element();
  paint([el], "idle", pack("data:a"));
  paint([el], "idle", { id: "other", rows: 11, sheet: "data:b" });
  assert.ok(el.style.backgroundImage.includes("data:b"));
  paint([el], "idle", null);
  assert.strictEqual(el.dataset.kind, "cat");
  assert.strictEqual(el.style.backgroundImage, "");
  paint([el], "idle", pack("data:a"));
  assert.strictEqual(el.dataset.kind, "custom");
});
