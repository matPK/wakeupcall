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

function buildSystemPrompt({ commandType, settings, timezone, nowIso, commandText }) {
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
    "1) intent=create for nudge command.",
    "2) intent=snooze for snooze command.",
    "3) intent=config for config command.",
    "4) If ambiguous, use intent=clarify and fill clarify_question.",
    "5) tasks[].nudge_text must include {{id}} token and include done/snooze hint.",
    "5b) Never include {{id}} in tasks[].title, only in tasks[].nudge_text.",
    "6) For create intent, task windows must be ISO8601 with timezone.",
    "7) Respect settings.max_subtasks, do not exceed it.",
    "8) links[] child_index must reference tasks array index.",
    "9) Default to a single top-level task for nudge unless the user explicitly asks for multiple tasks (e.g. 'also', 'another task', 'separately').",
    "10) If a sentence looks like a dependency or prerequisite for the main action, model it as a subtask, not another top-level task.",
    "11) memory_context is for minimal practical advice, not categorization labels/tags.",
    "12) memory_context should be either null (if trivial/self-explanatory) OR 1-4 short actionable lines (safety, tools, pitfalls, order of steps).",
    "13) category should be a short lower-kebab-case label describing task domain, or null if unclear.",
    "14) Prefer reusable practical categories such as chores, home-maintenance, office-maintenance, fatherhood, marriage, health, finance, admin, learning.",
    "15) Never put category labels inside memory_context.",
    "16) Temporal policy: stretch-to-fill. Make execution windows as wide as reasonably possible within user-stated bounds; do not collapse vague periods into short slots.",
    "17) If user says 'today', set high priority (use 10) and set window end to configured quiet_hours_start of the same local day.",
    "18) If user says 'this month', set window start to tomorrow 00:00 local time and window end to the last day of current month 23:59:59 local time.",
    "19) If user says 'next week' without specific day/time, set window to Monday 00:00 through Friday 23:59:59 of next week in local timezone.",
    "20) Only choose short windows when user gives explicit short constraints.",
    "21) Do not include secrets."
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
