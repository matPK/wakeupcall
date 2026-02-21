const { sequelize } = require("./sequelize");
const { createUmzug } = require("./umzug");
const logger = require("../utils/logger");

function parseArgs(argv) {
  const args = argv.slice(2);
  const all = args.includes("--all");
  const toIndex = args.indexOf("--to");
  const to = toIndex >= 0 ? args[toIndex + 1] : null;
  return { all, to };
}

async function runMigrationDown() {
  const { all, to } = parseArgs(process.argv);
  const umzug = createUmzug();

  try {
    await sequelize.authenticate();

    let reverted;
    if (all) {
      reverted = await umzug.down({ to: 0 });
    } else if (to) {
      reverted = await umzug.down({ to });
    } else {
      reverted = await umzug.down();
    }

    const names = reverted.map((migration) => migration.name);
    logger.info(`Rollback complete. Reverted: ${names.length}`);
    if (names.length > 0) {
      logger.info("Reverted migration names", names);
    }
  } finally {
    await sequelize.close();
  }
}

runMigrationDown().catch((err) => {
  logger.error("Rollback failed", err.message);
  process.exitCode = 1;
});
