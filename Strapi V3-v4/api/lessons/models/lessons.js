'use strict';

const { isEmpty } = require('lodash');

/**
 * Lifecycle callbacks for the `lessons` model.
 */

const updateRelationWithEvaluations = async (params, data) => {
  const { id } = params;
  const { references } = data;
  if (!isEmpty(references)) {
    if (!isEmpty(references.evaluations)) {
      for (const evaluation of references.evaluations) {
        const evaluationData = await strapi.services.evaluations.findOne({ id: evaluation });
        let lessons = [];
        if (!isEmpty(evaluationData?.lessons)) {
          lessons = evaluationData.lessons.map((lesson) => lesson.id);
          if (!lessons.includes(id)) {
            lessons.push(id);
          }
        } else {
          lessons.push(id);
        }
        await strapi.services.evaluations.update({ id: evaluation }, { lessons: lessons });
      }
    }
  }
};

const updateRelationWithTasks = async (params, data) => {
  const { id } = params;
  const { references } = data;
  if (!isEmpty(references)) {
    if (!isEmpty(references.tasks)) {
      for (const task of references.tasks) {
        const taskData = await strapi.services.task.findOne({ id: task });
        let lessons = [];
        if (!isEmpty(taskData?.lessons)) {
          lessons = taskData.lessons.map((lesson) => lesson.id);
          if (!lessons.includes(id)) {
            lessons.push(id);
          }
        } else {
          lessons.push(id);
        }
        await strapi.services.task.update({ id: task }, { lessons: lessons });
      }
    }
  }
};

module.exports = {
  lifecycles: {
    async beforeUpdate(params, data) {
      if (data?.update) {
        await updateRelationWithEvaluations(params, data);
        await updateRelationWithTasks(params, data);
      }
    },
  },
};
