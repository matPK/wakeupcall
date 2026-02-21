module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(
      "INSERT INTO settings (`key`, `value`) SELECT 'nudge_mode', 'single' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM settings WHERE `key` = 'nudge_mode')"
    );
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query("DELETE FROM settings WHERE `key` = 'nudge_mode'");
  }
};
