const { Setting } = require("../db/models");
const { SETTINGS_DEFAULTS } = require("../db/settingsDefaults");

function normalizeSettings(records) {
  const map = { ...SETTINGS_DEFAULTS };
  for (const record of records) {
    map[record.key] = record.value;
  }
  return map;
}

async function getSettingsMap() {
  const settings = await Setting.findAll();
  return normalizeSettings(settings);
}

function getSettingInt(settings, key, fallback) {
  const raw = settings[key];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

module.exports = {
  getSettingsMap,
  getSettingInt
};
