const path = require("path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { loadProjects, saveProjects, exportPayload, importPayload } = require("./services/storage");
const { loadSettings, saveSettings } = require("./services/settings");
const { chatCompletion, listModels } = require("./services/openrouter");

app.setAppUserModelId("com.storyforge.desktop");

function createWindow() {
  const win = new BrowserWindow({
    width: 1680,
    height: 1050,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#f4efe7",
    icon: path.join(__dirname, "story-forge.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("storage:load-projects", async () => loadProjects(app));
  ipcMain.handle("storage:save-projects", async (_event, projects) => saveProjects(app, projects));
  ipcMain.handle("storage:export-file", async (_event, suggestedName, payload) => {
    const result = await dialog.showSaveDialog({
      title: "Export Story Forge JSON",
      defaultPath: suggestedName,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await exportPayload(result.filePath, payload);
    return result.filePath;
  });
  ipcMain.handle("storage:import-file", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import Story Forge JSON",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }]
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return importPayload(result.filePaths[0]);
  });
  ipcMain.handle("settings:load", async () => loadSettings(app));
  ipcMain.handle("settings:save", async (_event, settings) => saveSettings(app, settings));
  ipcMain.handle("ai:models", async (_event, settings) => listModels(settings));
  ipcMain.handle("ai:chat", async (_event, payload) => chatCompletion(payload));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
