'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  findMyBookCodes: async (ctx) => {
    let myBookCodes = await strapi.services['book-codes'].find({ activated_by: ctx.state.user.id });
    for (const myBookCode of myBookCodes) {
      const slug = await strapi.services['book-codes'].getSlugCourse({grade: myBookCode.grade});
      let myCourse = await strapi.services.courses.findOne({ slug: slug });
      myBookCode.courseName = myCourse.name;
    }
    return myBookCodes;
  },

  activeBookCode: async (ctx) => {
    const { code } = ctx.params;
    let bookCode = await strapi.services['book-codes'].findOne({ code: code });
    if (!bookCode) {
      return ctx.badRequest(`El código de libro ${code} es inválido`);
    }
    if (bookCode.activated_by) {
      return ctx.badRequest(`El código de libro ${code} ya ha sido activado previamente por otro usuario.`);
    }
    await strapi.services['book-codes'].update({ id: bookCode.id }, { activated_by: ctx.state.user.id });
    ctx.send({
      message: 'Código Canjeado con Éxito'
    });
  },
};
