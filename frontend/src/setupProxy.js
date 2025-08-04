const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://venkat-label-backend.loca.lt',
      changeOrigin: true,
      // Don't rewrite the path - keep the /api prefix
    })
  );
};