'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  findUserTaskWithCourseSlug: async (ctx) => {
    const { courseSlug } = ctx.params;
    const { cohort_id } = ctx.query;
    strapi.log.debug(`find user tasks with course ${courseSlug} and cohort: ${cohort_id}`);
    let userTasks = await strapi.services['user-task'].find({ courseSlug : courseSlug, cohort: cohort_id });
    for (let userTask of userTasks) {
      const task = await strapi.query('task').findOne({ id: userTask.task_id });
      userTask.task = task;
    }

    let userTasksActive = [];

    for (let userTask of userTasks) {
      const userCourse = await strapi
        .query('user-courses')
        .findOne({ course_id: userTask.curso.id, user_id: userTask.user.id, cohort_id: cohort_id });
      if (userCourse?.active) {
        userTasksActive.push(userTask);
      }
    }

    return userTasksActive;
  },

  findOne: async (ctx) => {
    strapi.log.debug(`find task for user-task ${ctx.state.user.email}`);
    let { lesson, course, cohort, task_id } = ctx.query;
    const result = await strapi.services['user-task'].findOne({
      task_id: task_id,
      clase: lesson,
      curso: course,
      user: ctx.state.user.id,
      cohort: cohort,
    });
    if (!result) {
      return { file_delivered: [] };
    }
    return result;
  },

  findOneOrCreate: async (ctx) => {
    const { file_delivered, id, lesson, course, cohort } = ctx.request.body;
    let result = await strapi.services['user-task'].findOne({
      task_id: id,
      clase: lesson,
      curso: course,
      user: ctx.state.user.id,
      cohort: cohort,
    });
    if (!result) {
      result = await strapi.services['user-task'].create({
        qualified: false,
        score: 1,
        presentation_time: new Date(),
        user: ctx.state.user.id,
        clase: lesson,
        curso: course,
        task_id: id,
        cohort: cohort,
        file_delivered: file_delivered,
      });
    } else {
      await strapi.services['user-task'].update(
        { id: result.id },
        { presentation_time: new Date(), file_delivered: file_delivered }
      );
    }
    return result;
  },
};
