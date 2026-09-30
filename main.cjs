const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  clipboard,
  Notification,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn, execFile } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const { Store } = require("./store.cjs");
const { SITES, validateTool, parseCommand, withinRoot } = require("./core.cjs");
const { chat, models } = require("./brain.cjs");
const { Browser } = require("./browser.cjs");
const { OperationGate } = require("./operation.cjs");
const gate = new OperationGate();
let win, store, browser;
const activity = [];
const foundFiles = new Map();
let priorCPU;
const uiPath = path.join(__dirname, "../ui/index.html");
const uiURL = pathToFileURL(uiPath).href;
function emit(type, data) {
  if (win && !win.isDestroyed())
    win.webContents.send("event", { type, ...data });
}
function log(name, status, detail) {
  activity.unshift({ id: randomUUID(), name, status, detail, at: Date.now() });
  activity.splice(80);
  emit("activity", { activity });
}
function state(value) {
  emit("state", { state: value });
}
function telemetry() {
  const cpus = os.cpus();
  const cpu = cpus.reduce(
    (a, c) => {
      a.idle += c.times.idle;
      a.total += Object.values(c.times).reduce((s, n) => s + n, 0);
      return a;
    },
    { idle: 0, total: 0 },
  );
  const usage = priorCPU
    ? Math.round(
        100 *
          (1 -
            (cpu.idle - priorCPU.idle) /
              Math.max(1, cpu.total - priorCPU.total)),
      )
    : null;
  priorCPU = cpu;
  return {
    platform: process.platform,
    release: os.release(),
    cpuName: cpus[0]?.model,
    cpu: usage,
    ramUsed: os.totalmem() - os.freemem(),
    ramTotal: os.totalmem(),
    uptime: os.uptime(),
  };
}
function snapshot() {
  return {
    owner: "Hasnain Hyder Qazi",
    ...store.data,
    activity,
    tabs: browser.list(),
    system: telemetry(),
    desktop: true,
  };
}
async function findFiles(query) {
  foundFiles.clear();
  const root = await fs.promises.realpath(app.getPath("downloads"));
  const out = [];
  let scanned = 0;
  async function walk(dir, depth) {
    if (depth > 4 || scanned > 4000 || out.length >= 30) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (++scanned > 4000 || out.length >= 30) return;
      if (ent.isSymbolicLink()) continue;
      const file = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(file, depth + 1);
      else if (
        ent.isFile() &&
        ent.name.toLowerCase().includes(query.toLowerCase()) &&
        /\.(pdf|txt|md|csv|png|jpg|jpeg|webp)$/i.test(ent.name)
      ) {
        const id = randomUUID();
        foundFiles.set(id, { file, root });
        out.push({ id, name: ent.name, relative: path.relative(root, file) });
      }
    }
  }
  await walk(root, 0);
  emit("files", { files: out });
  return {
    ok: true,
    files: out,
    text:
      out.length +
      " matching documents found in Downloads (limited to 30, depth 4).",
  };
}
async function execute(name, args) {
  validateTool(name, args);
  gate.controller?.signal.throwIfAborted();
  log(name, "running", JSON.stringify(args));
  let result;
  try {
    switch (name) {
      case "open_site":
        result = browser.open(SITES[args.site]);
        break;
      case "search_web":
        result = browser.open(
          "https://www.google.com/search?q=" + encodeURIComponent(args.query),
        );
        break;
      case "open_app": {
        if (process.platform !== "win32")
          throw Error("Windows app launch sirf Windows 11 par chalega.");
        const binaries = {
          calculator: "calc.exe",
          notepad: "notepad.exe",
          explorer: "explorer.exe",
        };
        const executable = path.join(
          process.env.SystemRoot || "C:\\Windows",
          args.app === "explorer" ? "" : "System32",
          binaries[args.app],
        );
        await new Promise((resolve, reject) => {
          const child = spawn(executable, [], {
            shell: false,
            detached: true,
            stdio: "ignore",
          });
          child.once("error", reject);
          child.once("spawn", () => {
            child.unref();
            resolve();
          });
        });
        result = { ok: true, text: args.app + " launch requested." };
        break;
      }
      case "find_files":
        result = await findFiles(args.query);
        break;
      case "list_tabs":
        result = { ok: true, tabs: browser.list() };
        break;
      case "switch_tab":
        result = browser.switch(args.index);
        break;
      case "read_page":
        result = await browser.read(gate.controller?.signal);
        break;
      case "save_note":
        result = {
          ok: true,
          note: store.note(args.text),
          text: "نوٹ محفوظ ہوگیا ہے۔",
        };
        break;
      case "remember":
        result = {
          ok: true,
          preference: store.remember(args.text),
          text: "حسنین سر، یہ بات یاد رکھ لی ہے۔",
        };
        break;
      case "list_notes":
        result = { ok: true, notes: store.data.notes };
        break;
      case "set_reminder":
        result = {
          ok: true,
          reminder: store.reminder(
            args.text,
            Date.now() + args.minutes * 60000,
          ),
          text: "یاد دہانی محفوظ ہوگئی ہے۔ VEXON کھلا رہنا ضروری ہے۔",
        };
        break;
      case "list_reminders":
        result = {
          ok: true,
          reminders: store.data.reminders.filter((r) => !r.done),
        };
        break;
      default:
        throw Error("Unsupported action");
    }
    log(name, result.ok ? "done" : "cancelled", result.text || "Complete");
    emit("memory", {
      notes: store.data.notes,
      preferences: store.data.preferences,
      reminders: store.data.reminders,
    });
    return result;
  } catch (e) {
    log(name, "error", e.message);
    throw e;
  }
}
function readable(name, r) {
  if (!r.ok) return r.text || "عمل مکمل نہیں ہوا۔";
  switch (name) {
    case "open_site":
    case "search_web":
      return "حسنین سر، ویب سائٹ VEXON براؤزر میں کھول دی ہے۔";
    case "open_app":
      return "حسنین سر، ایپ کھولنے کی درخواست دے دی ہے۔";
    case "find_files":
      return `حسنین سر، ${r.files.length} فائلیں ملیں۔ Files panel میں دیکھ لیں۔`;
    case "list_tabs":
      return (
        r.tabs.map((t) => `${t.index}. ${t.title}`).join("\n") ||
        "ابھی کوئی ٹیب نہیں کھلا۔"
      );
    case "list_notes":
      return (
        r.notes.map((n) => "• " + n.text).join("\n") ||
        "ابھی کوئی نوٹ محفوظ نہیں ہے۔"
      );
    case "list_reminders":
      return (
        r.reminders
          .map((n) => `${n.text} — ${new Date(n.at).toLocaleString()}`)
          .join("\n") || "حسنین سر، ابھی کوئی یاد دہانی باقی نہیں ہے۔"
      );
    case "read_page":
      return (r.title || "Page") + "\n" + r.url + "\n\n" + r.untrustedPageText;
    default:
      return r.text || "حسنین سر، کام مکمل ہوگیا ہے۔";
  }
}
function secureHandle(channel, fn) {
  ipcMain.handle(channel, async (e, ...args) => {
    if (
      e.sender !== win.webContents ||
      e.senderFrame !== win.webContents.mainFrame ||
      e.senderFrame.url !== uiURL
    )
      throw Error("Untrusted caller");
    return fn(...args);
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else
  app.whenReady().then(() => {
    try {
      store = new Store(app.getPath("userData"));
    } catch (e) {
      dialog.showErrorBox("VEXON memory recovery", e.message);
      app.quit();
      return;
    }
    win = new BrowserWindow({
      width: 1480,
      height: 940,
      minWidth: 1040,
      minHeight: 720,
      backgroundColor: "#090c12",
      title: "VEXON — Personal Intelligence",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    win.on("closed", () => {
      gate.cancel();
      app.quit();
    });
    session.defaultSession.setPermissionRequestHandler(
      (wc, permission, callback, details) =>
        callback(
          wc === win.webContents &&
            permission === "media" &&
            details.mediaTypes?.every((t) => t === "audio"),
        ),
    );
    session.defaultSession.setPermissionCheckHandler(
      (wc, permission) => wc === win.webContents && permission === "media",
    );
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.webContents.on("will-attach-webview", (e) => e.preventDefault());
    browser = new Browser(win, () => emit("tabs", { tabs: browser.list() }));
    secureHandle("snapshot", snapshot);
    secureHandle("models", models);
    secureHandle("send", async (text) => {
      if (typeof text !== "string" || !text.trim() || text.length > 6000)
        throw Error("Command must be 1–6000 characters.");
      return gate.run(
        async (signal) => {
          try {
            const history = store.data.history.slice();
            store.history("user", text);
            state("thinking");
            let response;
            const commands = parseCommand(text);
            if (commands) {
              const results = [];
              for (const c of commands) {
                signal.throwIfAborted();
                state("executing");
                results.push(readable(c.name, await execute(c.name, c.args)));
                signal.throwIfAborted();
              }
              response = results.join("\n");
            } else
              response = await chat({
                model: store.data.settings.model,
                text,
                history,
                preferences: store.data.preferences,
                signal,
                onState: state,
                execute,
              });
            store.history(
              "assistant",
              commands?.some((c) => c.name === "read_page")
                ? "Page read with owner confirmation. Raw page text is not retained."
                : response,
            );
            return { text: response };
          } catch (e) {
            const message = signal.aborted
              ? "حسنین سر، کام روک دیا ہے۔ پہلے سے مکمل actions واپس نہیں ہوئے۔"
              : e.message;
            log("assistant", "error", message);
            return { text: message, error: true };
          }
        },
        () => state("idle"),
      );
    });
    secureHandle("cancel", () => {
      gate.cancel();
      return true;
    });
    secureHandle("action", async (name, args) =>
      gate.run(
        async () => {
          state("executing");
          return execute(name, args);
        },
        () => state("idle"),
      ),
    );
    secureHandle("settings", (data) => {
      if (!data || typeof data !== "object") throw Error("Invalid settings");
      const s = {};
      for (const key of ["model", "voiceName"])
        if (typeof data[key] === "string" && data[key].length < 200)
          s[key] = data[key];
      if (typeof data.speak === "boolean") s.speak = data.speak;
      store.settings(s);
      return store.data.settings;
    });
    secureHandle("open-file", async (id) => {
      const f = foundFiles.get(id);
      if (!f) throw Error("Search again to access this file.");
      const real = await fs.promises.realpath(f.file);
      if (
        !withinRoot(f.root, real) ||
        !/\.(pdf|txt|md|csv|png|jpg|jpeg|webp)$/i.test(real)
      )
        throw Error("File is outside permitted documents.");
      const answer = await dialog.showMessageBox(win, {
        type: "question",
        buttons: ["Cancel", "Open file"],
        defaultId: 0,
        cancelId: 0,
        message: "Open this document in its default app?",
        detail: real,
      });
      if (answer.response !== 1) return false;
      const error = await shell.openPath(real);
      if (error) throw Error(error);
      return true;
    });
    secureHandle("clipboard", () => clipboard.readText().slice(0, 6000));
    secureHandle("fullscreen", () => {
      win.setFullScreen(!win.isFullScreen());
      return win.isFullScreen();
    });
    secureHandle("clear", async () => {
      const r = await dialog.showMessageBox(win, {
        type: "warning",
        buttons: ["Cancel", "Clear conversation"],
        defaultId: 0,
        cancelId: 0,
        message:
          "Delete locally saved conversation? Notes and preferences will remain.",
      });
      if (r.response === 1) {
        store.data.history = [];
        store.save();
        return true;
      }
      return false;
    });
    secureHandle("pick", async (kind) => {
      if (!["whisperExe", "whisperModel"].includes(kind))
        throw Error("Invalid file kind");
      const r = await dialog.showOpenDialog(win, {
        title:
          kind === "whisperExe"
            ? "Select trusted whisper-cli executable"
            : "Select multilingual whisper model",
        properties: ["openFile"],
        filters:
          kind === "whisperExe"
            ? [
                {
                  name: "Executable",
                  extensions: process.platform === "win32" ? ["exe"] : ["*"],
                },
              ]
            : [{ name: "GGML model", extensions: ["bin"] }],
      });
      if (r.canceled) return store.data.settings;
      store.settings({ [kind]: r.filePaths[0] });
      return store.data.settings;
    });
    secureHandle("transcribe", async (buffer) => {
      const s = { ...store.data.settings };
      if (!s.whisperExe || !s.whisperModel)
        throw Error(
          "Settings mein whisper.cpp aur Urdu-compatible multilingual model select karein.",
        );
      const bytes = Buffer.from(buffer);
      if (
        bytes.length < 44 ||
        bytes.length > 4000000 ||
        bytes.toString("ascii", 0, 4) !== "RIFF" ||
        bytes.toString("ascii", 8, 12) !== "WAVE"
      )
        throw Error("Invalid audio recording.");
      return gate.run(
        async (signal) => {
          state("thinking");
          let tmp;
          try {
            tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vexon-voice-"));
            const wav = path.join(tmp, "voice.wav");
            fs.writeFileSync(wav, bytes);
            return await new Promise((resolve, reject) => {
              execFile(
                s.whisperExe,
                [
                  "-m",
                  s.whisperModel,
                  "-f",
                  wav,
                  "-l",
                  "ur",
                  "-otxt",
                  "-of",
                  path.join(tmp, "out"),
                  "-nt",
                ],
                {
                  timeout: 120000,
                  maxBuffer: 1024 * 1024,
                  windowsHide: true,
                  signal,
                },
                (error) => {
                  if (error)
                    return reject(
                      Error("Local transcription failed: " + error.message),
                    );
                  try {
                    resolve(
                      fs.readFileSync(path.join(tmp, "out.txt"), "utf8").trim(),
                    );
                  } catch (e) {
                    reject(e);
                  }
                },
              );
            });
          } finally {
            if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
          }
        },
        () => state("idle"),
      );
    });
    win.loadFile(uiPath);
    setInterval(() => {
      if (!win || win.isDestroyed()) return;
      emit("system", { system: telemetry() });
      for (const r of store.due()) {
        emit("reminder", { reminder: r });
        if (Notification.isSupported())
          new Notification({
            title: "VEXON · Hasnain Sir",
            body: r.text,
          }).show();
      }
      emit("memory", {
        notes: store.data.notes,
        preferences: store.data.preferences,
        reminders: store.data.reminders,
      });
    }, 3000).unref();
  });
app.on("second-instance", () => {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => gate.cancel());
