'use strict';

const { differenceBy, difference, isEmpty } = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const sendRegistrationConfirmationEmail = async (usersFound, usersNotFound, user, course) => {
  const { name, last_name, email } = user;
  const nombre = 'nombre',
    apellido = 'apellido',
    correo = 'correo';
  const emailTemplate = {
    subject: 'Confirmación Registros de estudiantes',
    text: '.',
    html: `<!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <title>holi</title>
              <style>
                #customers {
                  font-family: Arial, Helvetica, sans-serif;
                  border-collapse: collapse;
                  width: 100%;
                }

                #customers td, #customers th {
                  border: 1px solid #ddd;
                  padding: 8px;
                }

                #customers tr:nth-child(even){background-color: #f2f2f2;}

                #customers tr:hover {background-color: #ddd;}

                #customers th {
                  padding-top: 12px;
                  padding-bottom: 12px;
                  text-align: left;
                  background-color: #04AA6D;
                  color: white;
                  min-width: 100px;
                }
                </style>
            </head>
            <body >
            <table style="max-width: 800px; padding: 10px; margin:0 auto; border-collapse: collapse;">
              <tr>
                <td style="padding: 0">
                  <img style="padding: 0 0 15px 0; display: block" src="https://roboticawolf.com/images/7968cd42ddfa91037a091433bf5e656b.png" width="100%">
                </td>
              </tr>
              <tr>
                <td style="background-color: #ecf0f1; padding-top: 15px; border-radius: 15px;">
                  <div style="color: #34495e; margin: 4% 10% 2%; text-align: justify;font-family: sans-serif">
                    <h2 style="color: #e67e22;">Hola ${name} ${last_name}!</h2>
                    <p style="margin: 2px; font-size: 15px">
                    El proceso solicitado de registrar estudiantes por medio de un excel para el ${course}, culmino con éxito, a continuación, se otorgará un resumen de este proceso. </p>
                    ${
                      !isEmpty(usersFound)
                        ? `<p>Estudiantes, matriculados con éxito </p>
                      <div style="style="max-width: 800px;">
                        <table id="customers">
                          <tr>
                            <th>Nombres</th>
                            <th>Apellidos</th>
                            <th>Correo</th>
                          </tr>
                          ${usersFound
                            .map(
                              (user, index) =>
                                `<tr data-index=${index}>
                            <td>${user[nombre]}</td>
                            <td>${user[apellido]}</td>
                            <td>${user[correo]}</td>
                            </tr>`
                            )
                            .join('')}
                        </table>
                      </div>`
                        : '<br >'
                    }
                    ${
                      !isEmpty(usersNotFound)
                        ? `<p>Estudiantes, que no se pudierón matricular (No se encontrarón datos) </p>
                      <div style="style="max-width: 800px;">
                        <table id="customers">
                          <tr>
                            <th>Nombres</th>
                            <th>Apellidos</th>
                            <th>Correo</th>
                          </tr>
                          ${usersNotFound
                            .map(
                              (user) =>
                                `<tr>
                              <td>${user[nombre]}</td>
                              <td>${user[apellido]}</td>
                              <td>${user[correo]}</td>
                            </tr>`
                            )
                            .join('')}
                        </table>
                      </div>`
                        : '<br >'
                    }
                  </div>
                  <br>
                  <footer style="text-align: center">
                    <address>
                      Generado por: Robotica Wolf, fecha: ${new Date().toISOString().slice(0, 10)}<br>
                      Plataforma: <a href="https://roboticawolf.com/" style="text-decoration: unset;"> roboticawolf</a> <br >
                      Soporte: info@roboticawolf.com <br>
                      Telefono: +593 99 677 9364 <br>
                    </address>
                  </footer>
                  <br >
                </td>
              </tr>
            </table>
            </body>
            </html>`,
  };

  await strapi.plugins['email'].services.email.sendTemplatedEmail(
    {
      to: email,
    },
    emailTemplate
  );
};

module.exports = {
  findStudents: async (ctx) => {
    const { cohort_id, course, name } = ctx.query;
    strapi.log.debug(`Obtener los estudiantes del cohort: ${cohort_id}, con el docente: ${ctx.state.user.id}`);
    let result;
    if (cohort_id) {
      result = await strapi
        .query('cohort')
        .model.query((db) => {
          db.where('id', '=', cohort_id);
          db.where('teacher', '=', ctx.state.user.id);
        })
        .fetch();
    } else {
      result = await strapi.query('cohort').findOne({ course: course, teacher: ctx.state.user.id });
      if (!result) {
        const currentDate = new Date();
        const expire = new Date(currentDate.setMonth(currentDate.getMonth() + 12));
        result = await strapi.query('cohort').create({
          name: name,
          course: course,
          teacher: ctx.state.user.id,
          start_date: new Date(),
          end_date: expire,
          institution: ctx.state.user.institution,
          active: true,
          students: [],
        });
      }
    }
    return result;
  },

  findMyCohorts: async (ctx) => {
    const { cohort } = ctx.params;
    let myCohorts = await strapi.services.cohort.find({ teacher: ctx.state.user.id });
    let myCohort = await strapi.services.cohort.findOne({ id: cohort });
    let result = myCohorts?.filter((myCohort) => myCohort.id != cohort);
    result.map((res) => {
      res.students = differenceBy(res.students, myCohort.students, 'id');
    });
    const resultCohorts = result.filter((cohort) => !isEmpty(cohort.students));
    let resultCohort = {
      active: !isEmpty(resultCohorts),
      cohorts: resultCohorts,
    };
    return resultCohort;
  },

  registerStudentFromExcel: async (ctx) => {
    const { cohort_id } = ctx.params;
    const usersRegister = ctx.request.body;
    let users = [],
      usersFound = [],
      usersNotFound = [];
    let user = [];
    for (let userRegister of usersRegister) {
      if (userRegister['correo']) {
        user = await strapi.query('user', 'users-permissions').findOne({
          _where: [
            {
              _or: [
                { email: userRegister['correo'] },
                { _and: [{ name: userRegister['nombre'] }, { last_name: userRegister['apellido'] }] },
              ],
            },
          ],
        });
      } else {
        user = await strapi.query('user', 'users-permissions').findOne({
          _where: [{ _and: [{ name: userRegister['nombre'] }, { last_name: userRegister['apellido'] }] }],
        });
      }
      if (user) {
        users.push(user.id);
        usersFound.push({ nombre: user.name, apellido: user.last_name, correo: user.email });
      } else {
        usersNotFound.push(userRegister);
      }
    }
    const cohort = await strapi.services.cohort.findOne({ id: cohort_id });
    const idStudents = cohort?.students.map((student) => student.id);
    const studentRegister = difference(users, idStudents);
    await strapi.services.cohort.update({ id: cohort_id }, { students: [].concat(idStudents, studentRegister) });
    await sendRegistrationConfirmationEmail(usersFound, usersNotFound, ctx.state.user, cohort?.course?.name);
    ctx.send({
      message: 'ok',
    });
  },

  update: async (ctx) => {
    const id = parseInt(ctx.params.id);
    await strapi.services.cohort.update({ id: id }, ctx.request.body);
    ctx.send({
      message: 'ok',
    });
  },
};
