module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE tasks MODIFY COLUMN category VARCHAR(64) NULL AFTER parent_task_id"
    );
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE tasks MODIFY COLUMN category VARCHAR(64) NULL AFTER updated_at"
    );
  }
};
