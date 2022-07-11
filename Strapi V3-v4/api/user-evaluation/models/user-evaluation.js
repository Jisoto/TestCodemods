'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const getScoreObtainedAfterUpdate = async (params, data) => {
  const { evaluation_result } = data;
  let sumScore = 0;
  evaluation_result.map((result) => {
    sumScore += result.finalScore;
  });

  let score_obtained = sumScore / evaluation_result.length;
  data.score_obtained = score_obtained;
};

module.exports = {
  lifecycles: {
    async beforeUpdate(params, data) {
      getScoreObtainedAfterUpdate(params, data);
    },
  },
};
