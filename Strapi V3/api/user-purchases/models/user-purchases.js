'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const validationShippingAddress = (params, data) => {
  strapi.log.info(`validation shipping addres and dat for user-purchases from data: ${JSON.stringify(data)}`);
  const { has_physical_items, name, last_name, email, country, city, address, phone, proof_of_payment } = data;
  if (!name && has_physical_items) {
    throw strapi.errors.badRequest('El campo Nombre es obligatorio');
  }
  if (!last_name && has_physical_items) {
    throw strapi.errors.badRequest('El campo Apellido es obligatorio');
  }
  if (!email && has_physical_items) {
    throw strapi.errors.badRequest('El campo email es obligatorio');
  }
  if (!country && has_physical_items) {
    throw strapi.errors.badRequest('El campo País es obligatorio');
  }
  if (!city && has_physical_items) {
    throw strapi.errors.badRequest('El campo Ciudad es obligatorio');
  }
  if (!address && has_physical_items) {
    throw strapi.errors.badRequest('El campo dirección es obligatorio');
  }
  if (!phone && has_physical_items) {
    throw strapi.errors.badRequest('El campo teléfono es obligatorio');
  }
  if (proof_of_payment.length > 6) {
    throw strapi.errors.badRequest('La cantidad máxima establecida para los comprobantes de pago ha sido superada');
  }
};

const registerUsersCourses = async (params, data) => {
  const { courses, payment_status, payment_method, months_expiration, user, updated_by } = data;
  if (payment_method === 'Card' && payment_status === 'paid') {
    strapi.log.debug(
      `Register users: ${user.email} in the courses: ${JSON.stringify(courses)} where paymnet method='Card' ans status='paid'`
    );
    let currentDate = new Date();
    let expire = new Date(currentDate.setMonth(currentDate.getMonth() + months_expiration));
    for (const course of courses) {
      await createOrUpdate(user, course, expire, updated_by);
    }
  }
};

const registerOrDeletePermits = async (params, data) => {
  let purchaseResult;
  let courses = [];
  let user;
  if (data?.courses) {
    purchaseResult = data;
    courses = purchaseResult.courses;
    user = purchaseResult.user;
  } else {
    if (params?.id) {
      purchaseResult = await strapi.services['user-purchases'].findOne({ id: params.id });
    } else {
      purchaseResult = await strapi.services['user-purchases'].findOne({ payment_intent: params.payment_intent });
      purchaseResult.payment_status = 'refunded';
    }
    for (const course of purchaseResult?.courses) {
      courses.push(course.id);
    }
    user = purchaseResult?.user?.id;
  }
  strapi.log.info(
    'Delete, create or update courses according to payment status (paid -> register or update opposite case delete)'
  );
  const { payment_status, months_expiration, updated_by, payment_method } = purchaseResult;
  let currentDate, expire;
  switch (payment_status) {
    case 'paid':
      currentDate = new Date();
      expire = new Date(currentDate.setMonth(currentDate.getMonth() + months_expiration));
      for (const course of courses) {
        await createOrUpdate(user, course, expire, updated_by);
      }
      if (payment_method === 'Transfer') {
        await sendPaymentConfirmationEmail(purchaseResult);
      }
      break;
    default:
      for (const course of courses) {
        await deleteUserCourse(user, course);
      }
  }
};

const deletePermissions = async (params) => {
  const result = await strapi.services['user-purchases'].findOne({ id: params.id });
  const { user, courses } = result;
  if (user && courses) {
    for (const course of courses) {
      await deleteUserCourse(user.id, course.id);
    }
  }
};

const getNameCourseAndSlug = async (course) => {
  const result = await strapi.services.courses.findOne({ id: course });
  return { name: result.name, slug: result.slug };
};

const sendPaymentConfirmationEmail = async (Purchase) => {
  const { email, name, last_name, courses } = Purchase;
  let data = [],
    article = 'el curso';
  for (const course of courses) {
    data = [].concat(await getNameCourseAndSlug(course), data);
  }
  if (data.length > 1) {
    article = 'los cursos';
  }
  const emailTemplate = {
    subject: 'Pago recibido y confirmado',
    text: '.',
    html: `<!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <title>holi</title>
            </head>
            <body >
            <!--Copia desde aquí-->
            <table style="max-width: 600px; padding: 10px; margin:0 auto; border-collapse: collapse;">
              <tr>
                <td style="padding: 0">
                  <img style="padding: 0 0 15px 0; display: block" src="https://roboticawolf.com/images/7968cd42ddfa91037a091433bf5e656b.png" width="100%">
                </td>
              </tr>
              <tr>
                <td style="background-color: #ecf0f1; padding-top: 15px; border-radius: 15px;">
                  <div style="color: #34495e; margin: 4% 10% 2%; text-align: justify;font-family: sans-serif">
                    <h2 style="color: #e67e22;">Hola ${name} ${last_name}!</h2>
                    <p style="margin: 2px; font-size: 15px">
                       El pago para ${article}: ${data.map(
      (course) => `<a href="${process?.env?.URL}/cursos/${course.slug}" style="text-decoration: unset;"> ${course.name}</a>`
    )}, ha sido confirmado con éxito. Ya puedes disfrutar de su contenido!.</p>
                    &nbsp;
                    <div style="width: 100%; text-align: center; padding-bottom: 15px;">
                      <a style="text-decoration: none; border-radius: 5px; padding: 11px 23px; color: white; background-color: #3498db" href="${
                        process?.env?.URL
                      }/cursos">Ir a mis cursos</a>
                    </div>
                  </div>
                </td>
              </tr>
            </table>
            </body>
            </html>`,
  };

  await strapi.plugins['email'].services.email.sendTemplatedEmail(
    {
      to: email,
    },
    emailTemplate
  );
};

const deleteUserCourse = async (user, courseId) => {
  const result = await strapi.query('user-courses').findOne({ user_id: user, course_id: courseId, cohort_id: null });
  strapi.log.debug(`Delete course: ${courseId}, in the user: ${user}`);
  if (result) {
    await strapi.query('user-courses').delete({ id: result.id });
  }
};

const createOrUpdate = async (userId, courseId, expire, updatedBy) => {
  const results = await strapi.query('user-courses').findOne({ user_id: userId, course_id: courseId, cohort_id: null });
  strapi.log.debug(`Create or update course: ${courseId}, in the user: ${userId}`);
  const entity = results || null;
  if (!entity) {
    await strapi.query('user-courses').create({ course_id: courseId, user_id: userId, active: true, expiration_date: expire });
  } else {
    await strapi.query('user-courses').update({ id: entity.id }, { updated_by: updatedBy, expiration_date: expire });
  }
};

module.exports = {
  lifecycles: {
    async afterCreate(params, data) {
      registerUsersCourses(params, data);
    },
    async beforeUpdate(params, data) {
      validationShippingAddress(params, data);
      registerOrDeletePermits(params, data);
    },
    async beforeDelete(params) {
      deletePermissions(params);
    },
  },
};
