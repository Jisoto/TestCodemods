module.exports = {
  load: {
    before: ['responseTime', 'logger', 'cors', 'responses', 'gzip'],
    order: ['Define the middlewares load order by putting their name in this array is the right order'],
    after: ['parser', 'koa-request-id', 'router', 'serve-react'],
  },
  settings: {
    'koa-request-id': {
      enabled: true,
    },
    'serve-react': {
      enabled: true,
    },
    favicon: {
      enabled: true,
      path: './dist/favicon/favicon.ico',
      maxAge: 86400000,
    },
    public: {
      enabled: true,
      path: './public',
      maxAge: 60000,
      defaultIndex: true,
    },
    language: {
      enabled: true,
      defaultLocale: 'es_ec',
      modes: ['query', 'subdomain', 'cookie', 'header', 'url', 'tld'],
      cookieName: 'locale',
    },
    parser: {
      enabled: true,
      multipart: true,
      includeUnparsed: true,
      formidable: {
        maxFileSize: 200 * 1024 * 1024, // Defaults to 200mb
      },
    },
    poweredBy: {
      enabled: true,
      value: 'You wish you knew ;)',
    },
  },
};
