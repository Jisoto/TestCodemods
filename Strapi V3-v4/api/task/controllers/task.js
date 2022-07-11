'use strict';

const { isEmpty } = require('lodash');
const { sanitizeEntity } = require('strapi-utils');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  deleteTaskRelationWithCourse: async (ctx) => {
    const { courseSlug } = ctx.params;
    const { task_id } = ctx.request.body;
    const tasksDelete = await strapi.services.lessons.find({ 'course_id.slug': courseSlug });
    const idTasksDelete = tasksDelete.map((lesson) => lesson.id);
    const lessonsTasks = await strapi.services.task.findOne({ id: task_id });
    const idLessonsTasks = lessonsTasks.lessons.map((lesson) => lesson.id);
    const lessons = idLessonsTasks.filter((lesson) => !idTasksDelete.includes(lesson));
    await strapi.services.task.update({ id: task_id }, { lessons: lessons });
    return lessons;
  },

  findMyTasks: async (ctx) => {
    strapi.log.debug({ reqId: ctx.state.reqId }, `Buscar las evaluaciones del usuario: : '${ctx.state?.user.email}'`);
    const tasks = await strapi.services.task.find({  _where: [{ _or: [{ user_created: ctx.state.user.id  }, { created_by: ctx.state.user.id }] }], _limit: -1  });
    return tasks;
  },

  findTasksByCourse: async (ctx) => {
    const { courseSlug } = ctx.params;
    const courseFound = await strapi
      .query('courses')
      .model.query((qb) => {
        qb.where('slug', '=', courseSlug);
        qb.limit(1);
      })
      .fetch({
        withRelated: false,
        debug: true,
      });

    await courseFound
      .related('lessons')
      .query((qb) => {
        qb.columns('id', 'title', 'description', 'slug');
        qb.where('active', '=', true);
        qb.orderBy('order', 'asc');
      })
      .fetch();

    const result = courseFound.toJSON();
    let tasksData = [];

    for (const lesson of result?.lessons) {
      const tasks = await strapi.query('task').find({ _where: { lessons: lesson?.id } });
      if (!isEmpty(tasks)) {
        tasks.map((task) => {
          tasksData.push(task);
        });
      }
    }

    let taskData = tasksData.filter((currentValue, currentIndex, task) => {
      //Delete duplicate task records
      return task.findIndex((arrayValue) => JSON.stringify(arrayValue) === JSON.stringify(currentValue)) === currentIndex;
    });

    return taskData;
  },

  findOne: async (ctx) => {
    const { id } = ctx.params;
    const { courseSlug } = ctx.request.query;
    strapi.log.debug({ reqId: ctx.state.reqId, user: { name: ctx.state.user.id } }, `FindOne task where id = : '${id}'`);
    let result = await strapi.services.task.findOne({ id: id, active: true });

    if (!result) {
      return ctx.notFound('No se encontró la tarea solicitada o no se encuentra activa');
    }
    const { task_finish_date } = result;
    const now = new Date().toISOString();

    if (now > task_finish_date) {
      result.can_send_task = false;
    } else {
      result.can_send_task = true;
    }

    if (courseSlug !== undefined) {
      let lessonsResult = await strapi.services.lessons.find({ 'course_id.slug': courseSlug });
      const lessons = lessonsResult.map((lesson) => lesson.id);
      result.lessons.forEach((lesson) => {
        if (lessons.includes(lesson.id)) lesson.view = true;
      });
    }

    return sanitizeEntity(result, { model: strapi.models.task });
  },

  create: async (ctx) => {
    let dataCreate = ctx.request.body;
    dataCreate.user_created = ctx.state.user.id;
    const task = await strapi.services.task.create(ctx.request.body);
    return task;
  },
};
