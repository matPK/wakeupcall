const path = require("path");
const { Umzug, SequelizeStorage } = require("umzug");
const { sequelize } = require("./sequelize");

function createUmzug() {
  // Umzug's glob matching is path-style sensitive on Windows.
  const migrationsGlob = path.resolve(__dirname, "migrations", "*.js").replace(/\\/g, "/");

  return new Umzug({
    migrations: {
      glob: migrationsGlob
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: undefined
  });
}

module.exports = { createUmzug };
