const { DataTypes } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.addColumn("tasks", "category", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addIndex("tasks", ["category"]);
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.removeIndex("tasks", ["category"]);
    await queryInterface.removeColumn("tasks", "category");
  }
};
