'use strict';
const lodash = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const validatingConstraints = (data) => {
  strapi.log.debug(`validating data for Cohort, data: {id: ${data.id}, name: ${data.name}} before create`);
  let { students, course, start_date, end_date, teacher, institution } = data;
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  if (endDate <= startDate) {
    throw strapi.errors.badRequest('El valor del campo end_date, debe ser mayor al campo start_date');
  }
  if (!students) {
    students = [];
    //throw strapi.errors.badRequest('Un cohort debe tener al menos un estudiante asignado');
  }
  if (!course) {
    throw strapi.errors.badRequest('Un cohort debe tener un curso asignado');
  }
  if (!institution) {
    throw strapi.errors.badRequest('Un cohort debe tener una institución asignada');
  }
  if (!teacher) {
    throw strapi.errors.badRequest('Un cohort debe tener un docente asignado');
  } else {
    students.forEach((student) => {
      if (student === teacher) {
        throw strapi.errors.badRequest('Un estudiante no puede ser docente en el mismo Cohort');
      }
    });
  }
};

const registerUsersCourses = async (params, data) => {
  const { id } = params;
  const { students, course, teacher } = data;
  strapi.log.debug(
    `Register data:{teacher:${teacher}, students:${students}, course:${course}} for Cohort, data: {id: ${id}, name: ${data.name}} after create`
  );
  await createOrUpdateRegister(course, teacher, id, data.end_date);
  for (const student of students) {
    await createOrUpdateRegister(course, student, id, data.end_date);
  }
};

const createOrUpdateRegister = async (course_id, user_id, cohort_id, expiration_date, updatedBy) => {
  strapi.log.debug(`Create data:{user: ${user_id}, course: ${course_id}, cohort:${cohort_id}, in collection user-courses`);
  const results = await strapi.services['user-courses'].findOne({ user_id: user_id, course_id: course_id, cohort_id: cohort_id });
  if (!results) {
    const courseData = await strapi.services.courses.findOne({ id: course_id });
    const courseId = courseData.course_template ? courseData.course_template.id : course_id;
    if (!courseData.course_template) {
      await strapi.services['user-courses'].create({
        course_id: courseId,
        user_id: user_id,
        cohort_id: cohort_id,
        active: true,
        expiration_date: expiration_date,
      });
    } else {
      const resultsTemplate = await strapi.services['user-courses'].findOne({ user_id: user_id, course_id: courseId, cohort_id: null });
      await updateCourses(courseId, user_id);
      if (resultsTemplate) {
        await strapi.services['user-courses'].update({ id: resultsTemplate.id }, { course_id: course_id, cohort_id: cohort_id, active: true, expiration_date: expiration_date, updated_by: updatedBy });
      } else {
        await strapi.services['user-courses'].create({
          course_id: course_id,
          user_id: user_id,
          cohort_id: cohort_id,
          active: true,
          expiration_date: expiration_date,
        });
      }
    }
  } else {
    const courseData = await strapi.services.courses.findOne({ id: course_id });
    if (courseData.course_template) {
      await updateCourses(courseData.course_template.id, user_id);
    }
    await strapi.services['user-courses'].update(
      { id: results.id },
      { cohort_id: cohort_id, active: true, expiration_date: expiration_date, updated_by: updatedBy }
    );
  }
};

const updateCourses = async (courseId, userId) => {
  const courses = await strapi.services['user-courses'].find({ course_id: courseId, user_id: userId });
  for (const course of courses) {
    await strapi.services['user-courses'].update({ id: course.id}, { active: false});
  }
};

const updatingRecord = async (params, data) => {
  const results = await strapi.query('cohort').findOne({ id: params.id });
  const { students, teacher, updated_by, end_date } = results;
  strapi.log.debug(`Updating data for Cohort, data: {id: ${params.id}, name: ${data.name}} before update`);
  if (data.active) {
    await differentData(students, data.students, params.id);
    await createOrUpdate(teacher.id, data.course, params.id, updated_by?.id, end_date);
    for (const student of data.students) {
      await createOrUpdate(student, data.course, params.id, updated_by?.id, end_date);
    }
  }
};

const differentData = async (previousData, currentData, params) => {
  const idPrevius = previousData.map((res) => res.id);
  const data = lodash.difference(idPrevius, currentData);
  strapi.log.info(`Get diferent data for students remove or update, for data:{diferrentData: ${data}}`);
  await deleteUsersInUserCourses(data, params);
};

const deleteUsersInUserCourses = async (dataDelete, cohortId) => {
  strapi.log.debug(`Delete users: {users: ${dataDelete}}, from Cohort: ${cohortId}`);
  dataDelete.forEach(async (data) => {
    await strapi.query('user-courses').delete({ user_id: data, cohort_id: cohortId });
  });
};

const createOrUpdate = async (userId, courseId, cohortId, updatedBy, end_date) => {
  strapi.log.debug(`Create or update data:{user: ${userId}, course: ${courseId}, cohort:${cohortId}, in collection user-courses`);
  createOrUpdateRegister(courseId, userId, cohortId, end_date, updatedBy);
};

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      validatingConstraints(data);
    },
    async afterCreate(params, data) {
      registerUsersCourses(params, data);
    },
    async beforeUpdate(params, data) {
      await updatingRecord(params, data);
    },
  },
};
