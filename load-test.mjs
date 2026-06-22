/**
 * Load test: 40+ concurrent students
 *
 * 1. Creates N test students & makes a paper live in the DB
 * 2. Each student: login → start exam → save some answers → submit
 * 3. Reports pass/fail, timing, and error breakdown
 */

import http from "node:http";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:4000";
const STUDENT_COUNT = 41;
const CONCURRENCY = 20;          // how many run in parallel at once
const ANSWERS_PER_STUDENT = 5;   // how many answers each student saves

// ─────────────────────── Setup ───────────────────────

async function setup() {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash("password123", 10);

  // Read existing set and batch
  const set = await prisma.questionSet.findFirst({ where: { name: "JEE Main 2026 — Full Physics & Chemistry" } });
  if (!set) throw new Error("No question set found — run seed first");
  const questions = await prisma.question.findMany({ where: { setId: set.id }, orderBy: { id: "asc" } });
  const batch = await prisma.batch.findFirst({ where: { name: "JEE Main 2026 Batch" } });
  if (!batch) throw new Error("No batch found");

  // Create test students
  const emails = [];
  for (let i = 0; i < STUDENT_COUNT; i++) {
    const email = `loadtest${i}@testify.app`;
    emails.push(email);
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: `Load Test ${i}`, passwordHash },
    });
    // Add to batch
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    await prisma.batchMember.upsert({
      where: { batchId_userId: { batchId: batch.id, userId: user.id } },
      update: {},
      create: { batchId: batch.id, userId: user.id },
    });
  }

  // Make paper live — set goTime to now
  const now = new Date();
  const bp = await prisma.batchPaper.findFirst({ where: { batchId: batch.id, setId: set.id } });
  if (bp) {
    await prisma.batchPaper.update({
      where: { id: bp.id },
      data: { notifiedAt: now, goTime: now },
    });
  }

  // Publish the set
  if (!set.publishedAt) {
    await prisma.questionSet.update({ where: { id: set.id }, data: { publishedAt: now } });
  }

  await prisma.$disconnect();
  console.log(`Setup complete: ${STUDENT_COUNT} students, ${questions.length} questions, paper is live`);
  console.log(`Demo credentials: password123 for all loadtest*@testify.app accounts\n`);
  return { emails, questions };
}

// ─────────────────────── HTTP helpers ───────────────────────

function req(method, path, body, cookie) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
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

// ─────────────────────── Student flow ───────────────────────

async function studentFlow(email, questions) {
  const results = { email, login: null, start: null, answers: [], end: null };
  const cookieJar = [];

  // 1. Login
  const loginRes = await req("POST", "/auth/login", { email, password: "password123" });
  results.login = { status: loginRes.status, elapsed: loginRes.elapsed };
  if (loginRes.status !== 200) return results;
  const cookie = extractSessionCookie(loginRes);
  if (!cookie) { results.login.error = "no cookie"; return results; }
  cookieJar.push(cookie);

  // 2. Start exam — need the setId
  const setsRes = await req("GET", "/sets?exam=JEE_MAIN", null, cookieJar.join("; "));
  const sets = Array.isArray(setsRes.body) ? setsRes.body : [];
  const liveSet = sets.find((s) => s.status === "live" || s.effectiveLifecycle === "live" || s.batchPapers?.some((bp) => bp.effectiveStatus === "live"));
  const setId = liveSet?.id;
  if (!setId) { results.start = { status: setsRes.status, error: "no live set", body: setsRes.body }; return results; }

  const startRes = await req("POST", "/exam/start", { setId }, cookieJar.join("; "));
  results.start = { status: startRes.status, elapsed: startRes.elapsed };
  if (startRes.status !== 200) return results;
  const sessionId = startRes.body.sessionId;

  // 3. Save some answers
  const myQuestions = questions.slice(0, ANSWERS_PER_STUDENT);
  for (const q of myQuestions) {
    let selectedOption = null;
    if (q.options) {
      const opts = JSON.parse(q.options);
      selectedOption = opts[q.correctAnswer?.charCodeAt(0) - 65] || opts[0]; // pick the correct one sometimes
    } else {
      selectedOption = q.correctAnswer;
    }
    const ansRes = await req("POST", `/exam/${sessionId}/answer`, {
      questionId: q.id,
      selectedOption,
      timeSpent: Math.floor(Math.random() * 60) + 10,
      markedForReview: false,
    }, cookieJar.join("; "));
    results.answers.push({ questionId: q.id, status: ansRes.status, elapsed: ansRes.elapsed });
  }

  // 4. End exam / submit
  const endRes = await req("POST", `/exam/${sessionId}/end`, null, cookieJar.join("; "));
  results.end = { status: endRes.status, elapsed: endRes.elapsed };

  return results;
}

