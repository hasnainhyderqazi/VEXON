const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
class Store {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, "memory.json");
    this.data = {
      notes: [],
      preferences: [],
      reminders: [],
      history: [],
      settings: {
        model: "",
        voiceName: "",
        speak: true,
        whisperExe: "",
        whisperModel: "",
      },
    };
    if (fs.existsSync(this.file)) {
      try {
        const d = JSON.parse(fs.readFileSync(this.file, "utf8"));
        for (const k of ["notes", "preferences", "reminders", "history"])
          if (!Array.isArray(d[k])) throw Error("schema");
        if (!d.settings || typeof d.settings !== "object")
          throw Error("settings");
        this.data = {
          ...this.data,
          ...d,
          settings: { ...this.data.settings, ...d.settings },
        };
      } catch {
        throw Error(
          "Cannot read memory.json. Keep a backup and repair or rename it before restarting: " +
            this.file,
        );
      }
    }
  }
  save() {
    fs.writeFileSync(this.file + ".tmp", JSON.stringify(this.data, null, 2), {
      mode: 0o600,
    });
    fs.renameSync(this.file + ".tmp", this.file);
  }
  note(text) {
    const item = {
      id: randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    };
    this.data.notes.unshift(item);
    this.save();
    return item;
  }
  remember(text) {
    if (!this.data.preferences.includes(text)) this.data.preferences.push(text);
    this.data.preferences = this.data.preferences.slice(-100);
    this.save();
    return text;
  }
  reminder(text, at) {
    const r = { id: randomUUID(), text, at, done: false };
    this.data.reminders.push(r);
    this.save();
    return r;
  }
  due(now = Date.now()) {
    const due = this.data.reminders.filter((r) => !r.done && r.at <= now);
    if (due.length) {
      due.forEach((r) => (r.done = true));
      this.save();
    }
    return due;
  }
  history(role, content) {
    this.data.history.push({ role, content, at: new Date().toISOString() });
    this.data.history = this.data.history.slice(-100);
    this.save();
  }
  settings(s) {
    Object.assign(this.data.settings, s);
    this.save();
  }
}
module.exports = { Store };
