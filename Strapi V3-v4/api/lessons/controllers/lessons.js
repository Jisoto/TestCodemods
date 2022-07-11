'use strict';

const { isEmpty, difference } = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const getLabels = async (regex, str) => {
  let m,
    data = [];
  while ((m = regex.exec(str)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    // The result can be accessed through the `m`-variable.
    m.forEach((match, groupIndex) => {
      if (groupIndex === 1) {
        data.push(parseInt(match));
      }
    });
  }
  return data;
};

const removePermissionsEvaluations = async (evaluations, editEvaluations, idLesson) => {
  const removePermissions = difference(evaluations, editEvaluations);
  for (const evaluation of removePermissions) {
    const evaluationData = await strapi.services.evaluations.findOne({ id: evaluation });
    const idLessons = evaluationData.lessons.map((lesson) => lesson.id);
    const lessons = idLessons.filter((lesson) => lesson !== idLesson);
    await strapi.services.evaluations.update({ id: evaluation }, { lessons: lessons });
  }
};

const removePermissionsTasks = async (tasks, editTasks, idLesson) => {
  const removePermissions = difference(tasks, editTasks);
  for (const task of removePermissions) {
    const taskData = await strapi.services.task.findOne({ id: task });
    const idLessons = taskData.lessons?.map((lesson) => lesson.id);
    const lessons = idLessons.filter((lesson) => lesson !== idLesson);
    await strapi.services.task.update({ id: task }, { lessons: lessons });
  }
};

const grantPermissionsEvaluations = async (evaluations, editEvaluations, idLesson) => {
  const grantPermissions = difference(editEvaluations, evaluations);
  for (const evaluation of grantPermissions) {
    const evaluationData = await strapi.services.evaluations.findOne({ id: evaluation });
    let lessons = [];
    if (!isEmpty(evaluationData?.lessons)) {
      lessons = evaluationData.lessons.map((lesson) => lesson.id);
      if (!lessons.includes(idLesson)) {
        lessons.push(idLesson);
      }
    } else {
      lessons.push(idLesson);
    }
    await strapi.services.evaluations.update({ id: evaluation }, { lessons: lessons });
  }
};

const grantPermissionsTask = async (tasks, editTasks, idLesson) => {
  const grantPermissions = difference(editTasks, tasks);
  for (const task of grantPermissions) {
    const taskData = await strapi.services.task.findOne({ id: task });
    let lessons = [];
    if (!isEmpty(taskData?.lessons)) {
      lessons = taskData.lessons.map((lesson) => lesson.id);
      if (!lessons.includes(idLesson)) {
        lessons.push(idLesson);
      }
    } else {
      lessons.push(idLesson);
    }
    await strapi.services.task.update({ id: task }, { lessons: lessons });
  }
};

module.exports = {
  findOne: async (ctx) => {
    strapi.log.debug({ reqId: ctx.state.reqId, data: { id: ctx.params.id } }, `find lesson started for id'${ctx.params.id}'`);
    const lesson = await strapi.services.lessons.findOne({ id: ctx.params.id });

    if (!lesson) {
      strapi.log.error(`No se encontró ningun registro para la clase: ${ctx.params.id}`);
      return ctx.notFound('No se encontró la clase buscada');
    }

    const resultEvaluations = await strapi.services.evaluations.find({ _where: [{ lessons: lesson.id }] });
    const resultTasks = await strapi.services.task.find({ _where: [{ lessons: lesson.id }] });

    let evaluations = [];
    let tasks = [];

    if (!isEmpty(resultEvaluations)) {
      evaluations = resultEvaluations.map((evaluation) => {
        return { id: evaluation.id, title: evaluation.title };
      });
    }

    if (!isEmpty(resultTasks)) {
      tasks = resultTasks.map((task) => {
        return { id: task.id, title: task.title };
      });
    }

    lesson.evaluations = evaluations;
    lesson.tasks = tasks;

    return lesson;
  },

  findByCourseAndLessonSlug: async (ctx) => {
    strapi.log.debug(
      { reqId: ctx.state.reqId, data: { courseSlug: ctx.params.courseSlug, lessonSlug: ctx.params.lessonSlug } },
      `findByCourseAndLessonSlug started for user: '${ctx.state?.user.email}'`
    );
    const courseFound = await strapi
      .query('courses')
      .model.query((qb) => {
        qb.columns('id', 'course_template');
        qb.where('slug', '=', ctx.params.courseSlug);
        qb.where('active', '=', true);
        qb.limit(1);
      })
      .fetch({
        withRelated: false,
        debug: true,
      });

    if (!courseFound) {
      strapi.log.error(`No se encontró ningun registro para el curso: ${ctx.params.courseSlug}`);
      return ctx.notFound('No se encontró el curso buscado', true);
    }

    strapi.log.info(`courseFound ${JSON.stringify(courseFound)}`);

    const lessonFound = await strapi
      .query('lessons')
      .model.query((qb) => {
        if (courseFound.get('course_template')) {
          qb.where('course_id', '=', courseFound.get('id')).orWhere('course_id', '=', courseFound.get('course_template'));
        } else {
          qb.where('course_id', '=', courseFound.get('id'));
        }
        qb.where('slug', '=', ctx.params.lessonSlug);
        qb.where('active', '=', true);
        qb.limit(1);
      })
      .fetch({
        withRelated: false,
        debug: true,
      });

    if (!lessonFound) {
      strapi.log.error(`No se encontró ningun registro para la clase: ${ctx.params.lessonSlug}`);
      return ctx.notFound('No se encontró la clase que busca', true);
    }

    strapi.log.info(`lessonFound ${JSON.stringify(lessonFound)}`);

    const userCourse = await strapi
      .query('user-courses')
      .model.query((qb) => {
        qb.where('user_id', '=', ctx.state.user.id);
        qb.where('course_id', '=', courseFound.get('id'));
        qb.where('active', '=', true);
        qb.limit(1);
      })
      .fetch({
        withRelated: false,
        debug: true,
      });
    strapi.log.info(`userCourse ${JSON.stringify(userCourse)}`);
    // User has permissions to see the videos
    if (userCourse && userCourse.get('id')) {
      await lessonFound
        .related('videos')
        .query((qb) => {
          qb.columns('dash_url', 'hls_url', 'name');
          qb.where('active', '=', true);
        })
        .fetch();
      strapi.log.info(`User has permission to see lessons ${JSON.stringify(lessonFound)}`);
    } else {
      strapi.log.error(
        { reqId: ctx.state.reqId, data: { courseSlug: ctx.params.courseSlug, lessonSlug: ctx.params.lessonSlug } },
        `No tiene permiso para ver este curso, user: '${ctx.state?.user.email}'`
      );
      return ctx.forbidden('No tiene permiso para ver este curso');
    }

    return lessonFound;
  },

  updateRelationsWithEvaluationsAndTasks: async (ctx) => {
    strapi.log.debug(
      { reqId: ctx.state.reqId },
      `update relations with evaluations from courses with category: ${ctx.params.category} and tasks started for user: '${ctx.state?.user?.email}'`
    );

    const courses = await strapi.services.courses.find({ category: ctx.params.category });

    let lessonsAux = [];

    courses.map((course) => course.lessons.map((lesson) => {
      if(lesson?.content?.includes('Evaluation') || lesson?.content?.includes('Task')) {
        strapi.log.debug(`lesson id: ${lesson.id} that contains evaluation or task in their content, of course id: ${course.id}`);
        lessonsAux.push(lesson);
      }
    }));
    // eslint-disable-next-line no-useless-escape
    const regexArray = [/<Evaluation id=\"([^"]*)\"[\s]{0,}\/>/gim, /<Task id=\"([^"]*)\"[\s]{0,}\/>/gim];
    for (const lesson of lessonsAux) {
      strapi.log.debug(`Get the amount of evaluations and tasks of the lesson id: ${lesson.id}`);
      let data = {
        evaluations: await getLabels(regexArray[0], lesson.content),
        tasks: await getLabels(regexArray[1], lesson.content),
      };
      strapi.log.debug(`update references data: { evaluations: [${data.evaluations}], tasks: [${data.tasks}] }, lesson id: ${lesson.id}`);
      await strapi.services.lessons.update({ id: lesson.id }, { references: data, update: true });
    }

    ctx.send({
      message: 'ok',
    });
  },

  create: async (ctx) => {
    const { evaluations, tasks, slug, order, course_id } = ctx.request.body;
    const slugUsed = await strapi.services.lessons.findOne({ course_id: course_id, slug: slug });
    const orderUsed = await strapi.services.lessons.findOne({ course_id: course_id, order: order });
    if (slugUsed) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Slug used');
      return ctx.badRequest('El slug ya se encuentra utilizado, por favor ingrese otro valor');
    }
    if (orderUsed) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Order used');
      return ctx.badRequest('El order ya se encuentra utilizado, por favor ingrese otro valor');
    }
    const lesson = await strapi.services.lessons.create(ctx.request.body);
    await grantPermissionsEvaluations([], evaluations, lesson.id);
    await grantPermissionsTask([], tasks, lesson.id);

    ctx.send({
      message: 'ok',
    });
  },

  update: async (ctx) => {
    const id = parseInt(ctx.params.id);
    const { evaluations, editEvaluations, tasks, editTasks } = ctx.request.body;
    await strapi.services.lessons.update({ id: id }, ctx.request.body);
    await removePermissionsEvaluations(evaluations, editEvaluations, id);
    await removePermissionsTasks(tasks, editTasks, id);
    await grantPermissionsEvaluations(evaluations, editEvaluations, id);
    await grantPermissionsTask(tasks, editTasks, id);
    ctx.send({
      message: 'ok',
    });
  },
};
