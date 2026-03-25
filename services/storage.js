const fs = require("fs/promises");
const path = require("path");

function getDataDir(app) {
  return path.join(app.getPath("userData"), "data");
}

function getProjectsPath(app) {
  return path.join(getDataDir(app), "projects.json");
}

async function ensureDir(app) {
  await fs.mkdir(getDataDir(app), { recursive: true });
}

async function loadProjects(app) {
  try {
    await ensureDir(app);
    const raw = await fs.readFile(getProjectsPath(app), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveProjects(app, projects) {
  await ensureDir(app);
  await fs.writeFile(getProjectsPath(app), JSON.stringify(projects, null, 2), "utf8");
  return true;
}

async function exportPayload(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function importPayload(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

module.exports = {
  loadProjects,
  saveProjects,
  exportPayload,
  importPayload
};
