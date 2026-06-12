/* ============================================================
   STUDIA — script.js
   Preloader · cursor · reveals · magnetic · quiz engine · analysis
   ============================================================ */
"use strict";

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;

/* ============================================================
   1. PRELOADER (counts 0→100, then slides away)
   ============================================================ */
(() => {
  const pre   = $("#preloader");
  const count = $("#preCount");
  const bar   = $("#preBar");
  let n = 0;

  const tick = () => {
    n = Math.min(100, n + Math.ceil(Math.random() * 12));
    count.textContent = String(n).padStart(2, "0");
    bar.style.width = n + "%";
    if (n < 100) {
      setTimeout(tick, 70 + Math.random() * 90);
    } else {
      setTimeout(() => {
        pre.classList.add("is-done");
        document.body.classList.add("is-loaded");
        $(".hero__title").classList.add("lines-in");
        setTimeout(() => pre.remove(), 1100);
      }, 350);
    }
  };

  if (reducedMotion) {
    pre.remove();
    $(".hero__title").classList.add("lines-in");
  } else {
    tick();
  }
})();

/* ============================================================
   2. CUSTOM CURSOR (lerped follow + hover states)
   ============================================================ */
(() => {
  if (isTouch) return;
  const ring = $("#cursor");
  const dot  = $("#cursorDot");
  let mx = innerWidth / 2, my = innerHeight / 2;
  let rx = mx, ry = my;

  addEventListener("mousemove", e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  });
  addEventListener("mousedown", () => ring.classList.add("is-down"));
  addEventListener("mouseup",   () => ring.classList.remove("is-down"));

  const loop = () => {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  };
  loop();

  // hover growth on interactive elements (delegated, works on dynamic els)
  document.addEventListener("mouseover", e => {
    if (e.target.closest("a, button, .option, [data-magnetic]"))
      ring.classList.add("is-hover");
  });
  document.addEventListener("mouseout", e => {
    if (e.target.closest("a, button, .option, [data-magnetic]"))
      ring.classList.remove("is-hover");
  });
})();

/* ============================================================
   3. MAGNETIC ELEMENTS
   ============================================================ */
(() => {
  if (isTouch || reducedMotion) return;
  $$("[data-magnetic]").forEach(el => {
    const strength = 0.35;
    el.addEventListener("mousemove", e => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      el.style.transition = "transform .15s ease-out";
    });
    el.addEventListener("mouseleave", () => {
      el.style.transition = "transform .5s cubic-bezier(.16,1,.3,1)";
      el.style.transform = "";
    });
  });
})();

/* ============================================================
   4. NAV — hide on scroll down, show on scroll up
   ============================================================ */
(() => {
  const nav = $("#nav");
  let lastY = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    nav.classList.toggle("is-hidden", y > 300 && y > lastY);
    lastY = y;
  }, { passive: true });
})();

/* ============================================================
   5. SCROLL REVEALS + COUNTER STATS
   ============================================================ */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add("is-visible", "lines-in");
    revealObserver.unobserve(en.target);
  });
}, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

$$(".reveal, .cta__title").forEach(el => revealObserver.observe(el));

// animated number counters
const countObserver = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    const el = en.target;
    const target = +el.dataset.count;
    const dur = 1600;
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    countObserver.unobserve(el);
  });
}, { threshold: 0.6 });

$$("[data-count]").forEach(el => countObserver.observe(el));

/* ============================================================
   6. TILT CARDS
   ============================================================ */
(() => {
  if (isTouch || reducedMotion) return;
  $$("[data-tilt]").forEach(card => {
    card.addEventListener("mousemove", e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width  - 0.5;
      const py = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform =
        `perspective(800px) rotateX(${-py * 6}deg) rotateY(${px * 6}deg) translateY(-4px)`;
    });
    card.addEventListener("mouseleave", () => { card.style.transform = ""; });
  });
})();

/* ============================================================
   7. QUESTION BANK
   ============================================================ */
