const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("storyCreator", {
  storage: {
    loadProjects: () => ipcRenderer.invoke("storage:load-projects"),
    saveProjects: (projects) => ipcRenderer.invoke("storage:save-projects", projects),
    exportFile: (suggestedName, payload) => ipcRenderer.invoke("storage:export-file", suggestedName, payload),
    importFile: () => ipcRenderer.invoke("storage:import-file")
  },
  settings: {
    load: () => ipcRenderer.invoke("settings:load"),
    save: (settings) => ipcRenderer.invoke("settings:save", settings)
  },
  ai: {
    models: (settings) => ipcRenderer.invoke("ai:models", settings),
    chat: (payload) => ipcRenderer.invoke("ai:chat", payload)
  }
});
