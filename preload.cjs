const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("vexon", {
  snapshot: () => ipcRenderer.invoke("snapshot"),
  send: (text) => ipcRenderer.invoke("send", text),
  cancel: () => ipcRenderer.invoke("cancel"),
  settings: (data) => ipcRenderer.invoke("settings", data),
  models: () => ipcRenderer.invoke("models"),
  action: (name, args) => ipcRenderer.invoke("action", name, args),
  openFile: (id) => ipcRenderer.invoke("open-file", id),
  clipboard: () => ipcRenderer.invoke("clipboard"),
  pick: (kind) => ipcRenderer.invoke("pick", kind),
  transcribe: (buffer) => ipcRenderer.invoke("transcribe", buffer),
  fullscreen: () => ipcRenderer.invoke("fullscreen"),
  clear: () => ipcRenderer.invoke("clear"),
  onEvent: (callback) => {
    const fn = (_event, data) => callback(data);
    ipcRenderer.on("event", fn);
    return () => ipcRenderer.removeListener("event", fn);
  },
});