const QUESTION_BANK = {
  math: {
    label: "Mathematics",
    questions: [
      { q: "What is the value of 7 × 8 − 6?", topic: "Arithmetic",
        options: ["50", "62", "48", "56"], answer: 0 },
      { q: "Solve for x:  2x + 5 = 17", topic: "Algebra",
        options: ["x = 5", "x = 6", "x = 7", "x = 11"], answer: 1 },
      { q: "The sum of interior angles of a triangle is…", topic: "Geometry",
        options: ["90°", "180°", "270°", "360°"], answer: 1 },
      { q: "What is 25% of 240?", topic: "Arithmetic",
        options: ["48", "54", "60", "64"], answer: 2 },
      { q: "If x² = 81, the positive value of x is…", topic: "Algebra",
        options: ["8", "9", "12", "27"], answer: 1 },
      { q: "A circle's circumference is calculated with…", topic: "Geometry",
        options: ["πr²", "2πr", "πd²", "4πr"], answer: 1 },
    ],
  },
  science: {
    label: "Science",
    questions: [
      { q: "What force pulls objects toward Earth's centre?", topic: "Physics",
        options: ["Friction", "Magnetism", "Gravity", "Inertia"], answer: 2 },
      { q: "Water's chemical formula is…", topic: "Chemistry",
        options: ["CO₂", "H₂O", "O₂", "NaCl"], answer: 1 },
      { q: "Which organelle is the powerhouse of the cell?", topic: "Biology",
        options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"], answer: 2 },
      { q: "Light travels fastest through…", topic: "Physics",
        options: ["Water", "Glass", "Air", "A vacuum"], answer: 3 },
      { q: "The pH of a neutral solution is…", topic: "Chemistry",
        options: ["0", "7", "10", "14"], answer: 1 },
      { q: "Plants make food through a process called…", topic: "Biology",
        options: ["Respiration", "Photosynthesis", "Digestion", "Fermentation"], answer: 1 },
    ],
  },
  english: {
    label: "English",
    questions: [
      { q: "Which word is a synonym of “rapid”?", topic: "Vocabulary",
        options: ["Sluggish", "Swift", "Steady", "Late"], answer: 1 },
      { q: "Choose the grammatically correct sentence.", topic: "Grammar",
        options: ["She don't like tea.", "She doesn't likes tea.",
                  "She doesn't like tea.", "She not like tea."], answer: 2 },
            { q: "“The wind whispered through the trees” is an example of…", topic: "Literary Devices",
        options: ["Simile", "Personification", "Hyperbole", "Alliteration"], answer: 1 },
      { q: "The plural of “child” is…", topic: "Grammar",
        options: ["Childs", "Childes", "Children", "Childrens"], answer: 2 },
      { q: "An antonym of “generous” is…", topic: "Vocabulary",
        options: ["Stingy", "Kind", "Wealthy", "Caring"], answer: 0 },
      { q: "Which of these is a complete sentence?", topic: "Grammar",
        options: ["Running down the street.", "Because it was raining.",
                  "The dog barked loudly.", "After the long meeting."], answer: 2 },
    ],
  },
  history: {
    label: "History",
    questions: [
      { q: "The Great Wall is located in which country?", topic: "World History",
        options: ["Japan", "India", "China", "Mongolia"], answer: 2 },
      { q: "World War II ended in which year?", topic: "Modern History",
        options: ["1943", "1944", "1945", "1946"], answer: 2 },
      { q: "The ancient pyramids of Giza were built by the…", topic: "Ancient History",
        options: ["Romans", "Greeks", "Mayans", "Egyptians"], answer: 3 },
      { q: "Who was the first person to walk on the Moon?", topic: "Modern History",
        options: ["Yuri Gagarin", "Neil Armstrong", "Buzz Aldrin", "John Glenn"], answer: 1 },
      { q: "The Renaissance began in which country?", topic: "World History",
        options: ["France", "England", "Italy", "Spain"], answer: 2 },
      { q: "Gladiators fought in which famous Roman arena?", topic: "Ancient History",
        options: ["The Parthenon", "The Colosseum", "The Forum", "The Pantheon"], answer: 1 },
    ],
  },
};

/* ============================================================
   8. QUIZ ENGINE
   ============================================================ */
const Quiz = (() => {
  const SECONDS_PER_Q = 20;
  const RING_LEN = 119.4; // matches CSS stroke-dasharray

  // elements
  const overlay   = $("#quiz");
  const elSubject = $("#quizSubject");
  const elCount   = $("#quizCount");
  const elQ       = $("#quizQuestion");
  const elOpts    = $("#quizOptions");
  const elBody    = $("#quizBody");
  const elBar     = $("#quizBar");
  const elTime    = $("#timerText");
  const elRing    = $("#timerRing");

  // state
  let subjectKey, questions, index, results, timerId, timeLeft, locked;

  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* ---------- timer ---------- */
  function startTimer() {
    stopTimer();
    timeLeft = SECONDS_PER_Q;
    paintTimer();
    timerId = setInterval(() => {
      timeLeft--;
      paintTimer();
      if (timeLeft <= 0) {
        stopTimer();
        lockAnswer(-1); // timed out = no answer
      }
    }, 1000);
  }
  function stopTimer() { clearInterval(timerId); }
  function paintTimer() {
    elTime.textContent = timeLeft;
    elRing.style.strokeDashoffset = RING_LEN * (1 - timeLeft / SECONDS_PER_Q);
    elRing.classList.toggle("is-low", timeLeft <= 5);
  }

  /* ---------- render one question ---------- */
  function renderQuestion() {
    const item = questions[index];
    locked = false;

    elCount.textContent =
      `Question ${String(index + 1).padStart(2, "0")} / ${String(questions.length).padStart(2, "0")}`;
    elQ.textContent = item.q;
    elBar.style.width = `${(index / questions.length) * 100}%`;

    elOpts.innerHTML = "";
    elOpts.classList.remove("is-locked");
    const keys = ["A", "B", "C", "D"];

    item.shuffled.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.innerHTML = `<kbd>${keys[i]}</kbd><span>${opt.text}</span>`;
      btn.addEventListener("click", () => lockAnswer(i));
      elOpts.appendChild(btn);
    });

    elBody.classList.remove("is-switching");
    startTimer();
  }

  /* ---------- answer handling ---------- */
  function lockAnswer(choiceIndex) {
    if (locked) return;
    locked = true;
    stopTimer();
    elOpts.classList.add("is-locked");

    const item = questions[index];
    const correctIdx = item.shuffled.findIndex(o => o.correct);
    const buttons = $$(".option", elOpts);
    const isRight = choiceIndex === correctIdx;

    buttons.forEach((btn, i) => {
      if (i === correctIdx) btn.classList.add("is-correct");
      else if (i === choiceIndex) btn.classList.add("is-wrong");
      else btn.classList.add("is-dim");
    });

    results.push({
      question: item.q,
      topic: item.topic,
      correctText: item.shuffled[correctIdx].text,
      chosenText: choiceIndex >= 0 ? item.shuffled[choiceIndex].text : null,
      right: isRight,
      timeUsed: SECONDS_PER_Q - timeLeft,
    });

    // brief pause to show feedback, then advance
    setTimeout(() => {
      elBody.classList.add("is-switching");
      setTimeout(() => {
        index++;
        if (index < questions.length) renderQuestion();
        else finish();
      }, 380);
    }, isRight ? 750 : 1300);
  }

  /* ---------- lifecycle ---------- */
  function start(key) {
    subjectKey = key;
    const bank = QUESTION_BANK[key];
    if (!bank) return;

    // shuffle questions AND options (storing which option is correct)
    questions = shuffle(bank.questions).map(q => ({
      ...q,
      shuffled: shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer }))),
    }));

    index = 0;
    results = [];

    elSubject.textContent = bank.label;
    overlay.hidden = false;
    document.body.classList.add("quiz-open");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.classList.add("is-open");
      renderQuestion();
    }));
  }

  function quit() {
    stopTimer();
    overlay.classList.remove("is-open");
    document.body.classList.remove("quiz-open");
    setTimeout(() => { overlay.hidden = true; }, 500);
  }

  function finish() {
    elBar.style.width = "100%";
    quit();
    Analysis.show(QUESTION_BANK[subjectKey].label, results, subjectKey);
  }

  /* ---------- keyboard support ---------- */
  addEventListener("keydown", e => {
    if (overlay.hidden) return;
    if (e.key === "Escape") return quit();
    const map = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
    const idx = map[e.key.toLowerCase()];
    if (idx !== undefined && !locked) {
      const btn = $$(".option", elOpts)[idx];
      if (btn) btn.click();
    }
  });

  $("#quizQuit").addEventListener("click", quit);

  return { start };
})();

