const { env, assertEnvVars } = require("../config/env");
const { sequelize } = require("../db/models");
const { getSettingsMap } = require("../services/settingsService");
const { findNudgableTasks, markTaskNudged } = require("../services/taskService");
const { pullTaskStatusFromTrelloConfigured, pushTasksToTrelloConfigured } = require("../services/trelloSyncService");
const { isInQuietHours, nowUtc } = require("../utils/time");
const { DiscordNotifierProvider } = require("../providers/discord/DiscordNotifierProvider");
const logger = require("../utils/logger");

function renderTaskTitle(task) {
  const raw = String(task && task.title ? task.title : "");
  const withId = raw.replace(/\{\{\s*id\s*\}\}/gi, String(task && task.id ? task.id : ""));
  const normalized = withId.replace(/\s+/g, " ").trim();
  return normalized || "Untitled task";
}

function resolveNudgeMode(rawValue) {
  const normalized = String(rawValue || "single").trim().toLowerCase();
  return normalized === "all" ? "all" : "single";
}

function buildNudgeMessage(task) {
  const base = String(task.nudgeText || "").trim();
  const fallback = `Nudge [${task.id}]: ${renderTaskTitle(task)}. Reply: done: ${task.id} | snooze: ${task.id} 2h`;
  const header = base || fallback;

  const subtasks = Array.isArray(task.pendingSubtasks) ? task.pendingSubtasks : [];
  if (subtasks.length === 0) {
    return header;
  }

  const lines = subtasks.map((subtask) => `- [${subtask.id}] ${subtask.title}`);
  return `${header}\nSubtasks:\n${lines.join("\n")}`;
}

function resolveTargetUserId(task) {
  return task.sourceUserId || env.discordOwnerId || null;
}

function selectTasksForSingleMode(nudgableTasks) {
  const selectedByTarget = new Map();
  for (const task of nudgableTasks) {
    const targetUserId = resolveTargetUserId(task);
    if (!targetUserId) {
      continue;
    }
    if (!selectedByTarget.has(targetUserId)) {
      selectedByTarget.set(targetUserId, task);
    }
  }
  return [...selectedByTarget.values()];
}

async function runOnce() {
  assertEnvVars(["DISCORD_BOT_TOKEN"]);
  await sequelize.authenticate();
  const settings = await getSettingsMap();
  const timezone = settings.timezone || "America/Sao_Paulo";
  const now = nowUtc();

  const trelloPull = await pullTaskStatusFromTrelloConfigured(env.trello);
  if (trelloPull.skipped) {
    logger.info(`Trello status pull skipped: ${trelloPull.reason}`);
  } else {
    logger.info(
      `Trello status pull complete. checked=${trelloPull.checkedCount}, doneUpdated=${trelloPull.doneUpdatedCount}, missingCards=${trelloPull.missingCardCount}`
    );
  }

  let sentCount = 0;
  const inQuietHours = isInQuietHours(now, timezone, settings.quiet_hours_start, settings.quiet_hours_end);
  if (inQuietHours) {
    logger.info("Runner skipping nudge sends because current time is in quiet hours.");
  } else {
    const nudgableTasks = await findNudgableTasks(settings);
    if (nudgableTasks.length === 0) {
      logger.info("Runner found no nudgable tasks.");
    } else {
      const nudgeMode = resolveNudgeMode(settings.nudge_mode);
      const tasksToSend = nudgeMode === "all" ? nudgableTasks : selectTasksForSingleMode(nudgableTasks);
      logger.info(`Runner nudge mode: ${nudgeMode}. Candidate=${nudgableTasks.length}, sending=${tasksToSend.length}`);

      const notifier = new DiscordNotifierProvider();
      try {
        for (const task of tasksToSend) {
          try {
            const targetUserId = resolveTargetUserId(task);
            if (!targetUserId) {
              logger.warn(`Skipping nudge for task ${task.id}: no target user (sourceUserId and DISCORD_OWNER_ID both missing).`);
              continue;
            }
            const nudgeMessage = buildNudgeMessage(task);
            await notifier.send(targetUserId, nudgeMessage);
            await markTaskNudged(task.id);
            sentCount += 1;
          } catch (err) {
            logger.error(`Failed to send nudge for task ${task.id}`, err.message);
          }
        }
      } finally {
        await notifier.close();
      }
      logger.info(`Runner sent ${sentCount} nudge(s).`);
    }
  }

  const trelloPush = await pushTasksToTrelloConfigured(env.trello);
  if (trelloPush.skipped) {
    logger.info(`Trello push skipped: ${trelloPush.reason}`);
  } else {
    logger.info(`Trello push complete. created=${trelloPush.createdCount}`);
  }
}

runOnce()
  .catch((err) => {
    logger.error("Runner failed", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
