'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
  find: async(ctx) => {
    console.log(ctx);
    const { courseSlug, cohort } = ctx;
    const course = await strapi.services.courses.findOne({ slug: courseSlug });
    const entity = await strapi
      .query('user-evaluation')
      .model.query((db) => {
        db.where('course', '=', course.id);
        if (cohort) {
          db.where('cohort_id', '=', cohort);
        } else {
          db.whereNull('cohort_id');
        }
      })
      .fetchAll();

    return entity.toJSON();
  },
};
