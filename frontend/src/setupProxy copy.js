const { createProxyMiddleware } = require('http-proxy-middleware');

// Log proxy setup
console.log('🔧 Setting up development proxy middleware...');
console.log('📡 API requests will be proxied to: http://localhost:12000');

module.exports = function(app) {
  // Log proxy middleware initialization
  console.log('🚀 Initializing proxy middleware for /api routes...');
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:12000',
      changeOrigin: true,
      // Don't rewrite the path - keep the /api prefix
      onProxyReq: (proxyReq, req, res) => {
        // Log proxy requests
        console.log(`📤 Proxying request: ${req.method} ${req.url} -> ${proxyReq.path}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log proxy responses
        console.log(`📥 Proxy response: ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
      },
      onError: (err, req, res) => {
        // Log proxy errors
        console.error(`❌ Proxy error for ${req.method} ${req.url}:`, err.message);
      }
    })
  );
  
  console.log('✅ Proxy middleware setup completed successfully');
};