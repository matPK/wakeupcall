const { Op } = require("sequelize");
const { sequelize, Task } = require("../db/models");
const { parseIsoToDate, nowUtc, isNowWithinWindow, toDateTimeUtc, addMinutes } = require("../utils/time");

function normalizeTaskTitle(inputText) {
  const raw = String(inputText || "")
    .replace(/\{\{\s*id\s*\}\}/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (raw || "Untitled task").slice(0, 255);
}

function normalizeNudgeText(inputText, id, title) {
  const base = String(inputText || "").trim().replace(/\{\{\s*id\s*\}\}/gi, String(id));
  const fallback = `Nudge [${id}]: ${title}. Reply: done: ${id} | snooze: ${id} 2h`;
  if (!base) {
    return fallback;
  }

  const hasIdTag = base.includes(`[${id}]`) || base.includes(` ${id}`);
  const hasHints = /done:\s*\d+/i.test(base) && /snooze:\s*\d+/i.test(base);
  const withId = hasIdTag ? base : `Nudge [${id}]: ${base}`;
  return hasHints ? withId : `${withId}. Reply: done: ${id} | snooze: ${id} 2h`;
}

function buildChildLinkMap(links) {
  const map = new Map();
  for (const link of links || []) {
    if (typeof link.child_index === "number" && typeof link.parent_ref === "string") {
      map.set(link.child_index, link.parent_ref);
    }
  }
  return map;
}

function normalizeMemoryContext(input) {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) {
    return null;
  }

  if (/^(none|null|n\/a|self[- ]?explanatory|self explanatory)$/i.test(text)) {
    return null;
  }

  const looksLikeCategoryToken =
    !text.includes("\n") && text.split(/\s+/).length <= 3 && /^[a-z0-9_-]+$/i.test(text);
  if (looksLikeCategoryToken) {
    return null;
  }

  return text.slice(0, 1200);
}

function normalizeCategory(input) {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) {
    return null;
  }

  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  if (!slug) {
    return null;
  }
  return slug;
}

function withSourceUserFilter(where, sourceUserId) {
  if (!sourceUserId) {
    return where;
  }
  return {
    ...where,
    sourceUserId
  };
}

async function createTasksFromCompilerOutput(output, messageContext) {
  const tasks = output.tasks || [];
  const linksMap = buildChildLinkMap(output.links || []);
  const childIndexes = new Set([...linksMap.keys()]);
  const refToId = new Map();
  const unresolved = [];
  const created = [];
  const now = nowUtc().toJSDate();

  await sequelize.transaction(async (transaction) => {
    for (let i = 0; i < tasks.length; i += 1) {
      const t = tasks[i];
      const linkedParentRef = linksMap.get(i) || null;
      const canResolveParent = linkedParentRef ? refToId.has(linkedParentRef) : true;
      const isParentDeclaration = t.parent_ref && !childIndexes.has(i);

      if (!canResolveParent && !isParentDeclaration) {
        unresolved.push({ index: i, task: t });
        continue;
      }

      const createdTask = await createSingleTask({
        taskInput: t,
        parentTaskId: linkedParentRef ? refToId.get(linkedParentRef) : null,
        now,
        transaction,
        messageContext
      });
      created.push(createdTask);

      if (isParentDeclaration && !refToId.has(t.parent_ref)) {
        refToId.set(t.parent_ref, createdTask.id);
      }
    }

    for (const item of unresolved) {
      const parentRef = linksMap.get(item.index) || item.task.parent_ref || null;
      const parentTaskId = parentRef && refToId.has(parentRef) ? refToId.get(parentRef) : null;
      const createdTask = await createSingleTask({
        taskInput: item.task,
        parentTaskId,
        now,
        transaction,
        messageContext
      });
      created.push(createdTask);
    }
  });

  return created;
}

async function createSingleTask({ taskInput, parentTaskId, now, transaction, messageContext }) {
  const startDate = parseIsoToDate(taskInput.nudge_window_start) || now;
  const endDate = taskInput.nudge_window_end ? parseIsoToDate(taskInput.nudge_window_end) : null;

  const createdTask = await Task.create(
    {
      parentTaskId,
      title: normalizeTaskTitle(taskInput.title),
      status: "pending",
      priority: Number.isFinite(taskInput.priority) ? Math.trunc(taskInput.priority) : 0,
      nudgeWindowStart: startDate,
      nudgeWindowEnd: endDate,
      nudgeText: taskInput.nudge_text || "",
      memoryContext: normalizeMemoryContext(taskInput.memory_context),
      category: normalizeCategory(taskInput.category),
      source: "discord",
      sourceMessageId: messageContext.messageId || null,
      sourceChannelId: messageContext.channelId || null,
      sourceUserId: messageContext.authorId || null
    },
    { transaction }
  );

  const finalNudgeText = normalizeNudgeText(taskInput.nudge_text, createdTask.id, createdTask.title);
  if (finalNudgeText !== createdTask.nudgeText) {
    createdTask.nudgeText = finalNudgeText;
    await createdTask.save({ transaction });
  }

  return createdTask;
}

async function listPendingTopLevelTasks(sourceUserId, limit = 30) {
  return Task.findAll({
    where: withSourceUserFilter(
      {
        status: "pending",
        parentTaskId: null
      },
      sourceUserId
    ),
    order: [
      ["priority", "DESC"],
      ["id", "ASC"]
    ],
    limit
  });
}

