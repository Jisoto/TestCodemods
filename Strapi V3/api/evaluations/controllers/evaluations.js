'use strict';
const { isEmpty } = require('lodash');
const { sanitizeEntity } = require('strapi-utils');
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */
module.exports = {
  findMyEvaluations: async (ctx) => {
    strapi.log.debug({ reqId: ctx.state.reqId }, `Buscar las evaluaciones del usuario: : '${ctx.state?.user.email}'`);
    const evaluations = await strapi.services.evaluations.find({  _where: [{ _or: [{ user_created: ctx.state.user.id  }, { created_by: ctx.state.user.id }] }], _limit: -1  });
    return evaluations;
  },
  findEvaluationsByCourse: async (ctx) => {
    const { courseSlug } = ctx.params;
    const courseFound = await strapi
      .query('courses')
      .model.query((qb) => {
        qb.where('slug', '=', courseSlug);
        qb.limit(1);
      })
      .fetch({
        withRelated: false,
        debug: true,
      });

    await courseFound
      .related('lessons')
      .query((qb) => {
        qb.columns('id', 'title', 'description', 'slug');
        qb.where('active', '=', true);
        qb.orderBy('order', 'asc');
      })
      .fetch();

    const result = courseFound.toJSON();
    let evaluationsData = [];

    for (const lesson of result?.lessons) {
      const evaluations = await strapi.query('evaluations').find({ _where: { lessons: lesson?.id } });
      if (!isEmpty(evaluations)) {
        evaluations.map((evaluation) => {
          evaluationsData.push(evaluation);
        });
      }
    }

    let evaluationData = evaluationsData.filter((currentValue, currentIndex, evaluation) => {
      //Delete duplicate evaluation records
      return evaluation.findIndex((arrayValue) => JSON.stringify(arrayValue) === JSON.stringify(currentValue)) === currentIndex;
    });

    return evaluationData;
  },

  deleteEvaluationrelationWithCourse: async (ctx) => {
    const { courseSlug } = ctx.params;
    const { evaluation_id } = ctx.request.body;
    const lessonsDelete = await strapi.services.lessons.find({ 'course_id.slug': courseSlug });
    const idLessonsDelete = lessonsDelete.map((lesson) => lesson.id);
    const lessonsEvaluation = await strapi.services.evaluations.findOne({ id: evaluation_id });
    const idLessonsEvaluation = lessonsEvaluation.lessons.map((lesson) => lesson.id);
    const lessons = idLessonsEvaluation.filter((lesson) => !idLessonsDelete.includes(lesson));
    await strapi.services.evaluations.update({ id: evaluation_id }, { lessons: lessons });
    return lessons;
  },

  findOne: async (ctx) => {
    const { id } = ctx.params;
    const { courseSlug } = ctx.request.query;
    const { state } = ctx;
    strapi.log.debug(`Obtener información de la evaluación con ID: ${id}`);
    // The evaluation of the database is obtained
    const result = await strapi
      .query('evaluations')
      .model.query((db) => {
        db.where('id', '=', id);
        if (!state?.user?.role?.name === 'Teacher') {
          db.where('active', '=', true);
        }
        db.limit(1);
      })
      .fetch();
    // Convert the object type result to a JSON
    if (!result) {
      strapi.log.error(`No se encuentra información con el id: ${id} o se encuentra desactivada`);
      return ctx.notFound('La evaluación no se encuentra activa');
    }
    let server = result.toJSON();
    strapi.log.info({ server }, 'Evaluation');
    // The data is run, the correct answers are obtained and a new attribute is created with this value for the questions property
    server.questions.map((item) => {
      const option = item.options.filter((option) => option.score > 0);
      item.maxOptions = option.length;
    });

    if (courseSlug !== undefined) {
      let lessonsResult = await strapi.services.lessons.find({ 'course_id.slug': courseSlug });
      const lessons = lessonsResult.map((lesson) => lesson.id);
      server.lessons.forEach((lesson) => {
        if (lessons.includes(lesson.id)) lesson.view = true;
      });
    }

    if (state?.user?.role?.name === 'Teacher') {
      return server;
    }

    return sanitizeEntity(server, { model: strapi.models.evaluations });
  },

  scoreTest: async (ctx) => {
    const { options, course_id, lesson_id, cohort_id } = ctx.request.body;
    const { evaluation_id, optionSelect } = options;
    // id user
    const { state } = ctx;
    // The evaluation of the database is obtained
    const evaluation = await strapi.services.evaluations.findOne({ id: evaluation_id }, []);

    strapi.log.debug(
      { reqId: state.reqId, optionSelect: { data: optionSelect } },
      `Ingreso Proceso de Calificación al usuario: '${state?.user.email}'`
    );

    // -----------------answers from Back End----------------
    // it is obtained the id of the correct answer based on the score that is greater than 0
    const questionUniqueMultiple = (evaluation.questions ?? []).map((question) => {
      const option = question.options.filter((option) => option.score > 0);
      if (
        question.selection_type === 'unique' ||
        question.selection_type === 'multiple' ||
        question.selection_type === 'complete'
      ) {
        return option.map((option) => option.id);
      }
    });

    const fiterQuestion = questionUniqueMultiple.filter((question) => question !== undefined);

    const questionTrueFalse = (evaluation.questions ?? []).map((question) => {
      const option = question.options.filter((option) => option.score > 0);
      if (question.selection_type === 'true_false') {
        return option.map((option) => option.id);
      }
    });

    const fiterQuestionTrueFalse = questionTrueFalse.filter((question) => question !== undefined);

    // -----------------answers from Front End----------------
    // -----------------selection_type unique and multiple-------------------
    const userResponseUniqueMultiple = optionSelect.map((response) => {
      if (
        response.selection_type === 'unique' ||
        response.selection_type === 'multiple' ||
        response.selection_type === 'complete'
      ) {
        return response.optionSelect;
      }
    });
    // get options selected of user
    const filterUserResponseUniqueMultiple = userResponseUniqueMultiple.filter((response) => response !== undefined);

    let score = [];
    let optionSelected = [];
    for (let i = 0; i < filterUserResponseUniqueMultiple.length; i++) {
      const correctAnswer = fiterQuestion[i].map((item) => item);
      const userAnswer = filterUserResponseUniqueMultiple[i].map((item) => item);

      for (let j = 0; j < userAnswer.length; j++) {
        if (correctAnswer.includes(userAnswer[j])) {
          // get question id since JSON  of front-end
          const idQuestion = optionSelect.map((option) => {
            if (option.optionSelect[j] === userAnswer[j]) {
              return option.question_id;
            }
          });

          // filtered current question id
          const filterQuestion = idQuestion.filter((question) => question !== undefined);
          const filterForId = evaluation.questions.filter((question) => question.id === filterQuestion[0]);
          // get score from answer current
          const filterScore = filterForId[0].options.map((options) => {
            if (options.id === correctAnswer[j]) {
              return options.score;
            }
          });

          const selectedAnswer = filterForId[0].options.map((options) => {
            if (options.id === userAnswer[j]) {
              return {
                title: filterForId[0].title,
                content: filterForId[0].content,
                scoreMax: filterForId[0].score,
                selection_type: filterForId[0].selection_type,
                options,
              };
            }
          });
          const scoreArray = filterScore.filter((item) => item !== undefined);
          const filterSelectedAnswer = selectedAnswer.filter((options) => options !== undefined);

          filterSelectedAnswer[0].answer = 'correct';
          optionSelected.push(filterSelectedAnswer[0]);

          score.push(scoreArray);
        } else {
          // get question id since JSON  of front-end
          const idQuestion = optionSelect.map((option) => {
            if (option.optionSelect[j] === userAnswer[j]) {
              return option.question_id;
            }
          });

          // filtered current question id
          const filterQuestion = idQuestion.filter((question) => question !== undefined);
          const filterForId = evaluation.questions.filter((question) => question.id === filterQuestion[0]);

          const selectedAnswer = filterForId[0].options.map((options) => {
            if (options.id === userAnswer[j]) {
              return {
                title: filterForId[0].title,
                content: filterForId[0].content,
                scoreMax: filterForId[0].score,
                selection_type: filterForId[0].selection_type,
                options,
              };
            }
          });

          const filterSelectedAnswer = selectedAnswer.filter((item) => item !== undefined);
          filterSelectedAnswer[0].answer = 'incorrect';

          optionSelected.push(filterSelectedAnswer[0]);
        }
      }
    }
    // -----------------end selection_type unique and multiple-------------------

    // -------------------selection_type true_false----------------------

    const userResponseTrueFalse = optionSelect.map((response) => {
      if (response.selection_type === 'true_false') {
        return response.optionSelect;
      }
    });
    // get options selected of user
    const filterUserResponseTrueFalse = userResponseTrueFalse.filter((response) => response !== undefined);

    const arrayAswerUserQuestion = [];
    for (let i = 0; i < filterUserResponseTrueFalse.length; i++) {
      const aswerUserQuestion = Object.keys(filterUserResponseTrueFalse[i]);
      arrayAswerUserQuestion.push(aswerUserQuestion);
    }

    for (let i = 0; i < arrayAswerUserQuestion.length; i++) {
      const correctAnswerTF = fiterQuestionTrueFalse[i].map((item) => item);
      const userAnswerTF = arrayAswerUserQuestion[i].map((item) => parseInt(item));
      for (let j = 0; j < userAnswerTF.length; j++) {
        if (correctAnswerTF[j] === userAnswerTF[j]) {
          // get question id since JSON  of front-end
          const idQuestion = optionSelect.map((option) => {
            if (option.optionSelect[`${correctAnswerTF[j]}`]) {
              return option.question_id;
            }
          });

          const filterQuestion = idQuestion.filter((question) => question !== undefined);
          const filterForId = evaluation.questions.filter((question) => question.id === filterQuestion[0]);
          //let position = 0;
          const getFalseTrue = filterForId[0].options.map((falseTrue) => {
            if (falseTrue.id === correctAnswerTF[j]) {
              //return {title: filterForId[position].title, content: filterForId[position].content, scoreMax: filterForId[position].score, options};
              return falseTrue.true_false;
            }
          });

          const filterGetFalseTrue = getFalseTrue.filter((trueFalse) => trueFalse !== undefined);

          if (filterUserResponseTrueFalse[i][`${correctAnswerTF[j]}`] === filterGetFalseTrue[0].toString()) {
            // get score from answer current
            const filterScore = filterForId[0].options.map((options) => {
              if (options.id === correctAnswerTF[j]) {
                return options.score;
              }
            });

            const selectedAnswer = filterForId[0].options.map((options) => {
              if (options.id === correctAnswerTF[j]) {
                return {
                  title: filterForId[0].title,
                  content: filterForId[0].content,
                  scoreMax: filterForId[0].score,
                  selection_type: filterForId[0].selection_type,
                  options,
                };
              }
            });

            const scoreArray = filterScore.filter((item) => item !== undefined);
            const filterSelectedAnswer = selectedAnswer.filter((options) => options !== undefined);
            filterSelectedAnswer[0].answer = 'correct';

            optionSelected.push(filterSelectedAnswer[0]);
            score.push(scoreArray);
          } else {
            // get question id since JSON  of front-end
            const idQuestion = optionSelect.map((option) => {
              if (option.optionSelect[`${correctAnswerTF[j]}`]) {
                return option.question_id;
              }
            });

            // filtered current question id
            const filterQuestion = idQuestion.filter((question) => question !== undefined);
            const filterForId = evaluation.questions.filter((question) => question.id === filterQuestion[0]);

            const selectedAnswer = filterForId[0].options.map((options) => {
              if (options.id === correctAnswerTF[j]) {
                return {
                  title: filterForId[0].title,
                  content: filterForId[0].content,
                  scoreMax: filterForId[0].score,
                  selection_type: filterForId[0].selection_type,
                  options,
                };
              }
            });

            const filterSelectedAnswer = selectedAnswer.filter((options) => options !== undefined);
            filterSelectedAnswer[0].answer = 'incorrect';

            optionSelected.push(filterSelectedAnswer[0]);
          }
        }
      }
    }
    // -------------------end selection_type false_true----------------------

    const flatArray = score.reduce((acc, item) => acc.concat(item), []);

    let finalScore = 0;
    flatArray.forEach(function (score) {
      finalScore += score;
    });

    const original_evaluation = await strapi.services.evaluations.findOne({ id: evaluation_id }, []);
    const userId = state.user.id;
    const scoreMax = evaluation.score;
    const presentationTime = new Date();
    let evaluation_result = [
      {
        original_evaluation,
        finalScore,
        optionSelected,
      },
    ];

    const entity = await strapi.services['user-evaluation'].findOne({
      evaluation_id,
      user_id: userId,
      lesson: lesson_id,
      course: course_id,
      cohort_id: cohort_id,
    });
    if (!entity) {
      try {
        await strapi.services['user-evaluation'].create({
          evaluation_id,
          user_id: userId,
          evaluation_result,
          score_max: scoreMax,
          score_obtained: finalScore,
          cohort_id: cohort_id,
          presentation_time: presentationTime,
          course: course_id,
          lesson: lesson_id,
        });
        strapi.log.debug(
          { reqId: state.reqId, optionSelect: { data: evaluation_id, user: userId } },
          `Calificación realizada con exito, para el usuario: '${state?.user.email}'`
        );
      } catch (err) {
        strapi.log.error(
          { reqId: state.reqId, optionSelect: { data: evaluation_id, user: userId } },
          `Error al guardar la calificación de la evaluación para el usuario: '${state?.user.email}'`
        );
      }
    } else {
      const { attempts } = evaluation;
      const length = entity.evaluation_result.length;
      if (length >= attempts) {
        throw strapi.errors.badRequest('La cantidad de intentos realizados, ha superado a la cantidad máxima permitida');
      } else {
        await strapi.services['user-evaluation'].update(
          { id: entity.id },
          { evaluation_result: [].concat(entity.evaluation_result, evaluation_result) }
        );
      }
    }
    ctx.send({
      evaluation_id,
      option_selected: optionSelected,
      final_score: finalScore,
    });
  },

  create: async (ctx) => {
    let dataCreate = ctx.request.body;
    dataCreate.user_created = ctx.state.user.id;
    const evaluation = await strapi.services.evaluations.create(ctx.request.body);
    return evaluation;
  },
};
