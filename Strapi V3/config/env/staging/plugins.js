module.exports = ({ env }) => ({
  upload: {
    provider: env('UPLOAD_PROVIDER'),
    providerOptions: {
      accessKeyId: env('UPLOAD_ACCESS_KEY_ID'),
      secretAccessKey: env('UPLOAD_SECRET_ACCESS_KEY'),
      region: env('UPLOAD_REGION'),
      params: {
        Bucket: env('UPLOAD_BUCKET'),
      },
    },
  },
});
