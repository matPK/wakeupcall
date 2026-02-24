const { sequelize } = require("../db/models");
const { assertEnvVars, assertDiscordAllowListConfigured } = require("../config/env");
const logger = require("../utils/logger");
const { DiscordInboxProvider } = require("../providers/discord/DiscordInboxProvider");
const { CommandHandler } = require("./commandHandler");

async function startBot() {
  assertEnvVars(["DISCORD_BOT_TOKEN", "OPENAI_API_KEY"]);
  assertDiscordAllowListConfigured();
  await sequelize.authenticate();
  logger.info("Database connection OK for bot.");

  const inbox = new DiscordInboxProvider();
  const handler = new CommandHandler(inbox);
  await inbox.start((message) => handler.onMessage(message));
}

startBot().catch((err) => {
  logger.error("Bot startup failed", err.message);
  process.exitCode = 1;
});
