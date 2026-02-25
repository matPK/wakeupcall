const { parseIncomingCommand } = require("../utils/commands");
const { formatWindowForUser } = require("../utils/time");
const { getSettingsMap } = require("../services/settingsService");
const {
  createTasksFromCompilerOutput,
  listPendingTopLevelTasks,
  markTaskDoneWithDescendants,
  updateTaskWindowBySnooze,
  getPendingTaskById,
  getTaskById
} = require("../services/taskService");
const { Setting } = require("../db/models");
const { ALLOWED_SETTING_KEYS } = require("../db/settingsDefaults");
const { TaskCompiler, CompilerError } = require("../compiler/taskCompiler");
const logger = require("../utils/logger");

const EXPLICIT_MULTI_TASK_CUE = /\b(also|another task|another one|separately|separate task|in addition|additionally|plus)\b/i;
const CATEGORY_LIKE_MEMORY_CONTEXT = /^[a-z0-9_-]+$/i;

function renderTaskTitle(task) {
  const raw = String(task && task.title ? task.title : "");
  const withId = raw.replace(/\{\{\s*id\s*\}\}/gi, String(task && task.id ? task.id : ""));
  const normalized = withId.replace(/\s+/g, " ").trim();
  return normalized || "Untitled task";
}

function hasExplicitMultiTaskCue(text) {
  return EXPLICIT_MULTI_TASK_CUE.test(String(text || ""));
}

function coerceSingleTopLevelTask(compiled, originalText) {
  if (!compiled || !Array.isArray(compiled.tasks) || compiled.tasks.length <= 1) {
    return { compiled, coerced: false };
  }
  if (hasExplicitMultiTaskCue(originalText)) {
    return { compiled, coerced: false };
  }

  const parentRef = compiled.tasks[0].parent_ref || "local_parent_auto_1";
  compiled.tasks[0].parent_ref = parentRef;
  compiled.links = compiled.tasks.slice(1).map((_, index) => ({
    child_index: index + 1,
    parent_ref: parentRef
  }));

  return { compiled, coerced: true };
}

class CommandHandler {
  constructor(inboxProvider) {
    this.inboxProvider = inboxProvider;
    this.compiler = new TaskCompiler();
  }

  async onMessage(message) {
    const parsed = parseIncomingCommand(message.content);
    if (!parsed) {
      return;
    }

    switch (parsed.type) {
      case "help":
        await this.replyHelp(message.channelId);
        return;
      case "list":
        await this.replyList(message.channelId);
        return;
      case "done":
        await this.handleDone(message.channelId, parsed.taskId);
        return;
      case "explain":
        await this.handleExplain(message.channelId, parsed.taskId);
        return;
      case "nudge":
        await this.handleNudge(message, parsed.text);
        return;
      case "snooze":
        await this.handleSnooze(message, parsed.taskId, parsed.text);
        return;
      case "config":
        await this.handleConfig(message, parsed.text);
        return;
      default:
        return;
    }
  }

  async replyHelp(channelId) {
    const text = [
      "Commands:",
      "help",
      "list",
      "nudge: fix bathroom door this evening",
      "nudge: fix sink next week. need to buy silicone first",
      "nudge: fix sink, also schedule dentist",
      "snooze: 12 2h",
      "done: 12",
      "explain: 12",
      "config: repeat every 45m and quiet hours 22:30-07:00",
      "config: nudge mode single"
    ].join("\n");
    await this.inboxProvider.reply(channelId, text);
  }

  async replyList(channelId) {
    const settings = await getSettingsMap();
    const timezone = settings.timezone || "America/Sao_Paulo";
    const tasks = await listPendingTopLevelTasks();

    if (tasks.length === 0) {
      await this.inboxProvider.reply(channelId, "No pending top-level tasks.");
      return;
    }

    const lines = tasks.map((task) => {
      const start = formatWindowForUser(task.nudgeWindowStart, timezone);
      const end = formatWindowForUser(task.nudgeWindowEnd, timezone);
      return `[${task.id}] ${renderTaskTitle(task)} | ${start} -> ${end}`;
    });

    await this.inboxProvider.reply(channelId, lines.join("\n"));
  }

