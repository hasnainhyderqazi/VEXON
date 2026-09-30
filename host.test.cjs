const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
function host({ locked = true, failHistory = false } = {}) {
  let quit = 0,
    lockCalls = 0;
  const events = {},
    handlers = {},
    windows = [];
  const mem = {
    history: [],
    settings: {},
    notes: [],
    preferences: [],
    reminders: [],
  };
  const app = {
    requestSingleInstanceLock() {
      lockCalls++;
      return locked;
    },
    quit() {
      quit++;
    },
    on(n, fn) {
      events[n] = fn;
    },
    whenReady() {
      return {
        then: (fn) => {
          if (locked) fn();
        },
      };
    },
    getPath: () => "/tmp",
  };
  class Window {
    constructor() {
      this.events = {};
      this.webContents = {
        send() {},
        on() {},
        setWindowOpenHandler() {},
        mainFrame: { url: "file:///test/ui/index.html" },
      };
      windows.push(this);
    }
    on(n, f) {
      this.events[n] = f;
    }
    loadFile() {}
    isDestroyed() {
      return false;
    }
    isMinimized() {
      return false;
    }
    show() {}
    focus() {}
  }
  class Store {
    constructor() {
      this.data = mem;
    }
    history(role, content) {
      if (failHistory) throw Error("disk full");
      mem.history.push({ role, content });
    }
    save() {}
    due() {
      return [];
    }
  }
  class Browser {
    list() {
      return [];
    }
    async read() {
      return {
        ok: true,
        title: "Private",
        url: "https://test",
        untrustedPageText: "SECRET-PAGE-CONTENT",
      };
    }
  }
  const electron = {
    app,
    BrowserWindow: Window,
    ipcMain: {
      handle(n, fn) {
        handlers[n] = fn;
      },
    },
    dialog: {},
    shell: {},
    clipboard: {},
    Notification: {},
    session: {
      defaultSession: {
        setPermissionRequestHandler() {},
        setPermissionCheckHandler() {},
      },
    },
  };
  const req = (name) =>
    name === "electron"
      ? electron
      : name === "./store.cjs"
        ? { Store }
        : name === "./browser.cjs"
          ? { Browser }
          : name.startsWith("./")
            ? require("../src/" + name.slice(2))
            : require(name);
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../src/main.cjs"), "utf8"),
    {
      require: req,
      __dirname: "/test/src",
      process,
      Buffer,
      setInterval: () => ({ unref() {} }),
      console,
      AbortController,
    },
  );
  return {
    events,
    windows,
    mem,
    counts: () => ({ quit, lockCalls }),
    call: (name, ...args) =>
      handlers[name](
        {
          sender: windows[0].webContents,
          senderFrame: windows[0].webContents.mainFrame,
        },
        ...args,
      ),
  };
}
test("host refuses second instance before touching memory", () => {
  const h = host({ locked: false });
  assert.equal(h.counts().lockCalls, 1);
  assert.equal(h.counts().quit, 1);
  assert.equal(h.windows.length, 0);
});
test("closing main window quits even if web windows remain", () => {
  const h = host();
  h.windows[0].events.closed();
  assert.equal(h.counts().quit, 1);
});
test("failed initial history write releases busy state", async () => {
  const h = host({ failHistory: true });
  await h.call("send", "hello").catch(() => {});
  const result = await h
    .call("send", "hello")
    .catch((e) => ({ text: e.message }));
  assert.doesNotMatch(result.text, /pehle se|busy/i);
});
test("page read response is visible but raw content not persisted", async () => {
  const h = host();
  const r = await h.call("send", "page parho");
  assert.match(r.text, /SECRET-PAGE-CONTENT/);
  assert.equal(
    JSON.stringify(h.mem.history).includes("SECRET-PAGE-CONTENT"),
    false,
  );
});
