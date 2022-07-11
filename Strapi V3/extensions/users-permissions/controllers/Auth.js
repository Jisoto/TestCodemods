'use strict';

/**
 * Auth.js controller
 *
 * @description: A set of functions called "actions" for managing `Auth`.
 */

/* eslint-disable no-useless-escape */
const crypto = require('crypto');
const _ = require('lodash');
const grant = require('grant-koa');
const { sanitizeEntity } = require('strapi-utils');

const emailRegExp =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const formatError = (error) => [{ messages: [{ id: error.id, message: error.message, field: error.field }] }];

module.exports = {
  async callback(ctx) {
    const provider = ctx.params.provider || 'local';
    const params = ctx.request.body;

    strapi.log.debug({ reqId: ctx.state.reqId }, `Auth callback with email '${params?.identifier}'`);

    const store = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
    });

    if (provider === 'local') {
      if (!_.get(await store.get({ key: 'grant' }), 'email.enabled')) {
        strapi.log.error({ reqId: ctx.state.reqId }, 'Email provider not enabled');
        return ctx.badRequest(null, 'This provider is disabled.');
      }

      // The identifier is required.
      if (!params.identifier) {
        strapi.log.debug({ reqId: ctx.state.reqId }, 'Email is mandatory');
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.email.provide',
            message: 'El correo electrónico es obligatorio.',
          }),
        );
      }

      // The password is required.
      if (!params.password) {
        strapi.log.debug({ reqId: ctx.state.reqId }, 'Password is mandatory');
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.password.provide',
            message: 'La contraseña es obligatoria.',
          }),
        );
      }

      const query = { provider };

      // Check if the provided identifier is an email or not.
      const isEmail = emailRegExp.test(params.identifier);

      // Set the identifier to the appropriate query field.
      if (isEmail) {
        query.email = params.identifier.toLowerCase();
      } else {
        query.username = params.identifier;
      }

      // Check if the user exists.
      const user = await strapi.query('user', 'users-permissions').findOne(query);

      if (!user) {
        strapi.log.debug({ reqId: ctx.state.reqId }, `No user found for email: ${params.identifier}`);

        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.invalid',
            message: '🔎 Revise el correo electrónico y la contraseña, no se encontró ningún usuario.',
          }),
        );
      }

      if (_.get(await store.get({ key: 'advanced' }), 'email_confirmation') && user.confirmed !== true) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.confirmed',
            message: 'Su cuenta de correo electrónico no ha sido confirmada.',
          }),
        );
      }

      if (user.blocked === true) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.blocked',
            message: 'Su cuenta se encuentra bloqueada. Comuníquese con soporte si es un error.',
          }),
        );
      }

      // The user never authenticated with the `local` provider.
      if (!user.password) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.password.local',
            message: 'This user never set a local password, please login with the provider used during account creation.',
          }),
        );
      }

      const validPassword = await strapi.plugins['users-permissions'].services.user.validatePassword(
        params.password,
        user.password,
      );

      if (!validPassword) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.invalid',
            message: '🔎 Revise el correo electrónico y la contraseña, no se encontró ningún usuario.',
          }),
        );
      } else {
        ctx.send({
          jwt: strapi.plugins['users-permissions'].services.jwt.issue({
            id: user.id,
            email: user.email,
          }),
          user: sanitizeEntity(user.toJSON ? user.toJSON() : user, {
            model: strapi.query('user', 'users-permissions').model,
          }),
        });
      }
    } else {
      if (!_.get(await store.get({ key: 'grant' }), [provider, 'enabled'])) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'provider.disabled',
            message: 'This provider is disabled.',
          }),
        );
      }

      // Connect the user with the third-party provider.
      let user, error;
      try {
        [user, error] = await strapi.plugins['users-permissions'].services.providers.connect(provider, ctx.query);
      } catch ([obj, err]) {
        return ctx.badRequest(null, err === 'array' ? err[0] : err);
      }

      if (!user) {
        return ctx.badRequest(null, error === 'array' ? error[0] : error);
      }

      ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue({
          id: user.id,
          email: user.email,
        }),
        user: sanitizeEntity(user.toJSON ? user.toJSON() : user, {
          model: strapi.query('user', 'users-permissions').model,
        }),
      });
    }
  },

  async resetPassword(ctx) {
    const params = _.assign({}, ctx.request.body, ctx.params);

    if (params.password && params.passwordConfirmation && params.password === params.passwordConfirmation && params.code) {
      const user = await strapi.query('user', 'users-permissions').findOne({ resetPasswordToken: `${params.code}` });

      if (!user) {
        return ctx.badRequest(
          null,
          formatError({
            id: 'Auth.form.error.code.provide',
            message: 'Código de seguridad inválido.',
          }),
        );
      }

      const password = await strapi.plugins['users-permissions'].services.user.hashPassword({
        password: params.password,
      });

      // Update the user.
      await strapi.query('user', 'users-permissions').update({ id: user.id }, { resetPasswordToken: null, password });

      ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue({
          id: user.id,
          email: user.email,
        }),
        user: sanitizeEntity(user.toJSON ? user.toJSON() : user, {
          model: strapi.query('user', 'users-permissions').model,
        }),
      });
    } else if (params.password && params.passwordConfirmation && params.password !== params.passwordConfirmation) {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.password.matching',
          message: 'Passwords do not match.',
        }),
      );
    } else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.params.provide',
          message: 'Incorrect params provided.',
        }),
      );
    }
  },

  async connect(ctx, next) {
    const grantConfig = await strapi
      .store({
        environment: '',
        type: 'plugin',
        name: 'users-permissions',
        key: 'grant',
      })
      .get();

    const [requestPath] = ctx.request.url.split('?');
    const provider = requestPath.split('/')[2];

    if (!_.get(grantConfig[provider], 'enabled')) {
      return ctx.badRequest(null, 'This provider is disabled.');
    }

    if (!strapi.config.server.url.startsWith('http')) {
      strapi.log.warn(
        { reqId: ctx.state.reqId },
        'You are using a third party provider for login. Make sure to set an absolute url in config/server.js. More info here: https://strapi.io/documentation/developer-docs/latest/development/plugins/users-permissions.html#setting-up-the-server-url',
      );
    }

    // Ability to pass OAuth callback dynamically
    grantConfig[provider].callback = _.get(ctx, 'query.callback') || grantConfig[provider].callback;
    grantConfig[provider].redirect_uri = strapi.plugins['users-permissions'].services.providers.buildRedirectUri(provider);

    return grant(grantConfig)(ctx, next);
  },

  async forgotPassword(ctx) {
    let { email } = ctx.request.body;

    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(email);

    if (isEmail) {
      email = email.toLowerCase();
    } else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.email.format',
          message: 'Email inválido.',
        }),
      );
    }

    const pluginStore = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
    });

    // Find the user by email.
    const user = await strapi.query('user', 'users-permissions').findOne({ email: email.toLowerCase() });

    // User not found.
    if (!user) {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.user.not-exist',
          message: 'El email no existe.',
        }),
      );
    }

    // User blocked
    if (user.blocked) {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.user.blocked',
          message: 'Esta usuario fue deshabilitado.',
        }),
      );
    }

    // Generate random token.
    const resetPasswordToken = crypto.randomBytes(64).toString('hex');

    const settings = await pluginStore.get({ key: 'email' }).then((storeEmail) => {
      try {
        return storeEmail['reset_password'].options;
      } catch (error) {
        return {};
      }
    });

    const advanced = await pluginStore.get({
      key: 'advanced',
    });

    const userInfo = sanitizeEntity(user, {
      model: strapi.query('user', 'users-permissions').model,
    });

    settings.message = await strapi.plugins['users-permissions'].services.userspermissions.template(settings.message, {
      URL: advanced.email_reset_password,
      USER: userInfo,
      TOKEN: resetPasswordToken,
    });

    settings.object = await strapi.plugins['users-permissions'].services.userspermissions.template(settings.object, {
      USER: userInfo,
    });

    try {
      // Send an email to the user.
      await strapi.plugins['email'].services.email.send({
        to: user.email,
        from: settings.from.email || settings.from.name ? `${settings.from.name} <${settings.from.email}>` : undefined,
        replyTo: settings.response_email,
        subject: settings.object,
        text: settings.message,
        html: settings.message,
      });
    } catch (err) {
      return ctx.badRequest(null, err);
    }

    // Update the user.
    await strapi.query('user', 'users-permissions').update({ id: user.id }, { resetPasswordToken });

    ctx.send({ ok: true });
  },

  async register(ctx) {
    strapi.log.debug({ reqId: ctx.state.reqId }, `Register call received for email '${ctx.request.body?.email}'`);

    const pluginStore = await strapi.store({
      environment: '',
      type: 'plugin',
      name: 'users-permissions',
    });

    const settings = await pluginStore.get({
      key: 'advanced',
    });

    if (!settings.allow_register) {
      strapi.log.warn({ reqId: ctx.state.reqId }, 'User register is disabled');

      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.advanced.allow_register',
          message: 'El registro de nuevos usuarios no se encuentra habilitado.',
        }),
      );
    }

    const params = {
      ..._.omit(ctx.request.body, ['confirmed', 'confirmationToken', 'resetPasswordToken']),
      provider: 'local',
    };

    // Password is required.
    if (!params.password) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Password is mandatory');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.password.provide',
          message: 'La contraseña es obligatoria. Por favor ingrese una.',
        }),
      );
    }

    // Email is required.
    if (!params.email) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Email is mandatory');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.email.provide',
          message: 'El email es obligatorio. Por favor ingrese uno.',
        }),
      );
    }

    if (!params.name) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Name is mandatory');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.name.provide',
          message: 'El nombre es obligatorio. Por favor ingrese uno.',
        }),
      );
    }

    if (!params.last_name) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Last name is mandatory');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.last_name.provide',
          message: 'El apellido es obligatorio. Por favor ingrese uno.',
        }),
      );
    }



    if(params.code && !params.institution) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Institution is mandatory');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.institutions.provide',
          message: 'Por favor, seleccione una institución',
        }),
      );
    }

    /*if (!params.code) {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.code.provide',
          message: 'El código de libro es obligatorio. Por favor ingrese uno.',
        }),
      );
    }*/

    // Trim all the params after verifying there are present
    params.password = params.password.trim();
    params.confirmPassword = _.get(params, 'confirmPassword', '').trim();
    params.email = params.email.trim();
    params.confirmEmail = _.get(params, 'confirmEmail', '').trim();
    // For now the username is the same as the email
    params.username = params.email;
    params.name = params.name.trim();
    params.last_name = params.last_name.trim();
    params.code = params.code?.trim?.();
    params.blocked = false;

    if (params.email !== params.confirmEmail) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Email and confirmation email are not identical');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.email.confirm',
          message: 'El correo electrónico ingresado y la confirmación no son iguales.',
        }),
      );
    }

    if (params.password !== params.confirmPassword) {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Password and confirm password are not identical');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.password.confirm',
          message: 'La contraseña ingresada y la confirmación no son iguales.',
        }),
      );
    }

    // Throw an error if the password selected by the user
    // contains more than three times the symbol '$'.
    if (strapi.plugins['users-permissions'].services.user.isHashed(params.password)) {
      strapi.log.debug({ reqId: ctx.state.reqId }, `Password can't have more than 3 '${'$'}' symbols`);
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.password.format',
          message: 'La contraseña no puede contener más de tres veces el símbolo `$`.',
        }),
      );
    }

    const role = await strapi.query('role', 'users-permissions').findOne({ type: settings.default_role }, []);

    if (!role) {
      strapi.log.error({ reqId: ctx.state.reqId }, 'Default role not found');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.role.notFound',
          message: 'No se pudo encontrar el rol por defecto a asignar.',
        }),
      );
    }

    // Check if the provided email is valid or not.
    const isEmail = emailRegExp.test(params.email);

    if (isEmail) {
      params.email = params.email.toLowerCase();
    } else {
      strapi.log.debug({ reqId: ctx.state.reqId }, 'Email is not valid');
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.email.format',
          message: 'El correo electrónico no es válido. Por favor revíselo.',
        }),
      );
    }

    params.role = role.id;
    params.password = await strapi.plugins['users-permissions'].services.user.hashPassword(params);

    const user = await strapi.query('user', 'users-permissions').findOne({
      email: params.email,
    });

    if (user && user.provider === params.provider) {
      strapi.log.debug(
        { reqId: ctx.state.reqId },
        `The email is already taken, email: '${params.email}, provider: '${params.provider}'`,
      );
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.email.taken',
          message: 'El correo electrónico ingresado ya ha sido usado antes.',
        }),
      );
    }

    if (user && user.provider !== params.provider && settings.unique_email) {
      strapi.log.debug(
        { reqId: ctx.state.reqId },
        `The email is already taken and not uniq, email: '${params.email}, provider: '${params.provider}'`,
      );
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.email.taken',
          message: 'El correo electrónico ingresado ya ha sido usado antes.',
        }),
      );
    }

    if (!settings.email_confirmation) {
      params.confirmed = true;
    }

    try {
      let bookCode = null;
      let courseFoundForCode = null;
      if (!_.isEmpty(params.code)) {
        strapi.log.debug({ reqId: ctx.state.reqId }, `Book code sent, trying to get the info for '${params.code}'`);
        bookCode = await strapi
          .query('book-codes')
          .model.query((qb) => {
            qb.columns('id', 'activated_by', 'grade');
            qb.where('code', '=', params.code);
          })
          .fetch({
            withRelated: false,
            debug: true,
          });

        if (_.isEmpty(bookCode)) {
          strapi.log.debug({ reqId: ctx.state.reqId }, 'Book code sent is invalid');
          return ctx.badRequest(
            null,
            formatError({
              id: 'Auth.form.error.code.notFound',
              message: 'El código de libro ' + params.code + ' es inválido',
            }),
          );
        }

        if (!_.isNull(bookCode.get('activated_by'))) {
          strapi.log.debug({ reqId: ctx.state.reqId }, 'Book code sent, is already active');
          return ctx.badRequest(
            null,
            formatError({
              id: 'Auth.form.error.code.taken',
              message: 'El código de libro ' + params.code + ' ya ha sido activado previamente por otro usuario.',
            }),
          );
        }

        let courseSlugToSearch = await strapi.services['book-codes'].getSlugCourse({grade: bookCode.get('grade')});

        courseFoundForCode = await strapi
          .query('courses')
          .model.query((qb) => {
            qb.columns('id');
            qb.where('slug', '=', courseSlugToSearch);
            qb.where('active', '=', true);
            qb.limit(1);
          })
          .fetch({
            withRelated: false,
            debug: true,
          });

        if (!courseFoundForCode) {
          strapi.log.error({ reqId: ctx.state.reqId }, `Course not found for '${params.code}'`);
          return ctx.badRequest(
            null,
            formatError({
              id: 'Auth.form.error.code.notFound',
              message: 'No se encontró el curso para asignar a este usuario.',
            }),
          );
        }
      }

      const user = await strapi.connections.default.transaction(async (t) => {
        let user = await strapi.query('user', 'users-permissions').create(params, { transacting: t });
        let currentDate = new Date();
        strapi.log.debug({ reqId: ctx.state.reqId }, `User created id: ${user.id}`);
        if (!_.isEmpty(params.code)) {
          bookCode.set('activated_by', user.id);
          await bookCode.save(undefined, { transacting: t });

          await strapi.query('user-courses').create(
            {
              user_id: user.id,
              course_id: courseFoundForCode.get('id'),
              expiration_date: new Date(currentDate.setMonth(currentDate.getMonth() + 11)),
              institution: params.institution,
            },
            { transacting: t },
          );
        }
        return user;
      });

      const sanitizedUser = sanitizeEntity(user, {
        model: strapi.query('user', 'users-permissions').model,
      });

      if (settings.email_confirmation) {
        try {
          await strapi.plugins['users-permissions'].services.user.sendConfirmationEmail(user);
          strapi.log.debug({ reqId: ctx.state.reqId }, `Confirmation email sent to '${params.email}'`);
        } catch (err) {
          strapi.log.error({ reqId: ctx.state.reqId, err }, `Error sending email to '${params.email}'`);
          return ctx.badRequest(
            null,
            formatError({
              id: 'Auth.form.error.confirmationEmail',
              message: 'No se pudo enviar el email de confirmación, contacte a soporte.',
            }),
          );
        }
        return ctx.send({ user: sanitizedUser });
      }

      const jwt = strapi.plugins['users-permissions'].services.jwt.issue(_.pick(user, ['id', 'email']));

      return ctx.send({
        jwt,
        user: sanitizedUser,
      });
    } catch (err) {
      strapi.log.error({ reqId: ctx.state.reqId, err }, 'Error while creating the user');
      const adminError = _.includes(err.message, 'username')
        ? { id: 'Auth.form.error.username.taken', message: 'Username already taken' }
        : { id: 'Auth.form.error.email.taken', message: 'El correo electrónico ingresado ya ha sido usado antes.' };

      ctx.badRequest(null, formatError(adminError));
    }
  },

  async emailConfirmation(ctx, next, returnUser) {
    const { confirmation: confirmationToken } = ctx.query;

    const { user: userService, jwt: jwtService } = strapi.plugins['users-permissions'].services;

    if (_.isEmpty(confirmationToken)) {
      return ctx.badRequest('token.invalid');
    }

    const user = await userService.fetch({ confirmationToken }, []);

    if (!user) {
      return ctx.redirect('/?token-invalido=si');
      //return ctx.badRequest('token.invalid');
    }

    await userService.edit({ id: user.id }, { confirmed: true, confirmationToken: null });

    if (returnUser) {
      ctx.send({
        jwt: jwtService.issue({ id: user.id }),
        user: sanitizeEntity(user, {
          model: strapi.query('user', 'users-permissions').model,
        }),
      });
    } else {
      const settings = await strapi
        .store({
          environment: '',
          type: 'plugin',
          name: 'users-permissions',
          key: 'advanced',
        })
        .get();

      ctx.redirect(settings.email_confirmation_redirection || '/');
    }
  },

  async sendEmailConfirmation(ctx) {
    const params = _.assign(ctx.request.body);

    if (!params.email) {
      return ctx.badRequest('missing.email');
    }

    const isEmail = emailRegExp.test(params.email);

    if (isEmail) {
      params.email = params.email.toLowerCase();
    } else {
      return ctx.badRequest('wrong.email');
    }

    const user = await strapi.query('user', 'users-permissions').findOne({
      email: params.email,
    });

    if (user.confirmed) {
      return ctx.badRequest('already.confirmed');
    }

    if (user.blocked) {
      return ctx.badRequest(
        null,
        formatError({
          id: 'Auth.form.error.user.blocked',
          message: 'Este usuario fue deshabilitado.',
        }),
      );
    }

    try {
      await strapi.plugins['users-permissions'].services.user.sendConfirmationEmail(user);
      ctx.send({
        email: user.email,
        sent: true,
      });
    } catch (err) {
      return ctx.badRequest(null, err);
    }
  },
};