  async handleDone(channelId, taskId) {
    if (!Number.isInteger(taskId) || taskId <= 0) {
      await this.inboxProvider.reply(channelId, "Use: done: <taskId>");
      return;
    }

    const result = await markTaskDoneWithDescendants(taskId);
    if (!result.found) {
      await this.inboxProvider.reply(channelId, `Task ${taskId} not found.`);
      return;
    }
    if (result.alreadyDone) {
      await this.inboxProvider.reply(channelId, `Task [${taskId}] is already done.`);
      return;
    }
    if (result.rootWasDone) {
      await this.inboxProvider.reply(channelId, `Task [${taskId}] was already done; marked ${result.updatedCount} subtask(s) done.`);
      return;
    }

    await this.inboxProvider.reply(
      channelId,
      `Done [${taskId}] (+${Math.max(0, result.updatedCount - 1)} subtasks). Good job!`
    );
  }

  async handleExplain(channelId, taskId) {
    if (!Number.isInteger(taskId) || taskId <= 0) {
      await this.inboxProvider.reply(channelId, "Use: explain: <taskId>");
      return;
    }

    const task = await getTaskById(taskId);
    if (!task) {
      await this.inboxProvider.reply(channelId, `Task ${taskId} not found.`);
      return;
    }

    const context = typeof task.memoryContext === "string" ? task.memoryContext.trim() : "";
    const looksLikeCategoryToken = context && !context.includes("\n") && context.split(/\s+/).length <= 3 && CATEGORY_LIKE_MEMORY_CONTEXT.test(context);
    if (!context || looksLikeCategoryToken) {
      const categoryLine = task.category ? `\nCategory: ${task.category}` : "";
      await this.inboxProvider.reply(channelId, `Explain [${taskId}]: no extra notes saved. Task looks self-explanatory.${categoryLine}`);
      return;
    }

    const clipped = context.length > 1700 ? `${context.slice(0, 1700)}...` : context;
    const categoryLine = task.category ? `Category: ${task.category}\n` : "";
    await this.inboxProvider.reply(channelId, `Explain [${taskId}] ${renderTaskTitle(task)}\n${categoryLine}${clipped}`);
  }

  async handleNudge(message, text) {
    const settings = await getSettingsMap();
    const timezone = settings.timezone || "America/Sao_Paulo";

    let compiled;
    try {
      compiled = await this.compiler.compile({
        commandType: "nudge",
        commandText: text,
        settings,
        timezone
      });
    } catch (err) {
      await this.handleCompileError(message.channelId, err);
      return;
    }

    if (compiled.intent === "clarify") {
      await this.inboxProvider.reply(message.channelId, compiled.clarify_question || "Can you clarify that nudge?");
      return;
    }
    if (compiled.intent !== "create") {
      await this.inboxProvider.reply(message.channelId, "I expected a create intent. Please rephrase your nudge.");
      return;
    }

    if (!Array.isArray(compiled.tasks) || compiled.tasks.length === 0) {
      await this.inboxProvider.reply(message.channelId, "I could not build tasks. Rephrase with clearer time/context.");
      return;
    }

    const coercion = coerceSingleTopLevelTask(compiled, text);
    compiled = coercion.compiled;

    const maxSubtasks = Math.max(0, Number(settings.max_subtasks || 3));
    const hardCap = maxSubtasks + 1;
    if (compiled.tasks.length > hardCap) {
      compiled.tasks = compiled.tasks.slice(0, hardCap);
      compiled.links = (compiled.links || []).filter((link) => link.child_index < hardCap);
    }

    const created = await createTasksFromCompilerOutput(compiled, message);
    const lines = created.map((task) => {
      const categorySuffix = task.category ? ` {${task.category}}` : "";
      return `[${task.id}] ${renderTaskTitle(task)}${categorySuffix}`;
    });
    const topLevelCount = created.filter((task) => task.parentTaskId === null).length;
    const subtaskCount = created.length - topLevelCount;
    const topLevelTasks = created.filter((task) => task.parentTaskId === null);
    const windowLines = topLevelTasks.map((task) => {
      const start = formatWindowForUser(task.nudgeWindowStart, timezone);
      const end = formatWindowForUser(task.nudgeWindowEnd, timezone);
      return `[${task.id}] ${start} -> ${end}`;
    });
    const summary =
      subtaskCount > 0
        ? `Created ${topLevelCount} task(s) + ${subtaskCount} subtask(s):`
        : `Created ${created.length} task(s):`;
    const hint = coercion.coerced
      ? "\nHint: use \"also\" if you want separate top-level tasks."
      : "";
    const windowSummary =
      windowLines.length > 0
        ? `\nNudge window (${timezone}):\n${windowLines.join("\n")}`
        : "";
    await this.inboxProvider.reply(message.channelId, `${summary}\n${lines.join("\n")}${windowSummary}${hint}`);
  }

