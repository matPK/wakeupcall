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

const env = {
  discordBotToken: process.env.DISCORD_BOT_TOKEN || "",
  discordOwnerId: process.env.DISCORD_OWNER_ID || "",
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

module.exports = { env, assertEnvVars };
