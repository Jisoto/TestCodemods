'use strict';

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/v3.x/concepts/configurations.html#bootstrap
 */

const _ = require('lodash');
const pino = require('pino');

const logLevels = Object.keys(pino.levels.values);
const standardKeys = ['pid', 'hostname', 'name', 'level', 'time', 'v'];
// eslint-disable-next-line no-unused-vars
const defaultErrorLikeObjectKeys = ['err', 'error'];

function withSpaces(value, eol) {
  const lines = value.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    lines[i] = '    ' + lines[i];
  }
  return lines.join(eol);
}

// eslint-disable-next-line no-unused-vars
function filter(value, messageKey, eol, errorLikeObjectKeys, excludeStandardKeys) {
  errorLikeObjectKeys = errorLikeObjectKeys || [];

  const keys = Object.keys(value);
  let filteredKeys = [messageKey];

  if (excludeStandardKeys !== false) {
    filteredKeys = filteredKeys.concat(standardKeys);
  }

  var result = '';

  for (let i = 0; i < keys.length; i++) {
    if (errorLikeObjectKeys.indexOf(keys[i]) !== -1) {
      const arrayOfLines = ('    ' + keys[i] + ': ' + withSpaces(JSON.stringify(value[keys[i]], null, 2), eol) + eol).split('\n');

      for (let j = 0; j < arrayOfLines.length; j++) {
        if (j !== 0) {
          result += '\n';
        }

        const line = arrayOfLines[j];

        if (/^\s*"stack"/.test(line)) {
          const matches = /^(\s*"stack":)\s*"(.*)",?$/.exec(line);

          if (matches) {
            if (matches.length === 3) {
              const indentSize = /^\s*/.exec(line)[0].length + 4;
              const indentation = Array(indentSize + 1).join(' ');

              result += matches[1] + '\n' + indentation + matches[2].replace(/\\n/g, '\n' + indentation);
            }
          } else {
            result += line;
          }
        } else {
          result += line;
        }
      }
    } else if (filteredKeys.indexOf(keys[i]) < 0) {
      result += '    ' + keys[i] + ': ' + withSpaces(JSON.stringify(value[keys[i]], null, 2), eol) + eol;
    }
  }

  return result;
}

function getLogLevel() {
  if (!_.isString(process.env.STRAPI_LOG_LEVEL)) {
    // Default value.
    return 'debug';
  }

  const logLevel = process.env.STRAPI_LOG_LEVEL.toLowerCase();

  if (!_.includes(logLevels, logLevel)) {
    throw new Error(
      `Invalid log level set in STRAPI_LOG_LEVEL environment variable. Accepted values are: '${logLevels.join('", "')}'.`
    );
  }

  return logLevel;
}

function getBool(envVar, defaultValue) {
  if (_.isBoolean(envVar)) return envVar;
  if (_.isString(envVar)) {
    if (envVar === 'true') return true;
    if (envVar === 'false') return false;
  }
  return defaultValue;
}

const loggerConfig = {
  level: getLogLevel(),
  timestamp: getBool(process.env.STRAPI_LOG_TIMESTAMP, false),
  // prettyPrint: getBool(process.env.STRAPI_LOG_PRETTY_PRINT, true),
  forceColor: getBool(process.env.STRAPI_LOG_FORCE_COLOR, true),
};

const stringifyExtraProps = getBool(process.env.STRAPI_LOG_STRINGIFY_EXTRA_PROPS, true);

const overwriteLoggerForDev = () => {
  const pretty = pino.pretty({
    formatter: (logs, options) => {
      let line = `${options.asColoredText({ level: 10 }, `[${new Date().toISOString()}]`)} ${options.prefix.toLowerCase()} ${
        logs.stack ? logs.stack : logs.msg
      }`;

      // line += filter(logs, 'msg', eol, defaultErrorLikeObjectKeys);

      const extraPropsObj = {
        ...logs,
        msg: undefined,
        pid: undefined,
        hostname: undefined,
        name: undefined,
        level: undefined,
        time: undefined,
        v: undefined,
      };

      let objString = JSON.stringify(extraPropsObj, null, stringifyExtraProps ? 2 : 0);
      if (objString !== '{}') {
        if (stringifyExtraProps) {
          line += `\n${options.asColoredText({ level: 30 }, '[obj]: ')}` + objString;
        } else {
          line += `${options.asColoredText({ level: 30 }, ' [obj]: ')}` + objString;
        }
      }
      return line;
    },
  });

  pretty.pipe(process.stdout);

  strapi.log = pino(loggerConfig, pretty);
  strapi.app.context.log = pino(loggerConfig, pretty);
};

module.exports = (
  {
    strapi
  }
) => {
  if (getBool(process.env.STRAPI_LOG_OVERRIDE_FOR_DEV, false) && getBool(process.env.STRAPI_LOG_PRETTY_PRINT, true)) {
    overwriteLoggerForDev();
  }
  strapi.log.debug(
    {
      url: process.env.URL,
      nodeEnv: process.env.NODE_ENV,
      dbHost: process.env.DATABASE_HOST,
      dbName: process.env.DATABASE_NAME,
      dbUsername: process.env.DATABASE_USERNAME,
    },
    'bootstrap.js executed'
  );
};
