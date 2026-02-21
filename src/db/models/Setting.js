const { DataTypes, Model } = require("sequelize");

class Setting extends Model {}

function initSetting(sequelize) {
  Setting.init(
    {
      key: {
        type: DataTypes.STRING(64),
        primaryKey: true,
        allowNull: false
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "Setting",
      tableName: "settings",
      timestamps: false
    }
  );

  return Setting;
}

module.exports = { Setting, initSetting };
