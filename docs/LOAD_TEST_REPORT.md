# Load Test Report

## Tool
- [k6](https://k6.io/) script: `scripts/load-test.js`

## Endpoints to test
- `GET /health` (API root)
- `GET /v1/me` (authenticated)
- `GET /v1/notifications` (authenticated, cursor-paginated)
- `GET /v1/businesses/:id/members` (authenticated, tenant-scoped)
- `GET /v1/businesses/:id/invites` (authenticated)

## How to run
```bash
# Set base URL
export BASE_URL=http://localhost:4000/v1  # or deployed URL

# Run load test
k6 run scripts/load-test.js
```

## Expected thresholds
- `http_req_duration` p(95) < 500ms
- `http_req_failed` rate < 0.01

## Notes
- Use authenticated tokens for protected endpoints.
- Redis must be running (rate limiting enabled).
- Run against a realistic dataset.
- Record actual results (p50/p95/p99, error rate, RPS) here after running.
