'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const validationData = (data) => {
  strapi.log.debug({ data }, 'Validation Data for Course: ');
  const { is_template } = data;
  if (is_template && !data?.name) {
    throw strapi.errors.badRequest('La propiedad Nombre es obligatoria');
  }
  if (is_template && !data?.short_name) {
    throw strapi.errors.badRequest('La propiedad Nombre corto es obligatoria');
  }
  if (is_template && !data?.description) {
    throw strapi.errors.badRequest('La propiedad Descripción es obligatoria');
  }
  if (is_template && !data?.slug) {
    throw strapi.errors.badRequest('La propiedad Slug es obligatoria');
  }
  if (is_template && !data?.order) {
    throw strapi.errors.badRequest('La propiedad Orden es obligatoria');
  }
  if (is_template && data?.course_template) {
    throw strapi.errors.badRequest('Una plantilla, no puede estar relacionada con otra plantilla');
  }
  if (is_template && !data?.category) {
    throw strapi.errors.badRequest('El curso deberá estar relacionado con una categoria');
  }
  if (is_template && !data?.active) {
    throw strapi.errors.badRequest('La propiedad active es obligatoria');
  }
  if (!is_template && !data?.course_template) {
    throw strapi.errors.badRequest('El curso deberá estar relacionado con una plantilla');
  }
};

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      validationData(data);
      const { is_template } = data;
      if (!is_template) {
        const courseData = await strapi.services.courses.findOne({ id: data?.course_template });
        (data.name = courseData?.name),
        (data.short_name = courseData?.short_name),
        (data.description = courseData?.description),
        (data.order = courseData?.order),
        data.category = courseData?.category,
        data.active = true,
        data.cover = courseData?.cover;
      }
    },
    async afterCreate(data, params) {
      if (!params?.is_template) {
        await strapi.services.courses.update({ id: data?.id }, { slug: `${data?.course_template?.slug}-${data?.id}` });
      }
    },
  },
};
