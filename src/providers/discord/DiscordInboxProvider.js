const { Client, GatewayIntentBits, Partials, ChannelType } = require("discord.js");
const { env } = require("../../config/env");
const logger = require("../../utils/logger");

class DiscordInboxProvider {
  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds],
      partials: [Partials.Channel]
    });
    this.ready = false;
  }

  async start(onMessage) {
    this.client.on("clientReady", () => {
      this.ready = true;
      logger.info(`Discord inbox connected as ${this.client.user.tag}`);
    });

    this.client.on("messageCreate", async (message) => {
      try {
        if (message.author.bot) {
          return;
        }
        if (message.author.id !== env.discordOwnerId) {
          return;
        }
        if (message.channel.type !== ChannelType.DM) {
          return;
        }

        const payload = {
          content: message.content,
          authorId: message.author.id,
          channelId: message.channel.id,
          messageId: message.id,
          repliedToMessageId: message.reference ? message.reference.messageId : null,
          timestamp: message.createdAt.toISOString(),
          raw: message
        };
        await onMessage(payload);
      } catch (err) {
        logger.error("Inbox message handler failed", err.message);
      }
    });

    await this.client.login(env.discordBotToken);
  }

  async reply(channelId, text) {
    const channel = await this.client.channels.fetch(channelId);
    await channel.send(String(text));
  }
}

module.exports = { DiscordInboxProvider };
