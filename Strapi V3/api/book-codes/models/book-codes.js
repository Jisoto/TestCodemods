'use strict';

/**
 * Lifecycle callbacks for the `book-codes` model.
 */

const registerUserCourse = async (params, data) => {
  const { activated_by } = data;
  const bookCodes = await strapi.services['book-codes'].findOne({ id: params.id });
  const slug = await strapi.services['book-codes'].getSlugCourse({grade: bookCodes.grade});
  let currentDate = new Date();
  strapi.log.debug(
    `Register data:{user: ${activated_by}, courseSlug: ${slug} and course sotware} with book code id=${params.id} after create`
  );
  const course = await strapi.services.courses.findOne({ slug: slug });
  const courseRegisters = [course.id, 15];
  for (const courseRegister of courseRegisters) {
    await strapi.services['user-courses'].create(
      {
        user_id: activated_by,
        course_id: courseRegister,
        expiration_date: new Date(currentDate.setMonth(currentDate.getMonth() + 11)),
      },
    );
  }
};

module.exports = {
  lifecycles: {
    async beforeUpdate(params, data) {
      await registerUserCourse(params, data);
    },
  },
};
