const promClient = require('prom-client');

const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const requestCounter = new promClient.Counter({
  name: 'edutrack_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'role'],
});

const requestDuration = new promClient.Histogram({
  name: 'edutrack_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'role'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const errorCounter = new promClient.Counter({
  name: 'edutrack_http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code', 'role'],
});

const monitoring = (req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;
    const route = req.route?.path || req.originalUrl || 'unknown';
    const statusCode = res.statusCode;
    const role = req.user?.role || 'anonymous';

    requestCounter.labels(req.method, route, String(statusCode), role).inc();
    requestDuration.labels(req.method, route, String(statusCode), role).observe(duration);
    if (statusCode >= 400) {
      errorCounter.labels(req.method, route, String(statusCode), role).inc();
    }

    console.log(
      `[MONITOR] ${req.method} ${route} ${statusCode} ` +
      `user=${req.user?.id || 'anonymous'} role=${role} duration=${(duration * 1000).toFixed(2)}ms`
    );
  });

  next();
};

const getMetrics = async () => promClient.register.metrics();
const getMetricsJson = async () => promClient.register.getMetricsAsJSON();

module.exports = { monitoring, getMetrics, getMetricsJson };
