import { VoiceRecorder, urduVoices } from "./voice.js";
import { createPreview } from "./preview.js";
const $ = (id) => document.getElementById(id);
const api = window.vexon || createPreview();
let settings = {},
  snapshot = {},
  working = false,
  recording = false,
  recorder,
  recordTimer,
  toastTimer,
  currentState = "idle";
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 5500);
}
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}
function view(name) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("hidden", v.id !== "view-" + name));
  document
    .querySelectorAll(".nav")
    .forEach((n) => n.classList.toggle("active", n.dataset.view === name));
}
const labels = {
  idle: ["READY WHEN YOU ARE", "One command. A little more possibility."],
  listening: [
    "LISTENING TO YOU",
    "Boliye, Hasnain Sir. Click the mic to finish.",
  ],
  thinking: ["CONNECTING THE DOTS", "Your local intelligence is working."],
  executing: [
    "MAKING IT HAPPEN",
    "Watch the activity panel for real progress.",
  ],
  speaking: ["A WORD FROM VEXON", "Your assistant, in conversation."],
};
function setState(s) {
  currentState = s;
  document.body.dataset.state = s;
  const l = labels[s] || labels.idle;
  $("stateLabel").textContent = l[0];
  $("stateDetail").textContent = l[1];
}
function addMessage(role, text, error = false) {
  const item = el("article", "message " + role + (error ? " error" : ""));
  const meta = el("div", "message-meta");
  meta.append(
    el("span", "mini-logo", role === "user" ? "H" : "V"),
    el("b", "", role === "user" ? "HASNAIN SIR" : "VEXON"),
    el(
      "time",
      "",
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    ),
  );
  const p = el("p", "", text);
  p.dir = "auto";
  item.append(meta, p);
  $("messages").append(item);
  $("messages").scrollTop = $("messages").scrollHeight;
}
function voices() {
  const all = urduVoices();
  $("voiceSelect").replaceChildren();
  if (!all.length)
    $("voiceSelect").append(new Option("No Urdu voice installed", ""));
  for (const v of all)
    $("voiceSelect").append(new Option(v.name + " · " + v.lang, v.name));
  $("voiceSelect").value = settings.voiceName || all[0]?.name || "";
  $("voiceStatus").textContent = all.length
    ? "URDU VOICE · AVAILABLE"
    : "URDU VOICE · NOT INSTALLED";
  $("ttsStatus").textContent = all.length
    ? "System voice ready. Use Test greeting to check pronunciation."
    : "Text works normally. Install an Urdu-capable system voice for speech; VEXON will not substitute an English accent.";
}
function speak(text, force = false) {
  if ((!settings.speak && !force) || (!snapshot.desktop && !force)) return;
  const list = urduVoices();
  const voice =
    list.find(
      (v) => v.name === (settings.voiceName || $("voiceSelect").value),
    ) || list[0];
  if (!voice) {
    if (force) toast("No Urdu system voice available.");
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 3000));
  utterance.lang = "ur-PK";
  utterance.voice = voice;
  utterance.rate = 0.95;
  utterance.onstart = () => setState("speaking");
  utterance.onend = utterance.onerror = () => {
    if (!working && !recording) setState("idle");
  };
  speechSynthesis.speak(utterance);
}
async function send(text) {
  text = text?.trim();
  if (!text || working || recording) return;
  view("command");
  speechSynthesis.cancel();
  working = true;
  $("send").disabled = true;
  $("mic").disabled = true;
  $("stop").classList.remove("hidden");
  addMessage("user", text);
  $("command").value = "";
  setState("thinking");
  try {
    const r = await api.send(text);
    addMessage("assistant", r.text, r.error);
    if (!r.error) speak(r.text);
  } catch (e) {
    addMessage("assistant", e.message, true);
  } finally {
    working = false;
    $("send").disabled = false;
    $("mic").disabled = false;
    $("stop").classList.add("hidden");
    if (!speechSynthesis.speaking) setState("idle");
    $("command").focus();
  }
}
function renderActivity(items) {
  $("activityCount").textContent = String(items.length).padStart(2, "0");
  if (!items.length) return;
  $("activityList").replaceChildren();
  for (const a of items.slice(0, 25)) {
    const n = el("div", "activity-entry " + a.status);
    n.append(
      el("b", "", a.name.replaceAll("_", " ")),
      el("p", "", a.detail),
      el(
        "small",
        "",
        a.status.toUpperCase() + " · " + new Date(a.at).toLocaleTimeString(),
      ),
    );
    $("activityList").append(n);
  }
}
function renderSystem(s) {
  $("platformLabel").textContent =
    s.platform === "win32"
      ? "WINDOWS · LOCAL DEVICE"
      : s.platform === "preview"
        ? "DESKTOP REQUIRED"
        : s.platform?.toUpperCase() + " · LOCAL DEVICE";
  $("cpuValue").textContent = s.cpu == null ? "—" : s.cpu + "%";
  $("cpuBar").style.width = (s.cpu || 0) + "%";
  $("ramValue").textContent = s.ramTotal
    ? (s.ramUsed / 1073741824).toFixed(1) +
      " / " +
      (s.ramTotal / 1073741824).toFixed(0) +
      " GB"
    : "—";
  $("ramBar").style.width =
    (s.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : 0) + "%";
  $("uptime").textContent = s.uptime
    ? "UP " +
      Math.floor(s.uptime / 3600) +
      "H " +
      Math.floor((s.uptime % 3600) / 60) +
      "M"
    : "NO TELEMETRY";
}
function fillList(id, items, empty, render) {
  $(id).replaceChildren();
  if (!items.length) {
    $(id).append(el("p", "muted", empty));
    return;
  }
  items.forEach((x) => $(id).append(render(x)));
}
function renderMemory(d) {
  snapshot = { ...snapshot, ...d };
  $("noteCount").textContent = "· " + d.notes.length;
  fillList("notesList", d.notes, "Your next idea belongs here.", (n) => {
    const a = el("div", "item");
    const p = el("p", "", n.text);
    p.dir = "auto";
    a.append(p, el("small", "", new Date(n.createdAt).toLocaleString()));
    return a;
  });
  fillList(
    "preferencesList",
    d.preferences,
    "Only preferences you ask to remember appear here.",
    (t) => {
      const a = el("div", "item");
      a.append(el("p", "", t));
      return a;
    },
  );
  fillList(
    "remindersList",
    d.reminders.filter((r) => !r.done),
    "Nothing pending. A clear head.",
    (r) => {
      const a = el("div", "item");
      a.append(
        el("p", "", r.text),
        el("small", "", new Date(r.at).toLocaleString()),
      );
      return a;
    },
  );
}
function renderTabs(tabs) {
  fillList(
    "tabsList",
    tabs,
    "No tabs yet. Open a website to get started.",
    (t) => {
      const a = el("div", "item");
      a.append(
        el("p", "", (t.active ? "● " : "") + t.index + ". " + t.title),
        el("small", "", t.url),
      );
      const b = el("button", "secondary-btn", "Switch to tab ↗");
      b.onclick = () => action("switch_tab", { index: t.index });
      a.append(b);
      return a;
    },
  );
}
function renderFiles(files) {
  view("browser");
  fillList("filesList", files, "No matching documents found.", (f) => {
    const a = el("div", "item");
    a.append(el("p", "", f.name), el("small", "", f.relative));
    const b = el("button", "secondary-btn", "Open document ↗");
    b.onclick = () => safe(() => api.openFile(f.id));
    a.append(b);
    return a;
  });
}
async function safe(fn) {
  try {
    return await fn();
  } catch (e) {
    toast(e.message);
  }
}
async function action(name, args) {
  return safe(async () => {
    const r = await api.action(name, args);
    if (r.ok) toast("Done, Hasnain Sir.");
    return r;
  });
}
async function refreshModels() {
  const r = await api.models();
  $("connection").classList.toggle("online", r.online);
  $("connection").replaceChildren(
    el("i"),
    document.createTextNode(
      r.online ? "LOCAL BRAIN CONNECTED" : "LOCAL BRAIN · SETUP NEEDED",
    ),
  );
  $("modelStatus").textContent = r.online
    ? r.models.length + " installed models found."
    : "Ollama is not connected. Install/start Ollama on this computer.";
  $("modelSelect").replaceChildren(new Option("Select a local model", ""));
  for (const name of r.models) $("modelSelect").append(new Option(name, name));
  $("modelSelect").value = r.models.includes(settings.model)
    ? settings.model
    : "";
  if (settings.model && !r.models.includes(settings.model))
    $("modelStatus").textContent += " Saved model is not currently available.";
}
function whisperPaths() {
  $("exePath").textContent = settings.whisperExe || "Not configured";
  $("whisperPath").textContent = settings.whisperModel || "Not configured";
}
for (let i = 0; i < 35; i++) {
  const b = el("i");
  b.style.height = 3 + Math.sin(i * 0.8) ** 2 * 9 + "px";
  b.style.animationDelay = i * 0.045 + "s";
  $("waveform").append(b);
}
document
  .querySelectorAll(".nav")
  .forEach((b) => (b.onclick = () => view(b.dataset.view)));
