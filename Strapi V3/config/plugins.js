module.exports = ({ env }) => ({
  upload: {
    provider: 'local',
  },
  email: {
    provider: 'nodemailer',
    providerOptions: {
      host: env('SMTP_HOST'),
      port: env('SMTP_PORT'),
      auth: {
        user: env('SMTP_USERNAME'),
        pass: env('SMTP_PASSWORD'),
      },
      // ... any custom nodemailer options
    },
    settings: {
      defaultFrom: 'no-reply@roboticawolf.com',
      defaultReplyTo: 'no-reply@roboticawolf.com',
    },
  },
});


