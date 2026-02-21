const { DataTypes, Model } = require("sequelize");

class TaskIntegration extends Model {}

function initTaskIntegration(sequelize) {
  TaskIntegration.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      taskId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "task_id"
      },
      provider: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      externalId: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: "external_id"
      },
      externalPayloadJson: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        field: "external_payload_json"
      },
      lastSyncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "last_synced_at"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at"
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at"
      }
    },
    {
      sequelize,
      modelName: "TaskIntegration",
      tableName: "task_integrations"
    }
  );

  return TaskIntegration;
}

function associateTaskIntegration(TaskIntegrationModel, TaskModel) {
  TaskIntegrationModel.belongsTo(TaskModel, {
    as: "task",
    foreignKey: "taskId",
    onDelete: "CASCADE"
  });
  TaskModel.hasMany(TaskIntegrationModel, {
    as: "integrations",
    foreignKey: "taskId",
    onDelete: "CASCADE"
  });
}

module.exports = { TaskIntegration, initTaskIntegration, associateTaskIntegration };
