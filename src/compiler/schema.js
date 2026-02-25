const { z } = require("zod");

const TaskSchema = z
  .object({
    title: z.string().min(1).max(255),
    priority: z.number().int().min(-10).max(10).default(0),
    nudge_window_start: z.string(),
    nudge_window_end: z.string().nullable(),
    nudge_text: z.string(),
    memory_context: z.string().nullable().optional().default(null),
    category: z.string().nullable().default(null),
    parent_ref: z.string().nullable()
  })
  .strict();

const LinkSchema = z
  .object({
    child_index: z.number().int().min(0),
    parent_ref: z.string().min(1)
  })
  .strict();

const TaskSelectorSchema = z
  .object({
    by: z.enum(["id", "latest", "title"]),
    value: z.string()
  })
  .strict();

const SnoozeSchema = z.union([
  z
    .object({
      minutes: z.number().int().min(1)
    })
    .strict(),
  z
    .object({
      new_window_start: z.string(),
      new_window_end: z.string().nullable()
    })
    .strict()
]);

const ConfigItemSchema = z
  .object({
    key: z.string().min(1),
    value: z.string()
  })
  .strict();

const CompilerOutputSchema = z
  .object({
    version: z.literal(1),
    intent: z.enum(["create", "snooze", "complete", "list", "config", "clarify"]),
    tasks: z.array(TaskSchema).default([]),
    links: z.array(LinkSchema).default([]),
    task_selector: TaskSelectorSchema.nullable().default(null),
    snooze: SnoozeSchema.nullable().default(null),
    config: z.array(ConfigItemSchema).default([]),
    clarify_question: z.string().nullable().default(null)
  })
  .strict();

const COMPILER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "integer", enum: [1] },
    intent: {
      type: "string",
      enum: ["create", "snooze", "complete", "list", "config", "clarify"]
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 1, maxLength: 255 },
          priority: { type: "integer", minimum: -10, maximum: 10 },
          nudge_window_start: { type: "string" },
          nudge_window_end: { anyOf: [{ type: "string" }, { type: "null" }] },
          nudge_text: { type: "string" },
          memory_context: { anyOf: [{ type: "string" }, { type: "null" }] },
          category: { anyOf: [{ type: "string" }, { type: "null" }] },
          parent_ref: { anyOf: [{ type: "string" }, { type: "null" }] }
        },
        required: [
          "title",
          "priority",
          "nudge_window_start",
          "nudge_window_end",
          "nudge_text",
          "category",
          "parent_ref"
        ]
      }
    },
    links: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          child_index: { type: "integer", minimum: 0 },
          parent_ref: { type: "string", minLength: 1 }
        },
        required: ["child_index", "parent_ref"]
      }
    },
    task_selector: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            by: { type: "string", enum: ["id", "latest", "title"] },
            value: { type: "string" }
          },
          required: ["by", "value"]
        },
        { type: "null" }
      ]
    },
    snooze: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            minutes: { type: "integer", minimum: 1 }
          },
          required: ["minutes"]
        },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            new_window_start: { type: "string" },
            new_window_end: { anyOf: [{ type: "string" }, { type: "null" }] }
          },
          required: ["new_window_start", "new_window_end"]
        },
        { type: "null" }
      ]
    },
    config: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", minLength: 1 },
          value: { type: "string" }
        },
        required: ["key", "value"]
      }
    },
    clarify_question: { anyOf: [{ type: "string" }, { type: "null" }] }
  },
  required: ["version", "intent", "tasks", "links", "task_selector", "snooze", "config", "clarify_question"]
};

module.exports = {
  CompilerOutputSchema,
  COMPILER_JSON_SCHEMA
};
