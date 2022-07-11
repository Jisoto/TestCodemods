'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  find: async (ctx) => {
    return strapi.query('courses').find({ ...ctx.query, active: true }, ['cover']);
  },
  findOne: async (ctx) => {
    var key = parseInt(ctx.params.id);
    return strapi.query('courses').findOne({ id: key, active: true }, ['cover']);
  },

  updateCategory: async (ctx) => {
    strapi.log.debug({ reqId: ctx.state.reqId }, `update category in courses: '${ctx.state?.user?.email}'`);
    const courses = await strapi.services.courses.find();
    for (const course of courses) {
      let category = 'Lab_Academy';
      if (course.slug.includes('foundation')) {
        category = 'Foundation';
      } else if (course.slug.includes('standard')) {
        category = 'Standard';
      }
      await strapi.services.courses.update({ id: course.id }, { category: category });
    }
    ctx.send({
      message: 'courses update',
    });
  },

  findBySlugTeacher: async (ctx) => {
    const isMyCourse = await strapi.services['user-courses'].findOne({
      'course_id.slug': ctx.params.slug,
      user_id: ctx.state.user.id,
    });

    if (!isMyCourse) {
      return ctx.forbidden('No tiene permisos para editar este curso');
    }

    const courseFound = await strapi
      .query('courses')
      .model.query((qb) => {
        qb.where('slug', '=', ctx.params.slug);
        qb.where('active', '=', true);
        qb.limit(1);
      })
      .fetch({
        withRelated: false,
        debug: true,
      });

    if (!courseFound) {
      return ctx.notFound('No se encontró el curso buscado', true);
    }

    strapi.log.info(`courseFound ${JSON.stringify(courseFound)}`);

    await courseFound
      .related('lessons')
      .query((qb) => {
        qb.columns('id', 'title', 'description', 'slug', 'order', 'active');
        //qb.where('active', '=', true);
        qb.orderBy('order', 'asc');
      })
      .fetch();

    await courseFound
      .related('course_features')
      .query((qb) => {
        qb.columns('id', 'title', 'description', 'icon');
        qb.where('active', '=', true);
        qb.orderBy('order', 'asc');
      })
      .fetch();

    const coverObj = await courseFound
      .related('cover')
      .query((qb) => {
        qb.columns('upload_file_id');
      })
      .fetch();

    if (coverObj && coverObj.get('upload_file_id')) {
      const coverInfo = await strapi.query('file', 'upload').findOne({ id: coverObj.get('upload_file_id') }, []);
      return {
        ...courseFound.toJSON(),
        cover: coverInfo,
      };
    }

    return courseFound.toJSON();
  },

  findBySlug: async (ctx) => {
    const isMyCourse = await strapi.services['user-courses'].find({
      'course_id.slug': ctx.params.slug,
      user_id: ctx?.state?.user?.id,
    });
    const { userCourseId } = ctx.query;
    let isContentId = false;
    if (userCourseId) {
      isContentId = isMyCourse.some(code => code.id === parseInt(userCourseId));
    }
    let courseFound = await strapi
      .query('courses')
      .model.query((qb) => {
        qb.where('slug', '=', ctx.params.slug);
        qb.where('active', '=', true);
        qb.limit(1);
      })
      .fetch({
        withRelated: false,
        debug: true,
      });

    if (!courseFound) {
      return ctx.notFound('No se encontró el curso buscado', true);
    }

    strapi.log.info(`courseFound ${JSON.stringify(courseFound)}`);

    await courseFound
      .related('lessons')
      .query((qb) => {
        qb.columns('id', 'title', 'description', 'slug', 'order');
        qb.where('active', '=', true);
        qb.orderBy('order', 'asc');
      })
      .fetch();

    await courseFound
      .related('course_features')
      .query((qb) => {
        qb.columns('id', 'title', 'description', 'icon');
        qb.where('active', '=', true);
        qb.orderBy('order', 'asc');
      })
      .fetch();

    const coverObj = await courseFound
      .related('cover')
      .query((qb) => {
        qb.columns('upload_file_id');
      })
      .fetch();

    let result = courseFound.toJSON();
    result.isContentId = isContentId;

    if (!result?.is_template && result?.course_template) {
      const courseResult = await strapi
        .query('courses')
        .model.query((qb) => {
          qb.where('id', '=', result?.course_template);
          qb.limit(1);
        })
        .fetch({
          withRelated: false,
          debug: true,
        });

      await courseResult
        .related('lessons')
        .query((qb) => {
          qb.columns('id', 'title', 'description', 'slug', 'order');
          qb.where('active', '=', true);
          qb.orderBy('order', 'asc');
        })
        .fetch();

      await courseResult
        .related('course_features')
        .query((qb) => {
          qb.columns('id', 'title', 'description', 'icon');
          qb.where('active', '=', true);
          qb.orderBy('order', 'asc');
        })
        .fetch();

      const data = courseResult.toJSON();
      result.lessons = [].concat(data?.lessons, result?.lessons);
      result.lessons.sort((a, b) => a.order - b.order);
      result.course_features = [].concat(data?.course_features, result?.course_features);
    }

    if (coverObj && coverObj.get('upload_file_id')) {
      const coverInfo = await strapi.query('file', 'upload').findOne({ id: coverObj.get('upload_file_id') }, []);
      return {
        ...result,
        cover: coverInfo,
      };
    }

    return result;

    // strapi.log.info(`courseFound ${JSON.stringify(courseFound)}`);

    // const cousesResp = await strapi.models.courses
    //   .fetchAll({
    // query: {...ctx.query._q},
    // query: {slug: ctx.params.slug},
    // debug: true,
    // columns: ['id'],
    // withRelated: false
    // withRelated: ['course_features', 'lessons']
    // withRelated: [{
    //   'course_features': (qb) => {
    //     qb.columns('id', 'title');
    //   }
    // }]
    // });

    // courses = await courseFound.toJSON();

    // return courses;
    // return courseFound;
  },
};