async function markTaskDoneWithDescendants(taskId, sourceUserId) {
  const task = await Task.findOne({
    attributes: ["id"],
    where: withSourceUserFilter(
      {
        id: taskId
      },
      sourceUserId
    )
  });
  if (!task) {
    return { found: false, alreadyDone: false, rootWasDone: false, updatedCount: 0, ids: [] };
  }

  const idsToUpdate = await collectDescendantIds(task.id, sourceUserId);
  const rows = await Task.findAll({
    attributes: ["id", "status"],
    where: withSourceUserFilter(
      {
        id: {
          [Op.in]: idsToUpdate
        }
      },
      sourceUserId
    )
  });

  const statusById = new Map(rows.map((row) => [row.id, row.status]));
  const rootWasDone = statusById.get(task.id) === "done";
  const openIds = rows.filter((row) => row.status !== "done").map((row) => row.id);

  if (openIds.length === 0) {
    return { found: true, alreadyDone: true, rootWasDone: true, updatedCount: 0, ids: idsToUpdate };
  }

  const [updatedCount] = await Task.update(
    { status: "done" },
    {
      where: withSourceUserFilter(
        {
          id: {
            [Op.in]: openIds
          }
        },
        sourceUserId
      )
    }
  );

  return {
    found: true,
    alreadyDone: false,
    rootWasDone,
    updatedCount,
    ids: idsToUpdate
  };
}

async function collectDescendantIds(rootId, sourceUserId) {
  const ids = [rootId];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    const children = await Task.findAll({
      attributes: ["id"],
      where: withSourceUserFilter(
        {
          parentTaskId: current
        },
        sourceUserId
      )
    });
    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

async function updateTaskWindowBySnooze(taskId, snoozePayload, sourceUserId) {
  const task = await Task.findOne({
    where: withSourceUserFilter(
      {
        id: taskId
      },
      sourceUserId
    )
  });
  if (!task) {
    return null;
  }
  if (task.status !== "pending") {
    return { task, updated: false };
  }

  const now = nowUtc();
  let nextStart = task.nudgeWindowStart;
  let nextEnd = task.nudgeWindowEnd;

  if (snoozePayload && Number.isInteger(snoozePayload.minutes)) {
    const minutes = Math.max(1, snoozePayload.minutes);
    const currentDurationMinutes =
      task.nudgeWindowEnd && task.nudgeWindowStart
        ? Math.max(
            0,
            Math.round(
              toDateTimeUtc(task.nudgeWindowEnd)
                .diff(toDateTimeUtc(task.nudgeWindowStart), "minutes")
                .minutes
            )
          )
        : 0;

    nextStart = addMinutes(now, minutes);
    nextEnd = currentDurationMinutes > 0 ? addMinutes(nextStart, currentDurationMinutes) : null;
  } else {
    const start = snoozePayload && snoozePayload.new_window_start ? parseIsoToDate(snoozePayload.new_window_start) : null;
    const end = snoozePayload && snoozePayload.new_window_end ? parseIsoToDate(snoozePayload.new_window_end) : null;
    if (start) {
      nextStart = start;
    }
    nextEnd = end || null;
  }

  task.nudgeWindowStart = nextStart;
  task.nudgeWindowEnd = nextEnd;
  task.snoozeCount += 1;
  await task.save();
  return { task, updated: true };
}

async function findNudgableTasks(settings) {
  const repeatMinutes = Math.max(1, Number(settings.default_repeat_minutes || 60));
  const now = nowUtc();
  const topLevelTasks = await Task.findAll({
    where: {
      status: "pending",
      parentTaskId: null
    },
    order: [
      ["priority", "DESC"],
      ["id", "ASC"]
    ]
  });

  const eligibleTopLevel = topLevelTasks.filter((task) => {
    if (!isNowWithinWindow(now, task.nudgeWindowStart, task.nudgeWindowEnd)) {
      return false;
    }

    if (task.lastNudgedAt) {
      const minutesSinceLast = now.diff(toDateTimeUtc(task.lastNudgedAt), "minutes").minutes;
      if (minutesSinceLast < repeatMinutes) {
        return false;
      }
    }

    return true;
  });

  if (eligibleTopLevel.length === 0) {
    return [];
  }

  const parentIds = eligibleTopLevel.map((task) => task.id);
  const pendingSubtasks = await Task.findAll({
    where: {
      status: "pending",
      parentTaskId: {
        [Op.in]: parentIds
      }
    },
    order: [
      ["priority", "DESC"],
      ["id", "ASC"]
    ]
  });

  const subtasksByParent = new Map();
  for (const subtask of pendingSubtasks) {
    if (!subtasksByParent.has(subtask.parentTaskId)) {
      subtasksByParent.set(subtask.parentTaskId, []);
    }
    subtasksByParent.get(subtask.parentTaskId).push(subtask);
  }

  for (const topTask of eligibleTopLevel) {
    topTask.pendingSubtasks = subtasksByParent.get(topTask.id) || [];
  }

  return eligibleTopLevel;
}

async function markTaskNudged(taskId) {
  await Task.increment("nudgeCount", { by: 1, where: { id: taskId } });
  await Task.update({ lastNudgedAt: new Date() }, { where: { id: taskId } });
}

async function getPendingTaskById(taskId, sourceUserId) {
  return Task.findOne({
    where: withSourceUserFilter(
      {
        id: taskId,
        status: "pending"
      },
      sourceUserId
    )
  });
}

async function getTaskById(taskId, sourceUserId) {
  return Task.findOne({
    where: withSourceUserFilter(
      {
        id: taskId
      },
      sourceUserId
    )
  });
}

module.exports = {
  createTasksFromCompilerOutput,
  listPendingTopLevelTasks,
  markTaskDoneWithDescendants,
  updateTaskWindowBySnooze,
  findNudgableTasks,
  markTaskNudged,
  getPendingTaskById,
  getTaskById
};
