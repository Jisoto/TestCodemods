'use strict';

const { differenceBy } = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  findStudentsByInstitution: async (ctx) => {
    const { id } = ctx.state.user;
    const { cohort } = ctx.params;
    strapi.log.debug({ reqId: ctx.state.reqId }, `Find students by institution started for user: '${ctx.state?.user?.email}'`);
    let resultCohort = await strapi.services.cohort.findOne({ id: cohort });
    let resultInstitutions = await strapi.services.institution.findOne({ id: resultCohort?.institution?.id, _limit: -1 });
    let result = differenceBy(resultInstitutions.users, resultCohort.students, 'id');
    result = result.filter((user) => user.id != id);
    return result;
  },
  find: async () => {
    let institutions = await strapi.services.institution.find({ _limit: -1 });
    return institutions;
  },
};
