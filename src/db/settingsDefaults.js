const SETTINGS_DEFAULTS = {
  max_subtasks: "3",
  default_nudge_window_minutes: "120",
  default_repeat_minutes: "60",
  nudge_mode: "single",
  quiet_hours_start: "23:00",
  quiet_hours_end: "07:00",
  timezone: "America/Sao_Paulo"
};

const ALLOWED_SETTING_KEYS = new Set(Object.keys(SETTINGS_DEFAULTS));

module.exports = { SETTINGS_DEFAULTS, ALLOWED_SETTING_KEYS };
