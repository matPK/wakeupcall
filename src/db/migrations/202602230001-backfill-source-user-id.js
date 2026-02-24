const { DataTypes } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    const table = await queryInterface.describeTable("tasks");
    if (!table.source_user_id) {
      await queryInterface.addColumn("tasks", "source_user_id", {
        type: DataTypes.STRING(64),
        allowNull: true
      });
      await queryInterface.addIndex("tasks", ["source_user_id"]);
    }

    const ownerId = process.env.DISCORD_OWNER_ID;
    if (!ownerId) {
      throw new Error("DISCORD_OWNER_ID is required to backfill existing tasks.source_user_id");
    }

    await queryInterface.sequelize.query("UPDATE tasks SET source_user_id = :ownerId WHERE source_user_id IS NULL", {
      replacements: { ownerId }
    });
  },
  down: async () => {
    // Intentionally no-op: backfill should not erase user ownership history.
  }
};
