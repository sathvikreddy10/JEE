/**
 * Sustained load test: 40 students hammering the app for 5 minutes.
 *
 * Each student continuously loops:
 *   Fetch sets (read) → Save an answer (write) → Fetch sets (read) → ...
 *
 * Reports: total requests, success %, latency (avg/p95/p99), error breakdown.
 */

import http from "node:http";

const BASE = "http://localhost:4000";
const STUDENT_COUNT = 41;         // reuse the 41 accounts created earlier
const DURATION_MS = 5 * 60 * 1000; // 5 minutes
const THINK_TIME_MS = 2000;       // delay between each action per student
const START_DELAY_MS = 100;       // stagger students so they don't all fire at once

const STUDENTS = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
  email: `loadtest${i}@testify.app`,
  password: "password123",
}));

// ─────────────────────── Shared state (per-student) ───────────────────────

const state = new Map(); // email -> { cookie, sessionId, questionIds, setId }

// ─────────────────────── HTTP helpers ───────────────────────

function req(method, path, body, cookie) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json", Connection: "keep-alive" },
      timeout: 30000,
    };
    if (cookie) opts.headers["Cookie"] = cookie;
    const start = Date.now();
    const r = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const elapsed = Date.now() - start;
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), elapsed, cookie: res.headers["set-cookie"] });
        } catch {
          resolve({ status: res.statusCode, body: data, elapsed, cookie: res.headers["set-cookie"] });
        }
      });
    });
    r.on("error", (e) => resolve({ status: 0, body: e.message, elapsed: Date.now() - start }));
    r.on("timeout", () => { r.destroy(); resolve({ status: 0, body: "TIMEOUT", elapsed: Date.now() - start }); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function extractSessionCookie(res) {
  if (!res.cookie) return null;
  const raw = Array.isArray(res.cookie) ? res.cookie[0] : res.cookie;
  const m = raw.match(/testify_session=([^;]+)/);
  return m ? `testify_session=${m[1]}` : null;
}

// ─────────────────────── Student lifecycle ───────────────────────

async function studentLoop(email, password, metrics) {
  const s = { email, cookie: null, sessionId: null, questionIds: [], setId: null };
  state.set(email, s);

  const endTime = Date.now() + DURATION_MS;

  // Step 1: Login (once)
  const loginRes = await req("POST", "/auth/login", { email, password });
  metrics.push({ step: "login", email, status: loginRes.status, elapsed: loginRes.elapsed });
  if (loginRes.status !== 200) return;
  s.cookie = extractSessionCookie(loginRes);
  if (!s.cookie) return;

  // Stagger start
  await sleep(START_DELAY_MS * Math.random());

  let actionCount = 0;

  while (Date.now() < endTime) {
    actionCount++;

    // Every 10 actions, refresh session data
    if (actionCount % 10 === 0) {
      // Fetch sets
      const setsRes = await req("GET", "/sets", null, s.cookie);
      metrics.push({ step: "fetch_sets", email, status: setsRes.status, elapsed: setsRes.elapsed });

      // Pick a live setId if we don't have one
      if (!s.setId && Array.isArray(setsRes.body)) {
        const live = setsRes.body.find((x) =>
          x.status === "live" || x.effectiveLifecycle === "live" ||
          x.batchPapers?.some((bp) => bp.effectiveStatus === "live")
        );
        if (live) {
          s.setId = live.id;
          // If not started yet, start the exam
          if (!s.sessionId && live.status === "live") {
            const startRes = await req("POST", "/exam/start", { setId: s.setId }, s.cookie);
            metrics.push({ step: "start_exam", email, status: startRes.status, elapsed: startRes.elapsed });
            if (startRes.status === 200 && startRes.body.sessionId) {
              s.sessionId = startRes.body.sessionId;
              s.questionIds = (startRes.body.questions || []).map((q) => q.id);
            }
          }
        }
      }

      // Also check health
      const healthRes = await req("GET", "/health", null, s.cookie);
      metrics.push({ step: "health", email, status: healthRes.status, elapsed: healthRes.elapsed });
    }

    // Save an answer if we have an active session
    if (s.sessionId && s.questionIds.length > 0) {
      const qId = s.questionIds[actionCount % s.questionIds.length];
      const ansRes = await req("POST", `/exam/${s.sessionId}/answer`, {
        questionId: qId,
        selectedOption: "A",
        timeSpent: Math.floor(Math.random() * 30) + 5,
        markedForReview: false,
      }, s.cookie);
      metrics.push({ step: "save_answer", email, status: ansRes.status, elapsed: ansRes.elapsed });
    }

    // Fetch sets again (read-heavy workload)
    const setsRes2 = await req("GET", "/sets", null, s.cookie);
    metrics.push({ step: "fetch_sets", email, status: setsRes2.status, elapsed: setsRes2.elapsed });

    // Fetch their active session
    if (s.sessionId) {
      const sessRes = await req("GET", `/exam/${s.sessionId}`, null, s.cookie);
      metrics.push({ step: "fetch_session", email, status: sessRes.status, elapsed: sessRes.elapsed });
    }

    // Brief pause between action bursts
    await sleep(THINK_TIME_MS + Math.random() * 1000);
  }

  // Submit exam at end
  if (s.sessionId) {
    const endRes = await req("POST", `/exam/${s.sessionId}/end`, null, s.cookie);
    metrics.push({ step: "submit", email, status: endRes.status, elapsed: endRes.elapsed });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────── Main ───────────────────────

const metrics = [];
console.log(`Starting sustained load test: ${STUDENT_COUNT} students, ${DURATION_MS / 1000}s duration`);
console.log(`Each student makes ~1 request every ~3 seconds\n`);

const startTime = Date.now();

// Fire all students concurrently
await Promise.all(
  STUDENTS.map((s) => studentLoop(s.email, s.password, metrics))
);

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// ─────────────────────── Report ───────────────────────

const total = metrics.length;
const byStep = {};
for (const m of metrics) {
  if (!byStep[m.step]) byStep[m.step] = [];
  byStep[m.step].push(m);
}

console.log(`\n═════════════════ SUSTAINED LOAD TEST REPORT (${elapsed}s) ═════════════════`);
console.log(`  Total requests:          ${total}`);
console.log(`  Students:                ${STUDENT_COUNT}`);
console.log(``);
console.log(`  Step breakdown:`);

let grandOk = 0;
let grandFail = 0;

for (const [step, items] of Object.entries(byStep)) {
  const ok = items.filter((m) => m.status >= 200 && m.status < 400).length;
  const fail = items.length - ok;
  const times = items.filter((m) => m.status >= 200 && m.status < 400).map((m) => m.elapsed);
  grandOk += ok;
  grandFail += fail;
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0;
  const bar = ok + fail > 0 ? ` ${"█".repeat(Math.round(ok / (ok + fail) * 20))}` : "";
  console.log(`    ${step.padEnd(16)} ${String(ok).padStart(5)}/${String(items.length).padStart(5)} ok${bar}  avg ${String(avg).padStart(5)}ms  p95 ${String(p95).padStart(5)}ms  p99 ${String(p99).padStart(6)}ms`);
}

const successRate = total ? (grandOk / total * 100).toFixed(1) : 0;
console.log(``);
console.log(`  Overall:                 ${grandOk}/${total} succeeded (${successRate}%)`);

if (grandFail > 0) {
  console.log(``);
  console.log(`  Errors:`);
  const errMap = {};
  for (const m of metrics) {
    if (m.status === 0 || m.status >= 400) {
      const key = `${m.step}|${m.status}`;
      if (!errMap[key]) errMap[key] = { step: m.step, status: m.status, count: 0, sample: m.body };
      errMap[key].count++;
    }
  }
  for (const e of Object.values(errMap)) {
    console.log(`    [${e.step}] HTTP ${e.status} × ${e.count}  (e.g. ${String(e.sample).slice(0, 80)})`);
  }
}

const reqPerSec = (total / elapsed).toFixed(1);
console.log(`\n  Throughput:              ${reqPerSec} req/s`);
console.log(`════════════════════════════════════════════════════════════════════════`);
process.exit(0);
