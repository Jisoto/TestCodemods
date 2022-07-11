'use strict';
const uui = require('uuid');
const { isEmpty } = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const getProduct = async (product_id) => {
  strapi.log.debug('get product data from purchase session');
  const productData = await strapi.services.products.findOne({ product_id: product_id });
  strapi.log.debug({ productData }, productData);
  return productData;
};

module.exports = {
  findWithSession: async (ctx) => {
    const { sessionId } = ctx.params;
    strapi.log.debug(
      { reqId: ctx.state.reqId, data: { user: ctx.state.user.id, session: sessionId } },
      'findWithSession for user-purchases started'
    );
    const result = await strapi
      .query('user-purchases')
      .model.query((db) => {
        db.where('session_id', '=', sessionId);
        db.where('user', '=', ctx.state.user.id);
        db.limit(1);
      })
      .fetch();
    strapi.log.info(`find one with session result: ${result ? 'Success' : 'Failed'}`);
    return result;
  },

  findWithProductSlug: async (ctx) => {
    const { productSlug } = ctx.params;
    strapi.log.debug(
      { reqId: ctx.state.reqId, data: { user: ctx.state.user.id, productSlug: productSlug } },
      'findWithProductId for user-purchases started'
    );
    const result = await strapi.services['user-purchases'].findOne({
      _where: [{ 'product.slug': productSlug, user: ctx.state.user.id }],
    });
    strapi.log.info(`findWithProductId result: ${result ? 'Success' : 'Failed'}`);
    return result;
  },

  createWireTransfer: async (ctx) => {
    const { amount, product_id, price_id } = ctx.request.body;
    strapi.log.debug(
      { reqId: ctx.state.reqId, data: { user: ctx.state.user.id, product_id } },
      `create wire transfer for user-purchases start for user: ${ctx.state.user.email}`
    );
    const purchaseData = await strapi.services['user-purchases'].find({
      _where: [{ user: ctx.state.user.id }, { amount: amount }, { product_id: product_id }, { price_id: price_id }],
    });
    if (!isEmpty(purchaseData)) {
      strapi.log.debug({ purchaseData }, 'get wire transfer data success');
      return purchaseData[0]?.session_id;
    } else {
      const id = uui.v4();
      const product = await getProduct(product_id);
      const result = await strapi.services['user-purchases'].create({
        session_id: id,
        amount: amount,
        product: product.id,
        user: ctx.state.user.id,
        name: ctx.state.user?.name,
        last_name: ctx.state.user?.last_name,
        email: ctx.state.user?.email,
        payment_status: 'pending',
        has_physical_items: product?.has_physical_items,
        months_expiration: product?.expires_in,
        payment_method: 'Transfer',
        product_id: product_id,
        price_id: price_id,
      });
      strapi.log.debug(`crate wire transfer success: ${result}`);
      return id;
    }
  },
};