document.querySelector(".logo").onclick = (e) => {
  e.preventDefault();
  view("command");
};
document
  .querySelectorAll("[data-prompt]")
  .forEach((b) => (b.onclick = () => send(b.dataset.prompt)));
$("commandForm").onsubmit = (e) => {
  e.preventDefault();
  send($("command").value);
};
$("command").onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send($("command").value);
  }
};
$("stop").onclick = () => {
  speechSynthesis.cancel();
  api.cancel();
};
$("fullscreen").onclick = () => safe(() => api.fullscreen());
$("clipboard").onclick = () =>
  safe(async () => {
    $("command").value = await api.clipboard();
    $("command").focus();
    toast("Clipboard pasted. Review it before sending.");
  });
$("clearChat").onclick = () =>
  safe(async () => {
    if (await api.clear()) $("messages").replaceChildren();
  });
$("quickNote").onclick = () => {
  view("memory");
  $("noteText").focus();
};
$("saveNote").onclick = async () => {
  const text = $("noteText").value.trim();
  if (!text) return toast("Write a note first.");
  if (await action("save_note", { text })) $("noteText").value = "";
};
$("savePreference").onclick = async () => {
  const text = $("preferenceText").value.trim();
  if (!text) return;
  if (await action("remember", { text })) $("preferenceText").value = "";
};
$("saveReminder").onclick = async () => {
  const text = $("reminderText").value.trim(),
    minutes = Number($("reminderMinutes").value);
  if (!text || !Number.isInteger(minutes) || minutes < 1 || minutes > 525600)
    return toast("Enter a reminder and valid minutes (1–525600).");
  if (await action("set_reminder", { text, minutes }))
    $("reminderText").value = "";
};
$("readPage").onclick = () => send("page parho");
$("searchFiles").onclick = () => {
  const query = $("fileQuery").value.trim();
  if (query) action("find_files", { query });
};
$("refreshModels").onclick = () => safe(refreshModels);
$("saveSettings").onclick = () =>
  safe(async () => {
    settings = await api.settings({
      model: $("modelSelect").value,
      voiceName: $("voiceSelect").value,
      speak: $("speakToggle").checked,
    });
    toast("Configuration saved.");
  });
