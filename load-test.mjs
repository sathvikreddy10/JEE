/**
 * Testify Load Test — 20 concurrent students, fast & smooth
 *
 * Usage:
 *   1. Start the backend:  cd apps/backend && npx tsx src/server.ts
 *   2. Start the frontend: cd apps/frontend && npm run start
 *   3. Run this:           npx tsx load-test.mjs
 */

const BASE = "http://localhost:4000";
const STUDENTS = 20;
const PASSWORD = "password123";
const EMAIL_TEMPLATE = "loadtest%d@testify.app";

// Pick one paper (ID 1) — seeded as "JEE Main 2025"
const PAPER_ID = 1;

let passed = 0;
let failed = 0;

async function simulateStudent(index) {
  const email = EMAIL_TEMPLATE.replace("%d", index);
  const label = `[Student ${String(index).padStart(2, "0")}]`;

  try {
    // 1. Login
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (!loginRes.ok) {
      const text = await loginRes.text();
      console.log(`${label} ❌ Login failed (${loginRes.status}): ${text.slice(0, 80)}`);
      failed++;
      return;
    }
    const { user } = await loginRes.json();
    const cookie = loginRes.headers.get("set-cookie") || "";
    const sessionToken = cookie.split(";")[0] || "";
    if (!sessionToken) {
      console.log(`${label} ❌ No session cookie`);
      failed++;
      return;
    }
    console.log(`${label} ✅ Logged in as ${user.email}`);

    // 2. Fetch stats (used by dashboard)
    const statsRes = await fetch(`${BASE}/student/stats`, {
      headers: { Cookie: sessionToken },
    });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      console.log(`${label} 📊 Stats: streak=${stats.streak}`);
    }

    // 3. Start a test session
    const startRes = await fetch(`${BASE}/exam/${PAPER_ID}/start`, {
      method: "POST",
      headers: { Cookie: sessionToken, "Content-Type": "application/json" },
    });
    if (!startRes.ok) {
      const text = await startRes.text();
      console.log(`${label} ❌ Start exam failed (${startRes.status}): ${text.slice(0, 80)}`);
      failed++;
      return;
    }
    const { session } = await startRes.json();
    console.log(`${label} 📝 Started session #${session.id}`);

    // 4. Answer questions (quickly — 1-2 sec per question)
    for (const q of session.questions) {
      const answer = Math.floor(Math.random() * 4);
      const answerRes = await fetch(`${BASE}/exam/session/${session.id}/answer`, {
        method: "POST",
        headers: { Cookie: sessionToken, "Content-Type": "application/json" },
        body: JSON.stringify({ questionIndex: q.index, optionIndex: answer }),
      });
      if (!answerRes.ok) {
        const text = await answerRes.text();
        console.log(`${label} ⚠️ Answer q${q.index} failed: ${text.slice(0, 60)}`);
      }
    }
    console.log(`${label} ✍️ Answered all questions`);

    // 5. Submit
    const submitRes = await fetch(`${BASE}/exam/session/${session.id}/submit`, {
      method: "POST",
      headers: { Cookie: sessionToken },
    });
    if (submitRes.ok) {
      const result = await submitRes.json();
      console.log(`${label} ✅ Submitted — score: ${result.score}/${result.total}`);
      passed++;
    } else {
      const text = await submitRes.text();
      console.log(`${label} ❌ Submit failed (${submitRes.status}): ${text.slice(0, 80)}`);
      failed++;
    }
  } catch (err) {
    console.log(`${label} 💥 Error: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log(`\n🚀 Starting load test: ${STUDENTS} concurrent students\n`);
  const startTime = Date.now();

  // Fire all students concurrently
  const results = await Promise.allSettled(
    Array.from({ length: STUDENTS }, (_, i) => simulateStudent(i))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n📋 Results: ${passed} passed, ${failed} failed in ${elapsed}s`);
  console.log(results.map((r, i) =>
    `  Student ${String(i).padStart(2, "0")}: ${r.status === "fulfilled" ? "✅" : "❌"}`
  ).join("\n"));
  console.log(`\n${passed === STUDENTS ? "🎉 All passed!" : "⚠️ Some failed"}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
