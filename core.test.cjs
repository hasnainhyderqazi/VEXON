const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseCommand, validateTool, withinRoot } = require("../src/core.cjs");
const { Store } = require("../src/store.cjs");
test("Roman Urdu and Urdu route to actual tools", () => {
  assert.equal(parseCommand("VEXON, TikTok kholo.")[0].args.site, "tiktok");
  assert.equal(parseCommand("یوٹیوب کھولو")[0].args.site, "youtube");
  assert.equal(
    parseCommand("Downloads mein meri PDF dhoondo")[0].name,
    "find_files",
  );
  assert.equal(parseCommand("aaj ke tasks batao")[0].name, "list_reminders");
});
test("multi-step commands preserve sequence", () => {
  assert.deepEqual(
    parseCommand("calculator kholo aur YouTube kholo").map((x) => x.name),
    ["open_app", "open_site"],
  );
});
test("conversation and analytics requests are not falsely completed", () => {
  assert.equal(
    parseCommand("aaj YouTube views ki wajah se dimagh kharab hai"),
    null,
  );
  assert.equal(
    parseCommand(
      "YouTube Studio kholo aur meri latest video ki analytics check karo",
    ),
    null,
  );
});
test("tool policy rejects arbitrary commands, protocols, long payloads", () => {
  assert.throws(() => validateTool("exec", { command: "calc" }));
  assert.throws(() => validateTool("open_app", { app: "powershell" }));
  assert.throws(() =>
    validateTool("open_site", { site: "file:///etc/passwd" }),
  );
  assert.throws(() => validateTool("save_note", { text: "x".repeat(9000) }));
  assert.throws(() =>
    validateTool("save_note", { text: "ok", command: "cmd" }),
  );
  assert.doesNotThrow(() => validateTool("search_web", { query: "AI news" }));
});
test("path containment excludes prefix collisions and traversal", () => {
  assert.equal(withinRoot("/tmp/downloads", "/tmp/downloads/a.pdf"), true);
  assert.equal(
    withinRoot("/tmp/downloads", "/tmp/downloads-evil/a.pdf"),
    false,
  );
  assert.equal(withinRoot("/tmp/downloads", "/tmp/downloads/../secret"), false);
});
test("memory and reminders persist; due reminders deliver only once", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexon-test-"));
  try {
    const s = new Store(dir);
    s.note("an idea");
    s.reminder("record video", Date.now() - 1000);
    const s2 = new Store(dir);
    assert.equal(s2.data.notes[0].text, "an idea");
    assert.equal(s2.due().length, 1);
    assert.equal(s2.due().length, 0);
    assert.equal(new Store(dir).due().length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("corrupted store remains untouched and raises recovery error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexon-corrupt-"));
  try {
    fs.writeFileSync(path.join(dir, "memory.json"), "broken");
    assert.throws(() => new Store(dir), /memory.json/);
    assert.equal(
      fs.readFileSync(path.join(dir, "memory.json"), "utf8"),
      "broken",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("negated or instructional requests do not launch apps", () => {
  assert.equal(parseCommand("YouTube mat kholo"), null);
  assert.equal(parseCommand("calculator nahi kholo"), null);
  assert.equal(parseCommand("how do I open YouTube?"), null);
});
test("note content retains conjunctions without a model", () => {
  const c = parseCommand("note likho: AI aur automation");
  assert.equal(c[0].args.text, "AI aur automation");
});