/* ============================================================
   9. ANALYSIS / RESULTS
   ============================================================ */
const Analysis = (() => {
  const DONUT_LEN = 414.7; // matches CSS stroke-dasharray

  const section    = $("#results");
  const elSubject  = $("#resSubject");
  const elPct      = $("#resPct");
  const elDonut    = $("#donutRing");
  const elScore    = $("#resScore");
  const elTime     = $("#resTime");
  const elBest     = $("#resBest");
  const elWorst    = $("#resWorst");
  const elChart    = $("#resChart");
  const elReview   = $("#resReview");
  const btnRetry   = $("#resRetry");

  let lastSubjectKey = null;

  function show(label, results, subjectKey) {
    lastSubjectKey = subjectKey;
    const total   = results.length;
    const correct = results.filter(r => r.right).length;
    const pct     = Math.round((correct / total) * 100);
    const avgTime = (results.reduce((s, r) => s + r.timeUsed, 0) / total).toFixed(1);

    /* --- topic strengths --- */
    const topics = {};
    results.forEach(r => {
      topics[r.topic] ??= { right: 0, total: 0 };
      topics[r.topic].total++;
      if (r.right) topics[r.topic].right++;
    });
    const ranked = Object.entries(topics)
      .map(([name, t]) => ({ name, score: t.right / t.total }))
      .sort((a, b) => b.score - a.score);

    /* --- header & stat cards --- */
    elSubject.textContent = label;
    elScore.textContent = `${correct} / ${total}`;
    elTime.textContent  = `${avgTime}s`;
    elBest.textContent  = ranked[0].name;
    elWorst.textContent = ranked[ranked.length - 1].name;

    /* --- donut (animate % count + ring) --- */
    elDonut.style.strokeDashoffset = DONUT_LEN;
    let shown = 0;
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / 1400);
      shown = Math.round(pct * (1 - Math.pow(1 - p, 3)));
      elPct.textContent = shown + "%";
      if (p < 1) requestAnimationFrame(tick);
    };

    /* --- per-question time bar chart --- */
    elChart.innerHTML = "";
    const maxT = Math.max(...results.map(r => r.timeUsed), 1);
    results.forEach((r, i) => {
      const bar = document.createElement("div");
      bar.className = "bar" + (r.right ? "" : " is-wrong");
      bar.style.height = `${Math.max(6, (r.timeUsed / maxT) * 100)}%`;
      bar.style.animationDelay = `${0.3 + i * 0.07}s`;
      bar.innerHTML = `<span>${r.timeUsed}s</span>`;
      bar.title = `Q${i + 1}: ${r.timeUsed}s — ${r.right ? "correct" : "wrong"}`;
      elChart.appendChild(bar);
    });

    /* --- review list --- */
    elReview.innerHTML = results.map((r, i) => `
      <div class="review-item ${r.right ? "is-right" : "is-wrong"}">
                <div class="review-item__mark">${r.right ? "✓" : "✗"}</div>
        <div>
          <p class="review-item__q">${i + 1}. ${r.question}</p>
          <p class="review-item__a">
            ${r.right
              ? `Answered: <b>${r.correctText}</b>`
              : r.chosenText
                ? `You chose <s>${r.chosenText}</s> — correct: <b>${r.correctText}</b>`
                : `Timed out — correct: <b>${r.correctText}</b>`}
          </p>
          <span class="review-item__topic">${r.topic}</span>
        </div>
      </div>
    `).join("");

    /* --- reveal section & kick off animations --- */
    section.hidden = false;
    section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });

    setTimeout(() => {
      elDonut.style.strokeDashoffset = DONUT_LEN * (1 - pct / 100);
      requestAnimationFrame(tick);
    }, 400);
  }

  /* --- retry the same subject --- */
  btnRetry.addEventListener("click", () => {
    if (lastSubjectKey) Quiz.start(lastSubjectKey);
  });

  return { show };
})();

/* ============================================================
   10. WIRE UP SUBJECT BUTTONS
   ============================================================ */
$$("[data-subject]").forEach(btn => {
  btn.addEventListener("click", () => Quiz.start(btn.dataset.subject));
});

/* ============================================================
   11. SMOOTH ANCHOR SCROLLING (respects fixed nav)
   ============================================================ */
$$('a[href^="#"]').forEach(link => {
  link.addEventListener("click", e => {
    const target = $(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  });
});