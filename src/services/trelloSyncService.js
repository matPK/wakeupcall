const { Op } = require("sequelize");
const { Task, TaskIntegration } = require("../db/models");
const { markTaskDoneWithDescendants } = require("./taskService");
const { TrelloClient, isTrelloConfigured } = require("../integrations/trello/trelloClient");

const TRELLO_PROVIDER = "trello";

function buildCardName(task) {
  return `[${task.id}] ${task.title}`;
}

function buildCardDescription(task) {
  const lines = [
    `Wakeupcall Task ID: ${task.id}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Window Start (UTC): ${task.nudgeWindowStart ? task.nudgeWindowStart.toISOString() : "none"}`,
    `Window End (UTC): ${task.nudgeWindowEnd ? task.nudgeWindowEnd.toISOString() : "open-ended"}`,
    "",
    "Nudge Text:",
    task.nudgeText || ""
  ];
  if (task.memoryContext) {
    lines.push("", "Context:", task.memoryContext);
  }
  return lines.join("\n");
}

async function syncTasksToTrello(trelloConfig) {
  if (!isTrelloConfigured(trelloConfig)) {
    return {
      skipped: true,
      reason: "Trello env vars not configured."
    };
  }

  const client = new TrelloClient(trelloConfig);
  const now = new Date();
  const pullResult = await pullTaskStatusFromTrello({ trelloConfig, client, now });
  const pushResult = await pushTasksToTrello({ client, now });

  return {
    skipped: false,
    pull: pullResult,
    push: pushResult
  };
}

async function pushTasksToTrello({ client, now }) {
  const linkedTaskIds = await TaskIntegration.findAll({
    where: { provider: TRELLO_PROVIDER },
    attributes: ["taskId"]
  });
  const linkedIdSet = new Set(linkedTaskIds.map((row) => row.taskId));

  const unsyncedTasks = await Task.findAll({
    where: {
      parentTaskId: null,
      status: {
        [Op.ne]: "archived"
      },
      id: {
        [Op.notIn]: linkedIdSet.size > 0 ? [...linkedIdSet] : [0]
      }
    },
    order: [["id", "ASC"]]
  });

  let createdCount = 0;
  for (const task of unsyncedTasks) {
    const card = await client.createCard({
      name: buildCardName(task),
      desc: buildCardDescription(task),
      due: task.nudgeWindowEnd ? task.nudgeWindowEnd.toISOString() : null
    });

    await TaskIntegration.create({
      taskId: task.id,
      provider: TRELLO_PROVIDER,
      externalId: card.id,
      externalPayloadJson: JSON.stringify({
        id: card.id,
        idList: card.idList,
        shortUrl: card.shortUrl || null
      }),
      lastSyncedAt: now
    });
    createdCount += 1;
  }

  return {
    createdCount
  };
}

async function pullTaskStatusFromTrello({ trelloConfig, client, now }) {
  const linkedPending = await TaskIntegration.findAll({
    where: {
      provider: TRELLO_PROVIDER
    },
    include: [
      {
        model: Task,
        as: "task",
        required: true,
        where: {
          parentTaskId: null,
          status: {
            [Op.notIn]: ["done", "archived"]
          }
        },
        attributes: ["id", "status"]
      }
    ]
  });

  let checkedCount = 0;
  let doneUpdatedCount = 0;
  let missingCardCount = 0;

  if (linkedPending.length > 0) {
    const cards = await client.listBoardCards();
    const cardById = new Map(cards.map((card) => [card.id, card]));

    for (const integration of linkedPending) {
      checkedCount += 1;
      const card = cardById.get(integration.externalId);
      if (!card) {
        missingCardCount += 1;
        continue;
      }

      const movedToDone = card.closed || card.idList === trelloConfig.doneListId;
      if (movedToDone) {
        const result = await markTaskDoneWithDescendants(integration.taskId);
        if (result.updatedCount > 0) {
          doneUpdatedCount += 1;
        }
      }

      integration.lastSyncedAt = now;
      await integration.save();
    }
  }

  return {
    checkedCount,
    doneUpdatedCount,
    missingCardCount
  };
}

async function pullTaskStatusFromTrelloConfigured(trelloConfig) {
  if (!isTrelloConfigured(trelloConfig)) {
    return {
      skipped: true,
      reason: "Trello env vars not configured."
    };
  }
  const client = new TrelloClient(trelloConfig);
  const now = new Date();
  const result = await pullTaskStatusFromTrello({ trelloConfig, client, now });
  return { skipped: false, ...result };
}

async function pushTasksToTrelloConfigured(trelloConfig) {
  if (!isTrelloConfigured(trelloConfig)) {
    return {
      skipped: true,
      reason: "Trello env vars not configured."
    };
  }
  const client = new TrelloClient(trelloConfig);
  const now = new Date();
  const result = await pushTasksToTrello({ client, now });
  return { skipped: false, ...result };
}

module.exports = {
  syncTasksToTrello,
  pullTaskStatusFromTrelloConfigured,
  pushTasksToTrelloConfigured
};
