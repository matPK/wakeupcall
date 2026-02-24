function parseIncomingCommand(text) {
  const content = String(text || "").trim();
  if (!content) {
    return null;
  }

  if (/^help$/i.test(content)) {
    return { type: "help" };
  }
  if (/^list$/i.test(content)) {
    return { type: "list" };
  }

  const doneMatch = /^done:\s*(\d+)\s*$/i.exec(content);
  if (doneMatch) {
    return { type: "done", taskId: Number(doneMatch[1]) };
  }

  const explainMatch = /^explain:\s*(\d+)\s*$/i.exec(content);
  if (explainMatch) {
    return { type: "explain", taskId: Number(explainMatch[1]) };
  }

  const nudgeMatch = /^nudge:\s+(.+)$/i.exec(content);
  if (nudgeMatch) {
    return { type: "nudge", text: nudgeMatch[1].trim() };
  }

  const snoozeMatch = /^snooze:\s*(\d+)\s+(.+)$/i.exec(content);
  if (snoozeMatch) {
    return {
      type: "snooze",
      taskId: Number(snoozeMatch[1]),
      text: snoozeMatch[2].trim()
    };
  }

  const configMatch = /^config:\s+(.+)$/i.exec(content);
  if (configMatch) {
    return { type: "config", text: configMatch[1].trim() };
  }

  return null;
}

module.exports = { parseIncomingCommand };
