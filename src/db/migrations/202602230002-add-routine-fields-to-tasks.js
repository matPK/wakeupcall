const { DataTypes } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.addColumn("tasks", "task_type", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "task"
    });

    await queryInterface.addColumn("tasks", "routine_repeat_hours", {
      type: DataTypes.INTEGER,
      allowNull: true
    });

    await queryInterface.addIndex("tasks", ["task_type"]);
    await queryInterface.addIndex("tasks", ["routine_repeat_hours"]);
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.removeIndex("tasks", ["routine_repeat_hours"]);
    await queryInterface.removeIndex("tasks", ["task_type"]);
    await queryInterface.removeColumn("tasks", "routine_repeat_hours");
    await queryInterface.removeColumn("tasks", "task_type");
  }
};
