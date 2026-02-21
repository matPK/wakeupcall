class NotifierProvider {
  async send(_targetId, _text) {
    throw new Error("Not implemented");
  }
}

module.exports = { NotifierProvider };
