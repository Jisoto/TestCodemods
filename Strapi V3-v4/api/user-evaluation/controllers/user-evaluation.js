'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  findUserEvaluationWithCourseSlug: async (ctx) => {
    const { courseSlug } = ctx.params;
    const { cohort_id } = ctx.query;
    strapi.log.debug(`find user evaluations with course ${courseSlug} and cohort: ${cohort_id}`);
    let userEvaluations = await strapi.services['user-evaluation'].find({ courseSlug : courseSlug, cohort: cohort_id });
    for (let userEvaluation of userEvaluations) {
      const evaluation = await strapi.query('evaluations').findOne({ id: userEvaluation.evaluation_id });
      userEvaluation.evaluation = evaluation;
    }

    let userEvaluationsActive = [];

    for (let userEvaluation of userEvaluations) {
      const userCourse = await strapi
        .query('user-courses')
        .findOne({ course_id: userEvaluation.course.id, user_id: userEvaluation.user_id.id, cohort_id: cohort_id });
      if (userCourse?.active) {
        userEvaluationsActive.push(userEvaluation);
      }
    }
    return userEvaluationsActive;
  },

  findByEvaluation: async (ctx) => {
    strapi.log.debug('findByEvaluation for user-evaluation started');
    const { evaluation_id, course_id, lesson_id, cohort_id } = ctx.query;
    const entity = await strapi
      .query('user-evaluation')
      .model.query((db) => {
        db.where('evaluation_id', '=', evaluation_id);
        db.where('user_id', '=', ctx.state.user.id);
        db.where('lesson', '=', lesson_id);
        db.where('course', '=', course_id);
        if (cohort_id) {
          db.where('cohort_id', '=', cohort_id);
        } else {
          db.whereNull('cohort_id');
        }
      })
      .fetch();

    if (!entity) {
      strapi.log.error(
        `No se encontró un registro para el usuario: ${ctx.state.user.email}, con la evaluación: ${evaluation_id}`
      );
      return false;
    }
    strapi.log.debug(`result of the consult: ${JSON.stringify(entity)}`);
    let data = entity.toJSON();
    data.takeExam = true;

    const evaluation = await strapi.services.evaluations.findOne({ id: data.evaluation_id });
    if (data.evaluation_result.length === evaluation.attempts) {
      data.takeExam = false;
    }
    return data;
  },
};
