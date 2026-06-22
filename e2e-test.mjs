/**
 * Testify End-to-End Test — runs through the full flow:
 * 1. Admin: login → create paper with 3 questions → verify it shows
 * 2. Student: login → see available papers → start exam → answer → submit → verify score
 */

const BASE = "http://localhost:4000";

function cookie(res) {
  const c = res.headers.get("set-cookie") || "";
  return c.split(";")[0] || "";
}

let passed = 0;
let failed = 0;

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message}`);
    failed++;
  }
}

async function main() {
  console.log("\n🚀 Full system test\n");

  let adminCookie = "";
  let studentCookie = "";
  let paperId = 0;
  let sessionId = 0;

  // ── 1. Admin login ──
  await test("Admin login", async () => {
    const res = await fetch(`${BASE}/admin/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sathvik@testify.app", password: "password123" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.admin?.email) throw new Error("No admin in response");
    adminCookie = cookie(res);
    if (!adminCookie) throw new Error("No set-cookie header");
  });

  // ── 2. Admin: GET /admin/auth/me (session valid) ──
  await test("Admin session persists", async () => {
    const res = await fetch(`${BASE}/admin/auth/me`, { headers: { Cookie: adminCookie } });
    const body = await res.json();
    if (!body.admin) throw new Error("No admin in me response");
  });

  // ── 3. Admin: list papers (should see at least the seeded one) ──
  await test("Admin lists papers", async () => {
    const res = await fetch(`${BASE}/admin/sets`, { headers: { Cookie: adminCookie } });
    const body = await res.json();
    if (!Array.isArray(body)) throw new Error("Expected array of sets");
    if (body.length === 0) throw new Error("No papers found");
    console.log(`     Found ${body.length} paper(s)`);
  });

  // ── 4. Admin: create a paper with 3 questions ──
  await test("Admin creates paper with 3 questions", async () => {
    const res = await fetch(`${BASE}/admin/sets`, {
      method: "POST", headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "E2E Test Paper " + Date.now(),
        subject: "Physics",
        pattern: "JEE Main",
        kind: "PRACTICE",
        exam: "JEE_MAIN",
        timeLimit: 600,
        attemptsAllowed: 99,
        questions: [
          { type: "mcq", text: "What is the speed of light in vacuum (m/s)?", options: ["3×10⁶", "3×10⁷", "3×10⁸", "3×10⁹"], correctAnswer: "C", topic: "Optics", subject: "Physics", difficulty: 3, positiveMarks: 4, negativeMarks: 1 },
          { type: "mcq", text: "Newton's first law is also known as:", options: ["Law of inertia", "Law of acceleration", "Action-reaction", "Gravitation"], correctAnswer: "A", topic: "Mechanics", subject: "Physics", difficulty: 2, positiveMarks: 4, negativeMarks: 1 },
          { type: "numeric", text: "How many seconds in 1 hour?", correctAnswer: "3600", topic: "General", subject: "Physics", difficulty: 1, positiveMarks: 4, negativeMarks: 0 },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    const body = await res.json();
    paperId = body.set?.id;
    if (!paperId) throw new Error("No set.id in response");
    console.log(`     Created paper #${paperId}`);
  });

  // ── 5. Admin: verify paper appears in list ──
  await test("New paper appears in list", async () => {
    const res = await fetch(`${BASE}/admin/sets`, { headers: { Cookie: adminCookie } });
    const body = await res.json();
    const found = body.find(s => s.id === paperId);
    if (!found) throw new Error("Paper not found in list");
    if (found.questionCount !== 3) throw new Error(`Expected 3 questions, got ${found.questionCount}`);
  });

  // ── 6. Admin: add a 4th question to the paper ──
  await test("Admin adds question to existing paper", async () => {
    const res = await fetch(`${BASE}/admin/questions`, {
      method: "POST", headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        setId: paperId, type: "mcq",
        text: "Which planet is closest to the Sun?",
        options: ["Venus", "Earth", "Mercury", "Mars"],
        correctAnswer: "C", topic: "Astronomy", subject: "Physics",
        difficulty: 2, positiveMarks: 4, negativeMarks: 1,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    const body = await res.json();
    if (!body.id) throw new Error("No question id returned");
    console.log(`     Added question #${body.id}`);
  });

  // ── 7. Admin: verify paper now has 4 questions ──
  await test("Paper now has 4 questions", async () => {
    const res = await fetch(`${BASE}/admin/sets/${paperId}`, { headers: { Cookie: adminCookie } });
    const body = await res.json();
    if (!body.questions) throw new Error("No questions in response");
    if (body.questions.length !== 4) throw new Error(`Expected 4 questions, got ${body.questions.length}`);
  });

  // ── 8. Admin: edit question (change text) ──
  await test("Admin edits a question", async () => {
    // Get the questions first
    const res = await fetch(`${BASE}/admin/sets/${paperId}`, { headers: { Cookie: adminCookie } });
    const body = await res.json();
    const q = body.questions[0];
    const editRes = await fetch(`${BASE}/admin/questions/${q.id}`, {
      method: "PUT", headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: 5 }),
    });
    if (!editRes.ok) throw new Error(`HTTP ${editRes.status}`);
  });

  // ── 9. Student: login ──
  await test("Student login", async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "loadtest19@testify.app", password: "password123" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    if (!body.user?.email) throw new Error("No user in response");
    studentCookie = cookie(res);
    if (!studentCookie) throw new Error("No set-cookie header");
  });

  // ── 10. Student: fetch available sets ──
  await test("Student sees available papers", async () => {
    const res = await fetch(`${BASE}/sets`, { headers: { Cookie: studentCookie } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const found = body.find(s => s.id === paperId);
    if (!found) throw new Error("New paper not visible to student");
    if (found.questionCount !== 4) throw new Error(`Expected 4 questions, got ${found.questionCount}`);
  });

  // ── 10. Student: fetch dashboard stats ──
  await test("Student dashboard stats load", async () => {
    const res = await fetch(`${BASE}/student/stats`, { headers: { Cookie: studentCookie } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (typeof body.totalSessions !== "number") throw new Error(`Expected totalSessions number, got ${JSON.stringify(body).slice(0, 80)}`);
  });

  // ── 11. Student: start the exam (POST /exam/start with setId in body) ──
  let questionIds = [];
  await test("Student starts exam", async () => {
    const res = await fetch(`${BASE}/exam/start`, {
      method: "POST", headers: { Cookie: studentCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ setId: paperId }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
    }
    const body = await res.json();
    sessionId = body.sessionId;
    if (!sessionId) throw new Error("No sessionId in response: " + JSON.stringify(body).slice(0, 100));
    questionIds = (body.questions || []).map(q => q.id);
    if (questionIds.length === 0) throw new Error("No questions in start response");
    console.log(`     Session #${sessionId} created (${questionIds.length} questions, ids: ${questionIds.join(",")})`);
  });

  // ── 14. Student: answer all 4 questions ──
  await test("Student answers all questions", async () => {
    if (questionIds.length === 0) throw new Error("No question IDs from start response");
    console.log(`     Question IDs: ${questionIds.join(", ")}`);

    for (let i = 0; i < questionIds.length; i++) {
      const answer = String(i % 4); // selectedOption as string: "0", "1", "2", "3"
      const res = await fetch(`${BASE}/exam/${sessionId}/answer`, {
        method: "POST", headers: { Cookie: studentCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: questionIds[i], selectedOption: answer }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Question ${i} (id=${questionIds[i]}): HTTP ${res.status}: ${err.slice(0, 100)}`);
      }
    }
  });

  // ── 15. Student: submit exam ──
  await test("Student submits exam", async () => {
    const res = await fetch(`${BASE}/exam/${sessionId}/end`, {
      method: "POST", headers: { Cookie: studentCookie },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    console.log(`     Score: ${body.totalScore}/${body.maxPossible} (${((body.totalScore/body.maxPossible)*100).toFixed(0)}%)`);
    if (typeof body.totalScore !== "number") throw new Error("No score in response");
  });

  // ── 16. Student: view history (should show the session) ──
  await test("Student sees session in history", async () => {
    const res = await fetch(`${BASE}/student/history`, { headers: { Cookie: studentCookie } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const found = (body.sessions || []).find(s => s.id === sessionId);
    if (!found) throw new Error("Session not in history");
    if (!found.completed) throw new Error("Session not marked completed");
  });

  // ── 17. Student: view insights ──
  await test("Student insights load", async () => {
    const res = await fetch(`${BASE}/student/insights`, { headers: { Cookie: studentCookie } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.summary && !body.weakTopics) {
      // insights might be empty for new users — that's fine
    }
  });

  // ── 18. Verify old admin session is destroyed on re-login ──
  await test("Old admin session destroyed on re-login", async () => {
    // Login again with same admin
    const res = await fetch(`${BASE}/admin/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sathvik@testify.app", password: "password123" }),
    });
    if (!res.ok) throw new Error(`Re-login failed: HTTP ${res.status}`);
    const newCookie = cookie(res);
    // Old cookie should now be invalid
    const meRes = await fetch(`${BASE}/admin/auth/me`, { headers: { Cookie: adminCookie } });
    const meBody = await meRes.json();
    if (meBody.admin) throw new Error("Old admin session still valid after re-login");
    adminCookie = newCookie; // use the new cookie going forward
  });

  // ── 19. Admin: delete the test question ──
  await test("Admin deletes question", async () => {
    const res = await fetch(`${BASE}/admin/sets/${paperId}`, { headers: { Cookie: adminCookie } });
    const body = await res.json();
    const q = body.questions[body.questions.length - 1]; // last question
    const delRes = await fetch(`${BASE}/admin/questions/${q.id}`, {
      method: "DELETE", headers: { Cookie: adminCookie },
    });
    if (!delRes.ok) throw new Error(`HTTP ${delRes.status}`);
  });

  // ── 20. Admin: verify paper updated to 3 questions ──
  await test("Paper updated to 3 questions after delete", async () => {
    const res = await fetch(`${BASE}/admin/sets/${paperId}`, { headers: { Cookie: adminCookie } });
    const body = await res.json();
    if (body.questions.length !== 3) throw new Error(`Expected 3 questions, got ${body.questions.length}`);
  });

  // ── Summary ──
  console.log(`\n📋 ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
