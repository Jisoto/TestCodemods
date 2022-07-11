'use strict';
const geoip = require('geoip-country');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  find: async (ctx) => {
    const customerIp = ctx.request.ip;
    strapi.log.debug({ request: ctx.request }, `Customer IP: ${customerIp}`);
    const geo = geoip.lookup(customerIp);
    const country = geo?.country;
    const orCondition = [];
    if (country) {
      orCondition.push({ 'countries.code_contains': country });
    }
    orCondition.push({ 'countries.code_contains': 'default' });

    const productsFound = await strapi.query('products').find({ _where: { _or: orCondition } });

    strapi.log.debug({ productsFound }, `Products found for ip: ${customerIp}, country: ${country}`);

    return productsFound;
  },
  findOne: async (ctx) => {
    const { slug } = ctx.params;
    const productFound = await strapi.services.products.findOne({ slug: slug });

    if (!productFound) {
      return ctx.notFound('No se encontró el producto buscado o no está disponible para tu país');
    }

    return productFound;
  },

  findBySlug: async (ctx) => {
    const { slug } = ctx.params;
    const customerIp = ctx.request.ip;
    var geo = geoip.lookup(customerIp);
    const { country } = geo;
    const productFound = await strapi.services.products.findOne({
      _where: [{ slug: slug }, { _or: [{ 'countries.code_contains': country }, { 'countries.code_contains': 'default' }] }],
    });

    if (!productFound) {
      return ctx.notFound('No se encontró el producto buscado o no está disponible para tu país');
    }

    return productFound;
  },
};
