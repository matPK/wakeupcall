class InboxProvider {
  async start(_onMessage) {
    throw new Error("Not implemented");
  }

  async reply(_channelId, _text) {
    throw new Error("Not implemented");
  }
}

module.exports = { InboxProvider };
