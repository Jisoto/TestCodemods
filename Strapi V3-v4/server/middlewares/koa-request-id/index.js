'use strict';

const uuid = require('uuid/v4');

/**
 * Base on https://www.npmjs.com/package/koa-requestid middleware
 * @param strapi
 * @return {{initialize(): void}}
 */
module.exports = (strapi) => {
  return {
    // can also be async
    initialize() {
      const expose = 'Request-Id';
      const header = 'Request-Id';
      const query = 'requestId';

      strapi.app.use(async (ctx, next) => {
        let id;

        if (query) {
          id = ctx.query[query];
        }

        if (!id && header) {
          id = ctx.get(header);
        }

        if (!id) {
          id = uuid();
        }

        if (expose) {
          ctx.set(expose, id);
        }

        ctx.state.reqId = id;

        await next();
      });
    },
  };
};
