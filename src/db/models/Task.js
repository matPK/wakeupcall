const { DataTypes, Model } = require("sequelize");

class Task extends Model {}

function initTask(sequelize) {
  Task.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      parentTaskId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "parent_task_id"
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "pending"
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      nudgeWindowStart: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "nudge_window_start"
      },
      nudgeWindowEnd: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "nudge_window_end"
      },
      nudgeText: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "nudge_text"
      },
      memoryContext: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        field: "memory_context"
      },
      source: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "discord"
      },
      sourceMessageId: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: "source_message_id"
      },
      sourceChannelId: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: "source_channel_id"
      },
      sourceUserId: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: "source_user_id"
      },
      lastNudgedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_nudged_at"
      },
      nudgeCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "nudge_count"
      },
      snoozeCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "snooze_count"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at"
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at"
      }
    },
    {
      sequelize,
      modelName: "Task",
      tableName: "tasks"
    }
  );

  return Task;
}

function associateTask(TaskModel) {
  TaskModel.belongsTo(TaskModel, {
    as: "parent",
    foreignKey: "parentTaskId",
    onDelete: "CASCADE"
  });
  TaskModel.hasMany(TaskModel, {
    as: "children",
    foreignKey: "parentTaskId",
    onDelete: "CASCADE"
  });
}

module.exports = { Task, initTask, associateTask };