  async handleSnooze(message, taskId, text) {
    if (!Number.isInteger(taskId) || taskId <= 0) {
      await this.inboxProvider.reply(message.channelId, "Use: snooze: <taskId> <when>");
      return;
    }

    const task = await getPendingTaskById(taskId);
    if (!task) {
      await this.inboxProvider.reply(message.channelId, `Task ${taskId} not found or not pending.`);
      return;
    }

    const settings = await getSettingsMap();
    const timezone = settings.timezone || "America/Sao_Paulo";
    const commandText = JSON.stringify({
      task_id: taskId,
      task_title: task.title,
      current_window_start: task.nudgeWindowStart,
      current_window_end: task.nudgeWindowEnd,
      user_request: text
    });

    let compiled;
    try {
      compiled = await this.compiler.compile({
        commandType: "snooze",
        commandText,
        settings,
        timezone
      });
    } catch (err) {
      await this.handleCompileError(message.channelId, err);
      return;
    }

    if (compiled.intent === "clarify") {
      await this.inboxProvider.reply(message.channelId, compiled.clarify_question || "Clarify snooze timing.");
      return;
    }
    if (compiled.intent !== "snooze") {
      await this.inboxProvider.reply(message.channelId, "I expected a snooze intent. Try `snooze: <id> 2h`.");
      return;
    }

    const snoozePayload = compiled.snooze
      ? compiled.snooze
      : compiled.tasks[0]
        ? {
            new_window_start: compiled.tasks[0].nudge_window_start,
            new_window_end: compiled.tasks[0].nudge_window_end
          }
        : null;

    if (!snoozePayload) {
      await this.inboxProvider.reply(message.channelId, "I could not parse that snooze. Try `snooze: <id> 2h`.");
      return;
    }

    const updated = await updateTaskWindowBySnooze(taskId, snoozePayload);
    if (!updated || !updated.updated) {
      await this.inboxProvider.reply(message.channelId, `Task ${taskId} could not be snoozed.`);
      return;
    }

    const start = formatWindowForUser(updated.task.nudgeWindowStart, timezone);
    const end = formatWindowForUser(updated.task.nudgeWindowEnd, timezone);
    await this.inboxProvider.reply(message.channelId, `Snoozed [${taskId}] -> ${start} to ${end}`);
  }

  async handleConfig(message, text) {
    const settings = await getSettingsMap();
    const timezone = settings.timezone || "America/Sao_Paulo";

    let compiled;
    try {
      compiled = await this.compiler.compile({
        commandType: "config",
        commandText: text,
        settings,
        timezone
      });
    } catch (err) {
      await this.handleCompileError(message.channelId, err);
      return;
    }

    if (compiled.intent === "clarify") {
      await this.inboxProvider.reply(message.channelId, compiled.clarify_question || "Clarify config update.");
      return;
    }
    if (compiled.intent !== "config") {
      await this.inboxProvider.reply(message.channelId, "I expected config changes. Please rephrase.");
      return;
    }

    const updates = (compiled.config || []).filter((item) => ALLOWED_SETTING_KEYS.has(item.key));
    if (updates.length === 0) {
      await this.inboxProvider.reply(message.channelId, "No valid config keys found.");
      return;
    }

    for (const item of updates) {
      await Setting.upsert({ key: item.key, value: String(item.value) });
    }

    const summary = updates.map((u) => `${u.key}=${u.value}`).join(", ");
    await this.inboxProvider.reply(message.channelId, `Config updated: ${summary}`);
  }

  async handleCompileError(channelId, err) {
    if (err instanceof CompilerError) {
      await this.inboxProvider.reply(channelId, "I could not parse that request. Please rephrase.");
      return;
    }
    logger.error("Unexpected compiler error", err.message);
    await this.inboxProvider.reply(channelId, "Compiler failed. Try again shortly.");
  }
}

module.exports = { CommandHandler };
