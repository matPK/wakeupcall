const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { env } = require("../../config/env");

class DiscordNotifierProvider {
  constructor(existingClient) {
    this.client = existingClient || null;
    this.ownsClient = !existingClient;
  }

  async ensureClient() {
    if (this.client) {
      return this.client;
    }
    this.client = new Client({
      intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.Guilds],
      partials: [Partials.Channel]
    });
    await this.client.login(env.discordBotToken);
    return this.client;
  }

  async send(targetId, text) {
    const client = await this.ensureClient();
    const user = await client.users.fetch(targetId);
    const dm = await user.createDM();
    await dm.send(String(text));
  }

  async close() {
    if (this.client && this.ownsClient) {
      await this.client.destroy();
      this.client = null;
    }
  }
}

module.exports = { DiscordNotifierProvider };
