const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { clipHistory } = require("../src/clip-history");
const universalSearch = require("../src/search");

// the real search and searchRun handlers from main.js
const source = fs.readFileSync(path.join(__dirname, "../src/main.js"), "utf8");
const a = source.indexOf("let appIndex = []");
const searchPiece = source.slice(a, source.indexOf("function toggleRadio", a));
const b = source.indexOf('ipcMain.on("searchRun"');
const runPiece = source.slice(b, source.indexOf("// the notch only takes keys", b));

function setup(copies) {
  const handlers = new Map(), written = [], sent = [];
  const store = clipHistory();
  copies.forEach(t => store.add(t));
  const context = {
    config: { clipboardHistory: true }, universalSearch, path, process, Date, Map, console,
    app: { getPath: () => "C:/profile" },
    clipStore: () => store,
    loadNotes: () => "",
    execFile() {}, spawn() {},
    send: (channel, value) => sent.push([channel, value]),
    clipboard: { writeText: t => { written.push(t); return Promise.resolve(); } },
    shell: {},
    ipcMain: { handle: (n, fn) => handlers.set(n, fn), on: (n, fn) => handlers.set(n, fn) },
  };
  vm.runInNewContext(`${searchPiece}; appIndexAt = Date.now(); ${runPiece}`, context);
  return { store, written, sent, search: q => handlers.get("search")({}, q), run: id => handlers.get("searchRun")({}, id) };
}

test("copying a clipboard search hit reproduces the full text, not the 160-character preview", async () => {
  const long = "A".repeat(180) + "TAIL";
  const t = setup([long]);
  const [hit] = await t.search("AAAA");
  assert.ok(hit && hit.kind === "clip");
  t.run(hit.id);
  assert.deepStrictEqual(t.written, [long]);
});

test("a copied search hit keeps its whitespace", async () => {
  const code = "if (x) {\n  run();\n}";
  const t = setup([code]);
  const [hit] = await t.search("run");
  t.run(hit.id);
  assert.deepStrictEqual(t.written, [code]);
});

test("search finds text that only appears after the preview boundary", async () => {
  const t = setup(["B".repeat(200) + " needleword"]);
  const hits = await t.search("needleword");
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].kind, "clip");
});

test("a history reorder between search and activation cannot change what is copied", async () => {
  const t = setup(["first copy", "second copy"]);
  const [hit] = await t.search("first copy");
  t.store.add("third copy"); // moves every index
  t.run(hit.id);
  assert.deepStrictEqual(t.written, ["first copy"]);
});
