const { env, assertEnvVars } = require("../config/env");
const { sequelize } = require("../db/models");
const { getSettingsMap } = require("../services/settingsService");
const { findNudgableTasks, markTaskNudged } = require("../services/taskService");
const { pullTaskStatusFromTrelloConfigured, pushTasksToTrelloConfigured } = require("../services/trelloSyncService");
const { isInQuietHours, nowUtc } = require("../utils/time");
const { DiscordNotifierProvider } = require("../providers/discord/DiscordNotifierProvider");
const logger = require("../utils/logger");

function resolveNudgeMode(rawValue) {
  const normalized = String(rawValue || "single").trim().toLowerCase();
  return normalized === "all" ? "all" : "single";
}

function buildNudgeMessage(task) {
  const base = String(task.nudgeText || "").trim();
  const fallback = `Nudge [${task.id}]: ${task.title}. Reply: done: ${task.id} | snooze: ${task.id} 2h`;
  const header = base || fallback;

  const subtasks = Array.isArray(task.pendingSubtasks) ? task.pendingSubtasks : [];
  if (subtasks.length === 0) {
    return header;
  }

  const lines = subtasks.map((subtask) => `- [${subtask.id}] ${subtask.title}`);
  return `${header}\nSubtasks:\n${lines.join("\n")}`;
}

async function runOnce() {
  assertEnvVars(["DISCORD_BOT_TOKEN", "DISCORD_OWNER_ID"]);
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
      const tasksToSend = nudgeMode === "all" ? nudgableTasks : [nudgableTasks[0]];
      logger.info(`Runner nudge mode: ${nudgeMode}. Candidate=${nudgableTasks.length}, sending=${tasksToSend.length}`);

      const notifier = new DiscordNotifierProvider();
      try {
        for (const task of tasksToSend) {
          try {
            const nudgeMessage = buildNudgeMessage(task);
            await notifier.send(env.discordOwnerId, nudgeMessage);
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
