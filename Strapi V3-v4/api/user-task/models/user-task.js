'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeUpdate(params, data) {
      const userTaskData = await strapi.services['user-task'].findOne({ id: params.id });
      const { file_delivered } = userTaskData;
      const taskData = await strapi.services.task.findOne({ id: userTaskData.task_id });
      const { task_finish_date } = taskData;
      const imageID = data?.file_delivered[0]?.id ?? parseInt(data?.file_delivered);
      const qualified = data?.qualified ?? userTaskData?.qualified;
      if (qualified && file_delivered[0].id != imageID) {
        throw strapi.errors.badRequest('La tarea ya se encuentra calificada, no se aceptan modificaciones');
      }
      const now = new Date().toISOString();
      if (now > task_finish_date && file_delivered[0]?.id != imageID) {
        throw strapi.errors.badRequest('El tiempo estipulado para la entrega de la tarea, ha caducado');
      }
    },
  },
};
