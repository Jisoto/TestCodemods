'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const trimParamsValidation = async (data) => {
  // Trim all the params after verifying there are present
  data.name = data.name?.trim?.();
  data.code = data?.code?.trim?.();
};

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      trimParamsValidation(data);
    },
    async beforeUpdate(params, data) {
      trimParamsValidation(data);
    },
  },
};
