/**
 * Measures API latency against a running server (default http://localhost:4000).
 * Logs in with the seeded HR Manager from .env, warms up, then times each
 * endpoint sequentially and prints p50/p95/max.
 *
 *   npm run build && npm start        # in one terminal
 *   npm run bench                     # in another (BENCH_URL / BENCH_RUNS to override)
 */
try {
  process.loadEnvFile('.env');
} catch {
  // rely on the real environment
}

const BASE = process.env['BENCH_URL'] ?? 'http://localhost:4000';
const RUNS = Number(process.env['BENCH_RUNS'] ?? 50);
const WARMUP = 5;

const ENDPOINTS: [label: string, path: string][] = [
  ['list: default (name asc)', '/api/employees'],
  ['list: page 200 (deep offset)', '/api/employees?page=200'],
  ['list: sort totalUsd desc', '/api/employees?sort=totalUsd:desc'],
  ['list: sort baseSalary asc', '/api/employees?sort=baseSalary:asc'],
  ['list: filter country+level', '/api/employees?country=IN&level=L3'],
  ['list: search q=smith', '/api/employees?q=smith'],
  ['list: search q=an (2 chars)', '/api/employees?q=an'],
  ['detail: GET /employees/1', '/api/employees/1'],
  ['export: all 10k rows (CSV)', '/api/employees/export'],
  ['export: country=GB (CSV)', '/api/employees/export?country=GB'],
];

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env['SEED_HR_EMAIL'],
      password: process.env['SEED_HR_PASSWORD'],
    }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error('No session cookie returned');
  return cookie.split(';')[0]!;
}

async function time(path: string, cookie: string): Promise<{ ms: number; bytes: number }> {
  const started = performance.now();
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  const body = await res.arrayBuffer();
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return { ms: performance.now() - started, bytes: body.byteLength };
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;

async function main(): Promise<void> {
  const cookie = await login();
  console.log(`${BASE} — ${RUNS} sequential runs per endpoint after ${WARMUP} warm-up runs\n`);
  console.log('| Endpoint | p50 (ms) | p95 (ms) | max (ms) | response size |');
  console.log('|---|---:|---:|---:|---:|');
  for (const [label, path] of ENDPOINTS) {
    for (let i = 0; i < WARMUP; i++) await time(path, cookie);
    const samples: number[] = [];
    let bytes = 0;
    for (let i = 0; i < RUNS; i++) {
      const r = await time(path, cookie);
      samples.push(r.ms);
      bytes = r.bytes;
    }
    samples.sort((a, b) => a - b);
    const size =
      bytes > 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${(bytes / 1024).toFixed(1)} KB`;
    console.log(
      `| ${label} | ${percentile(samples, 50).toFixed(1)} | ${percentile(samples, 95).toFixed(1)} | ${samples.at(-1)!.toFixed(1)} | ${size} |`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
