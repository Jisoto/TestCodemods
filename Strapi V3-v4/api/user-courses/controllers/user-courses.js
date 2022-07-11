'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  findMyCourses: async (ctx) => {
    const { user } = ctx.state;
    strapi.log.info(`find my courses for the user: ${user.email}`);
    const userCourses = await strapi.query('user-courses').find({ _where: [{ user_id: user.id, active: true, 'course_id.active': true }], _sort: 'course_id.order:ASC'});

    //Delete duplicate task records
    let userCoursesFilter = userCourses.filter((currentValue, currentIndex, task) => {
      return task.findIndex((arrayValue) => JSON.stringify(arrayValue.course_id.id) === JSON.stringify(currentValue.course_id.id)
             && JSON.stringify(arrayValue.cohort_id?.id) === JSON.stringify(currentValue.cohort_id?.id)) === currentIndex;
    });

    return userCoursesFilter;
  },
  findOne: async (ctx) => {
    const { courseSlug } = ctx.params;
    strapi.log.debug(`find course: ${courseSlug}, and user: ${ctx.state.user.email} in the collection user-courses`);
    const courseData = await strapi.services.courses.findOne({ slug: courseSlug });
    return strapi
      .query('user-courses')
      .findOne({ user_id: ctx.state.user.id, course_id: courseData.id, active: true }, ['cover']);
  },
};
