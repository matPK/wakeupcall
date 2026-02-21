const { DataTypes } = require("sequelize");
const { SETTINGS_DEFAULTS } = require("../settingsDefaults");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable("settings", {
      key: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    });

    await queryInterface.bulkInsert(
      "settings",
      Object.entries(SETTINGS_DEFAULTS).map(([key, value]) => ({ key, value }))
    );
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable("settings");
  }
};
