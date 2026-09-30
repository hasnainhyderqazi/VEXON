// Explicit UI preview. It never claims to control the host computer.
export function createPreview() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem("vexon-preview"));
  } catch {}
  data = data || {
    notes: [],
    preferences: [],
    reminders: [],
    history: [],
    settings: { model: "", speak: false, voiceName: "" },
  };
  const listeners = [];
  const save = () =>
    localStorage.setItem("vexon-preview", JSON.stringify(data));
  const emit = (type, fields) =>
    listeners.forEach((fn) => fn({ type, ...fields }));
  return {
    snapshot: async () => ({
      ...data,
      activity: [],
      tabs: [],
      desktop: false,
      system: { platform: "preview" },
    }),
    models: async () => ({ online: false, models: [] }),
    send: async () => ({
      text: "Hasnain Sir, yeh interface preview hai. PC commands aur local AI ke liye downloaded desktop app start karein.",
      error: true,
    }),
    cancel: async () => true,
    settings: async (s) => {
      data.settings = { ...data.settings, ...s };
      save();
      return data.settings;
    },
    action: async (name, args) => {
      if (name === "save_note")
        data.notes.unshift({
          text: args.text,
          createdAt: new Date().toISOString(),
        });
      else if (name === "remember") data.preferences.push(args.text);
      else if (name === "set_reminder")
        data.reminders.push({
          text: args.text,
          at: Date.now() + args.minutes * 60000,
          done: false,
        });
      else throw Error("Desktop app required for this action.");
      save();
      emit("memory", data);
      return { ok: true };
    },
    openFile: async () => false,
    clipboard: async () => {
      throw Error("Clipboard available in desktop app.");
    },
    pick: async () => {
      throw Error("Configure this in the desktop app.");
    },
    transcribe: async () => {
      throw Error("Desktop app required.");
    },
    fullscreen: async () =>
      document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen(),
    clear: async () => {
      data.history = [];
      save();
      return true;
    },
    onEvent: (fn) => listeners.push(fn),
  };
}
