const { sequelize } = require("./sequelize");
const { createUmzug } = require("./umzug");
const logger = require("../utils/logger");

async function runMigrations() {
  const umzug = createUmzug();

  try {
    await sequelize.authenticate();
    const migrations = await umzug.up();
    const names = migrations.map((migration) => migration.name);
    logger.info(`Migrations complete. Applied: ${names.length}`);
    if (names.length > 0) {
      logger.info("Applied migration names", names);
    }
  } finally {
    await sequelize.close();
  }
}

runMigrations().catch((err) => {
  logger.error("Migration failed", err.message);
  process.exitCode = 1;
});