$("speakToggle").onchange = () =>
  safe(async () => {
    settings = await api.settings({ speak: $("speakToggle").checked });
    if (!settings.speak) speechSynthesis.cancel();
  });
$("voiceSelect").onchange = () =>
  safe(
    async () =>
      (settings = await api.settings({ voiceName: $("voiceSelect").value })),
  );
$("testVoice").onclick = () =>
  speak("السلام علیکم حسنین سر۔ ویکسون حاضر ہے۔ بتائیے، آج کیا کرنا ہے؟", true);
$("pickExe").onclick = () =>
  safe(async () => {
    settings = await api.pick("whisperExe");
    whisperPaths();
  });
$("pickModel").onclick = () =>
  safe(async () => {
    settings = await api.pick("whisperModel");
    whisperPaths();
  });
$("mic").onclick = async () => {
  if (working) return;
  if (!recording) {
    if (!settings.whisperExe || !settings.whisperModel) {
      view("settings");
      toast(
        "Local voice input setup karein: whisper-cli aur multilingual model select karein.",
      );
      return;
    }
    try {
      speechSynthesis.cancel();
      recorder = new VoiceRecorder();
      await recorder.start((level) => {
        if (recording) {
          $("waveform")
            .querySelectorAll("i")
            .forEach((bar, i) => {
              bar.style.animation = "none";
              bar.style.height =
                3 +
                Math.min(1, level * 12) *
                  22 *
                  (0.4 + 0.6 * Math.abs(Math.sin(i * 0.9))) +
                "px";
            });
        }
        $("inputHint").textContent =
          "Recording locally · Level " +
          Math.round(level * 100) +
          " · Click microphone to finish";
      });
      recording = true;
      $("mic").classList.add("recording");
      $("send").disabled = true;
      setState("listening");
      recordTimer = setTimeout(() => $("mic").click(), 60000);
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  recording = false;
  $("waveform")
    .querySelectorAll("i")
    .forEach((bar) => {
      bar.style.animation = "";
      bar.style.height = "4px";
    });
  clearTimeout(recordTimer);
  $("mic").classList.remove("recording");
  working = true;
  $("mic").disabled = true;
  setState("thinking");
  try {
    const wav = await recorder.stop();
    const text = await api.transcribe(wav);
    $("command").value = text;
    toast("Voice transcribed. Review and press Enter to send.");
  } catch (e) {
    toast(e.message);
  } finally {
    working = false;
    $("send").disabled = false;
    $("mic").disabled = false;
    setState("idle");
    $("inputHint").textContent = "Enter to send · Shift + Enter for a new line";
  }
};
api.onEvent((e) => {
  if (e.type === "state") setState(e.state);
  if (e.type === "activity") renderActivity(e.activity);
  if (e.type === "memory") renderMemory(e);
  if (e.type === "tabs") renderTabs(e.tabs);
  if (e.type === "system") renderSystem(e.system);
  if (e.type === "files") renderFiles(e.files);
  if (e.type === "reminder") {
    toast("Reminder: " + e.reminder.text);
    addMessage("assistant", "حسنین سر، یاد دہانی: " + e.reminder.text);
    if (!working) speak("حسنین سر، یاد دہانی: " + e.reminder.text);
  }
});
function clock() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  $("date").textContent = now
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}
clock();
setInterval(clock, 1000);
speechSynthesis.onvoiceschanged = voices;
try {
  snapshot = await api.snapshot();
  settings = snapshot.settings;
  $("speakToggle").checked = settings.speak;
  if (!snapshot.desktop) {
    $("previewBanner").classList.remove("hidden");
    document.body.classList.add("preview");
  }
  renderMemory(snapshot);
  renderTabs(snapshot.tabs);
  renderSystem(snapshot.system);
  renderActivity(snapshot.activity);
  if (snapshot.history.length) {
    $("messages").replaceChildren();
    for (const m of snapshot.history) addMessage(m.role, m.content);
  }
  voices();
  whisperPaths();
  await refreshModels();
  if (snapshot.desktop)
    setTimeout(
      () =>
        speak("السلام علیکم حسنین سر۔ ویکسون حاضر ہے۔ بتائیے، آج کیا کرنا ہے؟"),
      1800,
    );
} catch (e) {
  toast("Startup: " + e.message);
}
setState("idle");
