const { DataTypes } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable("tasks", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      parent_task_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "tasks",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
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
      nudge_window_start: {
        type: DataTypes.DATE,
        allowNull: false
      },
      nudge_window_end: {
        type: DataTypes.DATE,
        allowNull: true
      },
      nudge_text: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      memory_context: {
        type: DataTypes.TEXT("long"),
        allowNull: true
      },
      source: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "discord"
      },
      source_message_id: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      source_channel_id: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      source_user_id: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      last_nudged_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      nudge_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      snooze_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("tasks", ["status"]);
    await queryInterface.addIndex("tasks", ["parent_task_id"]);
    await queryInterface.addIndex("tasks", ["nudge_window_start"]);
    await queryInterface.addIndex("tasks", ["last_nudged_at"]);
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable("tasks");
  }
};
