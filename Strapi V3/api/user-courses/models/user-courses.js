'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const validatingConstraints = (data) => {
  strapi.log.debug(`validating data for user courses, data: {id: ${data.id}, name: ${data.name}} before create`);
  const { expiration_date, user_id, course_id } = data;
  data.active = true;
  if (!expiration_date) {
    throw strapi.errors.badRequest('Un registro de curso de usuario, deberá tener una fecha de expiración');
  }
  if (!user_id) {
    throw strapi.errors.badRequest('Un registro de curso de usuario, deberá tener un usuario asignado');
  }
  if (!course_id) {
    throw strapi.errors.badRequest('Un registro de curso de usuario, deberá tener un curso asignado');
  }
};

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      validatingConstraints(data);
    },
  },
};
