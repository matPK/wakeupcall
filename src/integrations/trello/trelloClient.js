const BASE_URL = "https://api.trello.com/1";

function isTrelloConfigured(trelloConfig) {
  return Boolean(
    trelloConfig &&
      trelloConfig.apiKey &&
      trelloConfig.token &&
      trelloConfig.boardId &&
      trelloConfig.todoListId &&
      trelloConfig.doneListId
  );
}

class TrelloClient {
  constructor(trelloConfig) {
    this.config = trelloConfig;
  }

  async listBoardCards() {
    return this.request("GET", `/boards/${encodeURIComponent(this.config.boardId)}/cards`, {
      fields: "id,idList,closed,name,dateLastActivity"
    });
  }

  async createCard({ name, desc, due }) {
    const payload = {
      idList: this.config.todoListId,
      name,
      desc
    };
    if (due) {
      payload.due = due;
    }

    return this.request("POST", "/cards", payload);
  }

  async request(method, path, queryOrBody) {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("key", this.config.apiKey);
    url.searchParams.set("token", this.config.token);

    const options = { method, headers: {} };
    if (method === "GET") {
      for (const [key, value] of Object.entries(queryOrBody || {})) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    } else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(queryOrBody || {});
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Trello API ${method} ${path} failed: ${response.status} ${text.slice(0, 200)}`);
    }
    return response.json();
  }
}

module.exports = { TrelloClient, isTrelloConfigured };
