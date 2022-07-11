'use strict';
const { isEmpty } = require('lodash');
const lodash = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */
const validateScoreTotal = (data) => {
  strapi.log.debug(`Validando score iniciado, para la prueba: ${data.title}`);
  const evaluationScore = data.score;

  const score = data.questions.map((question) => question.options?.map((option) => option.score));

  // converts the score variable to a flat array
  const reduceArrayScore = score?.reduce((acc, score) => acc.concat(score), []);

  let totalScore = 0;
  reduceArrayScore.forEach((score) => (totalScore += score));

  const scoreIsSame = totalScore === evaluationScore;

  if (!scoreIsSame) {
    strapi.log.error(`La suma total del puntaje por pregunta es diferente al puntaje total de la prueba: ${data.title}`);
    throw strapi.errors.badRequest('La suma total del puntaje por pregunta es diferente al puntaje total de la prueba!');
  }
  strapi.log.debug(`Score total validado con exito, para la prueba: ${data.title}`);
};

const validateUniqueQuestion = (data) => {
  strapi.log.debug(`Validando preguntas únicas iniciado para la prueba: ${data.title}`);
  data.questions.map((question) => {
    if (question?.selection_type === 'unique' || question?.selection_type === 'complete') {
      const titleQuestion = question?.title;
      let validateOnlyOption = 0;
      return question?.options.map((option) => {
        if (option.score > 0) {
          validateOnlyOption += 1;
          if (validateOnlyOption > 1) {
            if (question?.selection_type === 'unique') {
              strapi.log.debug(`Las pregunta de tipo unico, no pueden tener más de una respuesta!. Pregunta: ${titleQuestion} `);
              throw strapi.errors.badRequest(
                `Las pregunta de tipo unico, no pueden tener más de una respuesta!. Pregunta: ${titleQuestion} `
              );
            } else {
              strapi.log.debug(
                `Las pregunta de tipo completar, no pueden tener más de una respuesta!. Pregunta: ${titleQuestion}`
              );
              throw strapi.errors.badRequest(
                `Las pregunta de tipo completar, no pueden tener más de una respuesta!. Pregunta: ${titleQuestion}`
              );
            }
          }
        }
      });
    }
  });
};

const validateCompleteChoiceQuestion = (data) => {
  strapi.log.debug(`Validando preguntas para completar, iniciado para la prueba: ${data.title}`);
  data.questions.map((question) => {
    if (question?.selection_type === 'complete') {
      question.options.map((option) => {
        const titleOption = option?.title;
        const hasSeparator = option?.title.includes('---') || option?.title.includes('–––');
        const hasTwoOptions = option?.title.split('-').length > 1 || option?.title.split('–').length > 1;
        if (hasTwoOptions) {
          if (!hasSeparator) {
            strapi.log.error(
              `Formato no válido para opción doble, debe existir una separacion de tres guiones medios(---). Opción: ${titleOption}.`
            );
            throw strapi.errors.badRequest(
              `Formato no válido para opción doble, debe existir una separacion de tres guiones medios(---). Opción: ${titleOption}.`
            );
          }
        }
      });
    }
  });
};

const validateQuestionInContext = (data) => {
  data.questions.map((question) => {
    if (question?.selection_type === 'complete') {
      const hasContent = question.content?.split('\n').join('');
      if (question.content === null || question.content === undefined || hasContent === '') {
        const titleQuestion = question?.title;
        throw strapi.errors.badRequest(`Contenido de la pregunta vacio. Pregunta: ${titleQuestion}`);
      } else {
        const titleOption = question?.title;
        const hasSeparator = question.content?.includes('___');
        const hasTwoOptions = question.content?.split('_').length > 1;
        if (hasTwoOptions) {
          if (hasTwoOptions) {
            if (!hasSeparator) {
              throw strapi.errors.badRequest(
                `Formato no válido para pregunta doble, debe existir una separacion de tres guiones bajos(___). Pregunta: ${titleOption}`
              );
            }
          }
        }
      }
    }
  });
};

const validateTrueFalseChoice = (data) => {
  data.questions.map((question) => {
    if (question?.selection_type === 'true_false') {
      question.options.map((option) => {
        const titleOption = option.title;
        if (option?.true_false === null || option?.true_false === undefined) {
          throw strapi.errors.badRequest(`La opción es verdadera o falsa? Opción: ${titleOption}.`);
        }
      });
    }
  });
};

const createGrantPermissions = async (data) => {
  const { id, lessons } = data;
  let references;
  if (!isEmpty(lessons)) {
    for (const lesson of lessons) {
      if (!lesson?.content?.includes(`<Evaluation id="${id}"/>`)) {
        const content = lesson?.content + `\n<Evaluation id="${id}"/>`;
        if (!lesson.references) {
          references = {
            evaluations: [id],
            tasks: [],
          };
        } else {
          references = lesson.references;
          references.evaluations = [].concat(lesson.references.evaluations, id);
        }
        await strapi.services.lessons.update({ id: lesson?.id }, { content: content, references: references });
      }
    }
  }
};

const validateRelationLesson = async (params, data) => {
  const { id } = params;
  const { lessons } = data;
  const previusData = await strapi.services.evaluations.findOne({ id: id });
  await removePermissions(previusData, lessons, id);
  await grantPermissions(previusData, lessons, id);
};

const removePermissions = async (previusData, lessons, evaluationId) => {
  const idPreviusData = previusData?.lessons.map((res) => res.id);
  const removePermissions = lodash.difference(idPreviusData, lessons);
  for (const lessonRemove of removePermissions) {
    for (const lesson of previusData?.lessons) {
      if (lesson?.id == lessonRemove) {
        const deleteContent = `\\n<Evaluation id=\\"${evaluationId}\\"\\/>`;
        const regex = new RegExp(deleteContent, 'g');
        const content = lesson.content.replace(regex, '');
        lesson.references.evaluations = lesson.references.evaluations.filter((evaluation) => evaluation !== evaluationId);
        await strapi.services.lessons.update({ id: lesson?.id }, { content: content, references: lesson.references });
      }
    }
  }
};

const grantPermissions = async (previusData, lessons, evaluationId) => {
  const idPreviusData = previusData?.lessons.map((res) => res.id);
  const grantPermissions = lodash.difference(lessons, idPreviusData);
  let references;
  for (const lessonRemove of grantPermissions) {
    const result = await strapi.services.lessons.findOne({ id: lessonRemove });
    if (!result?.content?.includes(`<Evaluation id="${evaluationId}"/>`)) {
      const content = result?.content + `\n<Evaluation id="${evaluationId}"/>`;
      if (!result.references) {
        references = {
          evaluations: [evaluationId],
          tasks: [],
        };
      } else {
        references = result.references;
        references.evaluations = [].concat(result.references.evaluations, evaluationId);
      }
      await strapi.services.lessons.update({ id: lessonRemove }, { content: content, references: references });
    }
  }
};

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      validateCompleteChoiceQuestion(data);
      validateQuestionInContext(data);
      validateTrueFalseChoice(data);
      validateUniqueQuestion(data);
      validateScoreTotal(data);
    },
    async afterCreate(data) {
      createGrantPermissions(data);
    },
    async beforeUpdate(params, data) {
      if (data.questions !== undefined) {
        validateCompleteChoiceQuestion(data);
        validateQuestionInContext(data);
        validateTrueFalseChoice(data);
        validateUniqueQuestion(data);
        validateScoreTotal(data);
      }
      await validateRelationLesson(params, data);
    },
  },
};
