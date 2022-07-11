'use strict';
const { isEmpty } = require('lodash');
const lodash = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const createGrantPermissions = async (data) => {
  const { id, lessons } = data;
  let references;
  if (!isEmpty(lessons)) {
    for (const lesson of lessons) {
      if (!lesson?.content?.includes(`<Task id="${id}"/>`)) {
        const content = lesson?.content + `\n<Task id="${id}"/>`;
        if (!lesson.references) {
          references = {
            evaluations: [],
            tasks: [id],
          };
        } else {
          references = lesson.references;
          references.tasks = [].concat(lesson.references.tasks, id);
        }
        await strapi.services.lessons.update({ id: lesson?.id }, { content: content, references: references });
      }
    }
  }
};

const validateRelationLesson = async (params, data) => {
  const { id } = params;
  const { lessons } = data;
  const previusData = await strapi.services.task.findOne({ id: id });
  await removePermissions(previusData, lessons, id);
  await grantPermissions(previusData, lessons, id);
};

const removePermissions = async (previusData, lessons, taskId) => {
  const idPreviusData = previusData?.lessons.map((res) => res.id);
  const removePermissions = lodash.difference(idPreviusData, lessons);
  for (const lessonRemove of removePermissions) {
    for (const lesson of previusData?.lessons) {
      if (lesson?.id == lessonRemove) {
        const deleteContent = `\\n<Task id=\\"${taskId}\\"\\/>`;
        const regex = new RegExp(deleteContent, 'g');
        const content = lesson.content.replace(regex, '');
        lesson.references.tasks = lesson.references.tasks.filter((task) => task !== taskId);
        await strapi.services.lessons.update({ id: lesson?.id }, { content: content, references: lesson.references });
      }
    }
  }
};

const grantPermissions = async (previusData, lessons, taskId) => {
  const idPreviusData = previusData?.lessons.map((res) => res.id);
  const grantPermissions = lodash.difference(lessons, idPreviusData);
  let references;
  for (const lessonRemove of grantPermissions) {
    const result = await strapi.services.lessons.findOne({ id: lessonRemove });
    if (!result?.content?.includes(`<Task id="${taskId}"/>`)) {
      const content = result?.content + `\n<Task id="${taskId}"/>`;
      if (!result.references) {
        references = {
          evaluations: [],
          tasks: [taskId],
        };
      } else {
        references = result.references;
        references.tasks = [].concat(result.references.tasks, taskId);
      }
      await strapi.services.lessons.update({ id: lessonRemove }, { content: content, references: references });
    }
  }
};

module.exports = {
  lifecycles: {
    async afterCreate(data) {
      createGrantPermissions(data);
    },
    async beforeUpdate(params, data) {
      await validateRelationLesson(params, data);
    },
  },
};