// ─────────────────────── Runner ───────────────────────

async function runBatch(students, questions) {
  const results = [];
  for (let i = 0; i < students.length; i += CONCURRENCY) {
    const batch = students.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((email) => studentFlow(email, questions)));
    results.push(...batchResults);
    console.log(`  Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(students.length / CONCURRENCY)} done (${batch.length} students)`);
  }
  return results;
}

// ─────────────────────── Report ───────────────────────

function report(results) {
  const total = results.length;
  const logins = results.filter((r) => r.login.status === 200);
  const starts = results.filter((r) => r.start?.status === 200);
  const ends = results.filter((r) => r.end?.status === 200);

  const loginTimes = logins.map((r) => r.login.elapsed);
  const startTimes = starts.map((r) => r.start.elapsed);
  const endTimes = ends.map((r) => r.end.elapsed);
  const allAns = results.flatMap((r) => r.answers).filter((a) => a.status === 200);
  const ansTimes = allAns.map((a) => a.elapsed);

  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const p95 = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length * 0.95)];
  };

  console.log("\n══════════════════════════ LOAD TEST REPORT ══════════════════════════");
  console.log(`  Students attempted:     ${total}`);
  console.log(`  Login success:          ${logins.length}/${total}  (${(logins.length / total * 100).toFixed(0)}%)`);
  console.log(`  Exam start success:     ${starts.length}/${total}  (${(starts.length / total * 100).toFixed(0)}%)`);
  console.log(`  Answers saved:          ${allAns.length}/${results.reduce((s, r) => s + r.answers.length, 0)}`);
  console.log(`  Submit success:         ${ends.length}/${total}  (${(ends.length / total * 100).toFixed(0)}%)`);
  console.log(``);
  console.log(`  Login latency:          avg ${avg(loginTimes)}ms  p95 ${p95(loginTimes)}ms`);
  console.log(`  Exam start latency:     avg ${avg(startTimes)}ms  p95 ${p95(startTimes)}ms`);
  console.log(`  Answer save latency:    avg ${avg(ansTimes)}ms  p95 ${p95(ansTimes)}ms`);
  console.log(`  Submit latency:         avg ${avg(endTimes)}ms  p95 ${p95(endTimes)}ms`);
  console.log(``);

  // Error breakdown
  const errors = [];
  for (const r of results) {
    if (r.login.status !== 200) errors.push({ step: "login", email: r.email, status: r.login.status, body: typeof r.login.body === "object" ? JSON.stringify(r.login.body) : String(r.login.body).slice(0, 100) });
    if (r.start?.status !== 200 && r.start) errors.push({ step: "start", email: r.email, status: r.start.status, body: typeof r.start.body === "object" ? JSON.stringify(r.start.body) : String(r.start.body).slice(0, 100) });
    if (r.end?.status !== 200 && r.end) errors.push({ step: "submit", email: r.email, status: r.end.status, body: typeof r.end.body === "object" ? JSON.stringify(r.end.body) : String(r.end.body).slice(0, 100) });
    const badAns = r.answers.filter((a) => a.status !== 200);
    for (const a of badAns) errors.push({ step: "answer", email: r.email, questionId: a.questionId, status: a.status });
  }
  if (errors.length) {
    console.log("  Errors:");
    const grouped = {};
    for (const e of errors) {
      const key = `${e.step}|${e.status}`;
      if (!grouped[key]) grouped[key] = { step: e.step, status: e.status, count: 0, samples: [] };
      grouped[key].count++;
      if (grouped[key].samples.length < 3) grouped[key].samples.push(e);
    }
    for (const g of Object.values(grouped)) {
      console.log(`    [${g.step}] HTTP ${g.status}: ${g.count} occurrences`);
      for (const s of g.samples) console.log(`      e.g. ${s.email} — ${s.body || ""}`);
    }
  }
  console.log("══════════════════════════════════════════════════════════════════════");
}

// ─────────────────────── Main ───────────────────────

const { emails, questions } = await setup();
console.log("Running student flows...");
const results = await runBatch(emails, questions);
report(results);
process.exit(0);
