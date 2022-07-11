'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const { isEmpty } = require('lodash');
const lodash = require('lodash');

const validationData = (data) => {
  strapi.log.debug({ data }, 'Validation Data for Products: ');
  const { name, price_in_cents, courses, price_id, product_id, expires_in, slug } = data;
  if (isEmpty(courses)) {
    throw strapi.errors.badRequest('Se debe seleccionar al menos un curso para el producto');
  }
  if (!name) {
    throw strapi.errors.badRequest('El nombre del producto es obligatorio');
  }
  if (!price_id) {
    throw strapi.errors.badRequest('El ID del precio de Stripe es obligatorio');
  }
  if (!product_id) {
    throw strapi.errors.badRequest('El ID del producto de Stripe es obligatorio');
  }
  if (price_in_cents <= 0) {
    throw strapi.errors.badRequest('El precio en centavos debe ser un valor válido mayor a cero');
  }
  if (!slug) {
    throw strapi.errors.badRequest('El slug del producto es obligatorio');
  }
  if (expires_in <= 0) {
    throw strapi.errors.badRequest('El tiempo de expiración debe ser un valor válido mayor a cero');
  }
};

const trimParamsValidation = async (data) => {
  // Trim all the params after verifying there are present
  data.name = data.name?.trim?.();
  data.price_id = data?.price_id?.trim?.();
  data.product_id = data?.product_id?.trim?.();
};

const deleteCoursesFromUserCourses = async (params, data) => {
  const { id } = params;
  const { courses } = data;
  strapi.log.info({ id }, 'delete permissons where delete courses in the collection product');
  const productData = await strapi.services.products.findOne({ id: id });
  const idPrevius = productData?.courses.map((res) => res.id);
  const diferrenteCourses = lodash.difference(idPrevius, courses);
  if (diferrenteCourses.length > 0) {
    const result = await strapi.services['user-purchases'].find({
      _where: [{ product: id }, { payment_status: 'paid' }],
    });
    if (!isEmpty(result)) {
      for (const purchase of result) {
        for (const course of diferrenteCourses) {
          strapi.log.debug(
            `Delete course id: ${course} from user: ${purchase?.user?.email} where payment status purchase be equal to paid`
          );
          await strapi.query('user-courses').delete({ user_id: purchase?.user?.id, course_id: course, cohort_id: null });
        }
      }
    }
  }
};

const updateUserPurchases = async (params, data) => {
  const { id } = params;
  const { update_by } = data;
  strapi.log.info(`updating collection user-purchases where product_id = ${id}`);
  const result = await strapi.services['user-purchases'].find({
    _where: [{ product: id }, { payment_status: 'paid' }],
  });
  if (!isEmpty(result)) {
    for (const purchase of result) {
      await strapi.services['user-purchases'].update({ id: purchase.id }, { update_by: update_by });
    }
  }
};

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      validationData(data);
      trimParamsValidation(data);
    },
    async beforeUpdate(params, data) {
      validationData(data);
      trimParamsValidation(data);
      deleteCoursesFromUserCourses(params, data);
    },
    async afterUpdate(params, data) {
      updateUserPurchases(params, data);
    },
    async beforeDelete(params) {
      const { id } = params;
      const result = await strapi.services['user-purchases'].find({
        _where: [{ product: id }, { payment_status: 'paid' }],
      });
      if (!isEmpty(result)) {
        throw strapi.errors.badRequest(
          'No se puede realizar el evento de borrar, ya que este producto se encuentra relacionado con una compra de usuario'
        );
      }
    },
  },
};
