const { DataTypes } = require("sequelize");

module.exports = {
  up: async ({ context: queryInterface }) => {
    await queryInterface.createTable("task_integrations", {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      task_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "tasks",
          key: "id"
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      provider: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      external_id: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
      external_payload_json: {
        type: DataTypes.TEXT("long"),
        allowNull: true
      },
      last_synced_at: {
        type: DataTypes.DATE,
        allowNull: true
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

    await queryInterface.addConstraint("task_integrations", {
      type: "unique",
      fields: ["provider", "external_id"],
      name: "uq_task_integrations_provider_external_id"
    });

    await queryInterface.addConstraint("task_integrations", {
      type: "unique",
      fields: ["task_id", "provider"],
      name: "uq_task_integrations_task_provider"
    });

    await queryInterface.addIndex("task_integrations", ["task_id"]);
    await queryInterface.addIndex("task_integrations", ["provider"]);
    await queryInterface.addIndex("task_integrations", ["last_synced_at"]);
  },
  down: async ({ context: queryInterface }) => {
    await queryInterface.dropTable("task_integrations");
  }
};
