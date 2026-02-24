const dotenv = require("dotenv");

dotenv.config();

function readRequired(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

function parseIdList(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function unique(values) {
  return [...new Set(values)];
}

const discordOwnerId = process.env.DISCORD_OWNER_ID || "";
const allowedFromEnv = parseIdList(process.env.DISCORD_ALLOWED_USER_IDS || "");
const discordAllowedUserIds = unique(discordOwnerId ? [discordOwnerId, ...allowedFromEnv] : allowedFromEnv);

const env = {
  discordBotToken: process.env.DISCORD_BOT_TOKEN || "",
  discordOwnerId,
  discordAllowedUserIds,
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-5-nano",
  db: {
    database: readRequired("DB_NAME"),
    username: readRequired("DB_USER"),
    password: readRequired("DB_PASSWORD"),
    host: readRequired("DB_HOST"),
    port: parsePort("DB_PORT", 3306),
    dialect: (process.env.DB_DIALECT || "mysql").toLowerCase()
  },
  trello: {
    apiKey: process.env.TRELLO_API_KEY || "",
    token: process.env.TRELLO_TOKEN || "",
    boardId: process.env.TRELLO_BOARD_ID || "",
    todoListId: process.env.TRELLO_TODO_LIST_ID || "",
    doneListId: process.env.TRELLO_DONE_LIST_ID || ""
  }
};

function assertEnvVars(names) {
  for (const name of names) {
    readRequired(name);
  }
}

function assertDiscordAllowListConfigured() {
  if (!Array.isArray(env.discordAllowedUserIds) || env.discordAllowedUserIds.length === 0) {
    throw new Error("Missing Discord allowlist. Set DISCORD_ALLOWED_USER_IDS or DISCORD_OWNER_ID.");
  }
}

module.exports = { env, assertEnvVars, assertDiscordAllowListConfigured };
