const OpenAI = require("openai");
const { DateTime } = require("luxon");
const { env } = require("../config/env");
const { CompilerOutputSchema, COMPILER_JSON_SCHEMA } = require("./schema");

class CompilerError extends Error {
  constructor(message) {
    super(message);
    this.name = "CompilerError";
  }
}

function extractResponseText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return response.output_text;
  }
  if (Array.isArray(response.output)) {
    const chunks = [];
    for (const item of response.output) {
      if (!Array.isArray(item.content)) {
        continue;
      }
      for (const content of item.content) {
        if (content && typeof content.text === "string") {
          chunks.push(content.text);
        }
      }
    }
    return chunks.join("\n");
  }
  return "";
}

function buildRulesForCommand(commandType) {
  switch (commandType) {
    case "nudge":
      return [
        "1) intent must be create. If user intent is unclear, use intent=clarify and fill clarify_question.",
        "2) For create intent, task windows must be ISO8601 with timezone.",
        "3) tasks[].nudge_text must include {{id}} token and include done/snooze hint.",
        "4) Never include {{id}} in tasks[].title, only in tasks[].nudge_text.",
        "5) Respect settings.max_subtasks, do not exceed it.",
        "6) links[] child_index must reference tasks array index.",
        "7) Default to a single top-level task unless the user explicitly asks for multiple tasks (e.g. 'also', 'another task', 'separately').",
        "8) If a sentence looks like a dependency or prerequisite for the main action, model it as a subtask, not another top-level task.",
        "9) category should be a short lower-kebab-case label describing task domain, or null if unclear.",
        "10) Prefer reusable practical categories such as chores, home-maintenance, office-maintenance, fatherhood, marriage, health, finance, admin, learning.",
        "11) Temporal policy: stretch-to-fill. Make execution windows as wide as reasonably possible within user-stated bounds; do not collapse vague periods into short slots.",
        "12) If user says 'today', set high priority (use 10) and set window end to configured quiet_hours_start of the same local day.",
        "13) If user says 'this month', set window start to tomorrow 00:00 local time and window end to the last day of current month 23:59:59 local time.",
        "14) If user says 'next week' without specific day/time, set window to Monday 00:00 through Friday 23:59:59 of next week in local timezone.",
        "15) Only choose short windows when user gives explicit short constraints.",
        "16) Do not include secrets."
      ];
    case "snooze":
      return [
        "1) intent must be snooze. If user intent is unclear, use intent=clarify and fill clarify_question.",
        "2) Output snooze payload either as {minutes} OR {new_window_start, new_window_end}.",
        "3) If user gives a relative delay (e.g. '2h', 'tomorrow morning'), prefer minutes when practical.",
        "4) If user gives explicit datetime/range, use new_window_start/new_window_end in ISO8601 with timezone.",
        "5) Keep tasks[] empty unless absolutely necessary for schema compatibility.",
        "6) Do not include secrets."
      ];
    case "config":
      return [
        "1) intent must be config. If user intent is unclear, use intent=clarify and fill clarify_question.",
        "2) Populate config[] with explicit key/value updates inferred from user message.",
        "3) Keep values concise and machine-friendly (strings only).",
        "4) Keep tasks[] empty, links[] empty, and snooze=null for config updates.",
        "5) Do not include secrets."
      ];
    default:
      return [
        "1) If unclear, use intent=clarify and fill clarify_question.",
        "2) Do not include secrets."
      ];
  }
}

function buildSystemPrompt({ commandType, settings, timezone, nowIso, commandText }) {
  const rules = buildRulesForCommand(commandType);
  return [
    "You are WakeupCall TaskCompiler v1.",
    "Return JSON only. No markdown.",
    "Follow schema exactly.",
    `Command type: ${commandType}`,
    `Current local time timezone: ${timezone}`,
    `Current local time ISO8601: ${nowIso}`,
    `Settings JSON: ${JSON.stringify(settings)}`,
    `Raw command payload: ${commandText}`,
    "Rules:",
    ...rules
  ].join("\n");
}

class TaskCompiler {
  constructor() {
    this.client = new OpenAI({ apiKey: env.openAiApiKey });
    this.model = env.openAiModel || "gpt-5-nano";
  }

  async compile({ commandType, commandText, settings, timezone }) {
    const nowIso = DateTime.now().setZone(timezone).toISO();
    const systemPrompt = buildSystemPrompt({ commandType, settings, timezone, nowIso, commandText });

    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: commandText }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "wakeupcall_compiler_v1",
          schema: COMPILER_JSON_SCHEMA,
          strict: true
        }
      }
    });

    const raw = extractResponseText(response);
    if (!raw) {
      throw new CompilerError("Empty model response.");
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      throw new CompilerError("Model response was not valid JSON.");
    }

    const parsed = CompilerOutputSchema.safeParse(json);
    if (!parsed.success) {
      throw new CompilerError("Model output failed schema validation.");
    }
    return parsed.data;
  }
}

module.exports = { TaskCompiler, CompilerError };
