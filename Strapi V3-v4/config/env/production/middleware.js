module.exports = {
  load: {
    before: ['responseTime', 'logger', 'cors', 'responses', 'gzip'],
    order: ['Define the middlewares load order by putting their name in this array is the right order'],
    after: ['parser', 'koa-request-id', 'router', 'serve-react'],
  },
  settings: {
    public: {
      path: './dist',
    },
  },
};
