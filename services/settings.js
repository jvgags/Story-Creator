const fs = require("fs/promises");
const path = require("path");

function getSettingsPath(app) {
  return path.join(app.getPath("userData"), "settings.json");
}

async function loadSettings(app) {
  try {
    const raw = await fs.readFile(getSettingsPath(app), "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        apiKey: "",
        referer: "",
        appTitle: "Story Forge",
        lastModel: "openrouter/auto"
      };
    }
    throw error;
  }
}

async function saveSettings(app, settings) {
  await fs.writeFile(getSettingsPath(app), JSON.stringify(settings, null, 2), "utf8");
  return true;
}

module.exports = {
  loadSettings,
  saveSettings
};
