import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/v1';

export default function () {
  // Health check
  const health = http.get(`${BASE_URL.replace('/v1','')}/health`);
  check(health, {
    'health status 200': (r) => r.status === 200,
  });

  // Add authenticated endpoints here with tokens
  // e.g. GET /me, /notifications, etc.
  sleep(1);
}
