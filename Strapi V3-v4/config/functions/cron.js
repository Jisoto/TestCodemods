'use strict';

/**
 * Cron config that gives you an opportunity
 * to run scheduled jobs.
 *
 * The cron format consists of:
 * [SECOND (optional)] [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK]
 *
 * See more details here: https://strapi.io/documentation/v3.x/concepts/configurations.html#cron-tasks
 */

module.exports = {
  '* 0 */12 * * *': async () => {
    strapi.log.debug('Cron for cohorts started');
    const now = new Date().toISOString();

    strapi.log.debug(`Removing access to courses that belongs to a cohort with date ${new Date().toISOString()}`);

    // Remove access to courses belonging to a cohort
    const cohortsFound = await strapi.services.cohort.find({
      _where: [{ end_date_lte: now }],
    });

    strapi.log.debug(`Cohorts found: ${cohortsFound.map((c) => `id: ${c?.id} name: ${c.name}, `)}`);

    const userCoursesForCohort = cohortsFound.map(async (cohort) => {
      await strapi.services['user-courses'].update({ cohort_id: cohort.id }, { active: false });
    });

    await Promise.all(userCoursesForCohort).catch((err) => {
      strapi.log.error(`Error updating users for cohort msg: ${err.message}`);
      strapi.log.error(err);
    });

    strapi.log.debug('Searching for NON cohort courses');

    // Remove access to other courses NOT part of a cohort
    const expirationDate = await strapi.services['user-courses'].find({
      _where: [{ expiration_date_lte: now }, { active: true }],
    });

    await Promise.all(
      expirationDate.map(async (course) => {
        await strapi.services['user-courses'].update({ course_id: course.id }, { active: false });
      })
    );
    strapi.log.debug('Cron job finished');
  },
  '* 0 */24 * * *': async () => {
    strapi.log.debug('Cron for change payment status user-purchases collection');
    const now = new Date().toISOString();

    strapi.log.debug(`change payment status with day ${new Date().toISOString()}`);

    // search user-purchase when payment status is pending
    const userPurchasesFound = await strapi.services['user-purchases'].find({
      _where: [{ payment_status: 'pending' }, { payment_method: 'Transfer' }],
    });

    strapi.log.debug(`user purchases found: ${userPurchasesFound.map((c) => `id: ${c?.id} name: ${c.session_id}, `)}`);

    const userPurchasesPendingFound = userPurchasesFound.map(async (userPurchase) => {
      let { created_at, id } = userPurchase;
      let expireDate = new Date(created_at.setDate(created_at.getDate() + 7));
      if (Date.parse(expireDate) <= Date.parse(now)) {
        await strapi.services['user-purchases'].update({ id: id }, { payment_status: 'unpaid' });
      }
    });

    await Promise.all(userPurchasesPendingFound).catch((err) => {
      strapi.log.error(`Error updating payment status for user purchases msg: ${err.message}`);
      strapi.log.error(err);
    });

    strapi.log.debug('Cron job finished');
  },
};
