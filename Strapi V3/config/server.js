module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  production: true,
  url: env('URL', null),
  cron: {
    enabled: true,
  },
  proxy: true,
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET', null),
    },
  },
});
