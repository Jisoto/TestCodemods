'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
  find: async(ctx) => {
    const { courseSlug, cohort } = ctx;
    const course = await strapi.services.courses.findOne({ slug: courseSlug });
    const entity = await strapi
      .query('user-evaluations')
      .model.query((db) => {
        db.where('curso', '=', course.id);
        if (cohort) {
          db.where('cohort', '=', cohort);
        } else {
          db.whereNull('cohort');
        }
      })
      .fetchAll();

    return entity.toJSON();
  },
};
