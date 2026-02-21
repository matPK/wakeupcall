const { sequelize } = require("../sequelize");
const { Setting, initSetting } = require("./Setting");
const { Task, initTask, associateTask } = require("./Task");
const { TaskIntegration, initTaskIntegration, associateTaskIntegration } = require("./TaskIntegration");

initSetting(sequelize);
initTask(sequelize);
initTaskIntegration(sequelize);
associateTask(Task);
associateTaskIntegration(TaskIntegration, Task);

module.exports = {
  sequelize,
  Setting,
  Task,
  TaskIntegration
};
