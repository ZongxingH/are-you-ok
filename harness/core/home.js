const fs = require("fs");
const path = require("path");

let homeOverride = null;

function setHome(value) {
  homeOverride = value || null;
}

function getHome() {
  const raw = homeOverride || process.env.AUOK_HOME || "auok";
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

function relativeHome() {
  return path.relative(process.cwd(), getHome()) || ".";
}

function resolveInHome(...parts) {
  return path.join(getHome(), ...parts);
}

function resolveRunDir(value) {
  if (!value) return resolveInHome("runs", new Date().toISOString().replace(/[:.]/g, "-"));
  if (path.isAbsolute(value)) return value;
  if (value === "." || value.startsWith(`.${path.sep}`) || value.startsWith("..")) return path.resolve(process.cwd(), value);
  const normalized = path.normalize(value);
  const homeRel = path.normalize(relativeHome());
  if (normalized === homeRel || normalized.startsWith(`${homeRel}${path.sep}`)) {
    return path.resolve(process.cwd(), value);
  }
  if (normalized === "runs" || normalized.startsWith(`runs${path.sep}`)) {
    return resolveInHome(normalized);
  }
  return resolveInHome("runs", value);
}

function resolveProjectPath(value) {
  if (!value) return value;
  if (path.isAbsolute(value)) return value;
  return path.resolve(process.cwd(), value);
}

function hasHome() {
  return fs.existsSync(getHome());
}

module.exports = {
  getHome,
  hasHome,
  relativeHome,
  resolveInHome,
  resolveProjectPath,
  resolveRunDir,
  setHome
};
