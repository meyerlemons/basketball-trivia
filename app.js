/* ============================================================
   CONFIG — fill these in once you've set up EmailJS (see README)
   ============================================================ */
const CONFIG = {
  EMAILJS_PUBLIC_KEY: "NgYfRHTYNF6_k2OEb",
  EMAILJS_SERVICE_ID: "service_3dswp76",
  EMAILJS_TEMPLATE_ID: "template_ykk7qla",
  QUESTIONS_FILE: "questions.csv",
  PLAYERS_FILE: "players.csv",
  MAX_SUGGESTIONS: 8
};

/* ============================================================
   STATE
   ============================================================ */
let questions = [];   // [{ question, answers: [alt1, alt2...], hint }]
let players = [];     // ["LeBron James", ...]
let currentIndex = 0;
let score = 0;
let hintUsedForCurrent = false;
let results = [];     // [{ question, correctAnswer, userAnswer, status }]
let playerName = "Player";
let emailAlreadySent = false;

/* ============================================================
   CSV PARSING — handles quoted fields and commas inside quotes
   ============================================================ */
function parseCSV(text) {
  const rows = [];
  let field = "", row = [], inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  return rows
    .map(r => r.map(cell => cell.trim()))
    .filter(r => r.length > 0 && r.some(cell => cell !== ""));
}

/* ============================================================
   DATA LOADING
   ============================================================ */
async function loadData() {
  const [qText, pText] = await Promise.all([
    fetch(CONFIG.QUESTIONS_FILE).then(r => {
      if (!r.ok) throw new Error("Couldn't load " + CONFIG.QUESTIONS_FILE);
      return r.text();
    }),
    fetch(CONFIG.PLAYERS_FILE).then(r => {
      if (!r.ok) throw new Error("Couldn't load " + CONFIG.PLAYERS_FILE);
      return r.text();
    })
  ]);

  let qRows = parseCSV(qText);
  if (qRows.length && qRows[0][0].toLowerCase() === "question") qRows = qRows.slice(1);
  questions = qRows.map(r => ({
    question: r[0] || "",
    answers: (r[1] || "").split("|").map(a => a.trim()).filter(Boolean),
    hint: (r[2] || "").trim()
  })).filter(q => q.question && q.answers.length);

  let pRows = parseCSV(pText);
  if (pRows.length && pRows[0][0].toLowerCase() === "player") pRows = pRows.slice(1);
  players = pRows.map(r => r[0]).filter(Boolean);

  if (!questions.length) throw new Error("No questions found in " + CONFIG.QUESTIONS_FILE);
}

/* ============================================================
   HINT GENERATION
   ============================================================ */
function buildHint(q) {
  if (q.hint) return q.hint;
  const primary = q.answers[0];
  return primary
    .split(" ")
    .map(word => (word.length <= 1 ? word : word[0] + "_".repeat(word.length - 1)))
    .join(" ");
}

/* ============================================================
   DOM REFERENCES
   ============================================================ */
const el = id => document.getElementById(id);

const startScreen = el("start-screen");
const quizScreen = el("quiz-screen");
const resultsScreen = el("results-screen");

const playerNameInput = el("player-name-input");
const startBtn = el("start-btn");
const loadError = el("load-error");

const scoreChip = el("score-chip");
const scoreChipValue = el("score-chip-value");

const progressLabel = el("progress-label");
const progressFill = el("progress-fill");
const questionText = el("question-text");
const answerInput = el("answer-input");
const suggestionsEl = el("suggestions");
const feedbackEl = el("feedback");
const hintTextEl = el("hint-text");

const submitBtn = el("submit-btn");
const hintBtn = el("hint-btn");
const skipBtn = el("skip-btn");

const resultsHeading = el("results-heading");
const finalScoreEl = el("final-score");
const emailStatusEl = el("email-status");
const resultsListEl = el("results-list");
const restartBtn = el("restart-btn");

/* ============================================================
   INIT
   ============================================================ */
(async function init() {
  try {
    await loadData();
  } catch (err) {
    loadError.hidden = false;
    loadError.textContent = err.message + " — check that both CSV files are next to index.html.";
    startBtn.disabled = true;
  }
})();

if (window.emailjs && CONFIG.EMAILJS_PUBLIC_KEY && CONFIG.EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
  emailjs.init({ publicKey: CONFIG.EMAILJS_PUBLIC_KEY });
}

/* ============================================================
   START
   ============================================================ */
startBtn.addEventListener("click", () => {
  const typed = playerNameInput.value.trim();
  if (typed) playerName = typed;

  startScreen.hidden = true;
  quizScreen.hidden = false;
  scoreChip.hidden = false;

  currentIndex = 0;
  score = 0;
  results = [];
  renderQuestion();
});

/* ============================================================
   QUIZ RENDERING
   ============================================================ */
function renderQuestion() {
  const q = questions[currentIndex];
  hintUsedForCurrent = false;

  progressLabel.textContent = `Question ${currentIndex + 1} of ${questions.length}`;
  progressFill.style.width = `${(currentIndex / questions.length) * 100}%`;

  questionText.textContent = q.question;
  answerInput.value = "";
  answerInput.disabled = false;
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  hintTextEl.hidden = true;
  hintTextEl.textContent = "";
  hintBtn.disabled = false;
  suggestionsEl.hidden = true;
  suggestionsEl.innerHTML = "";

  updateScoreChip();
  answerInput.focus();
}

function updateScoreChip() {
  scoreChipValue.textContent = formatScore(score);
}

function formatScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/* ============================================================
   AUTOCOMPLETE
   ============================================================ */
answerInput.addEventListener("input", () => {
  const query = answerInput.value.trim().toLowerCase();
  if (!query) {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
    return;
  }

  const matches = players
    .filter(p => p.toLowerCase().includes(query))
    .sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(query) ? 0 : 1;
      const bStarts = b.toLowerCase().startsWith(query) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.localeCompare(b);
    })
    .slice(0, CONFIG.MAX_SUGGESTIONS);

  if (!matches.length) {
    suggestionsEl.hidden = true;
    suggestionsEl.innerHTML = "";
    return;
  }

  suggestionsEl.innerHTML = matches
    .map(name => `<li data-name="${name.replace(/"/g, "&quot;")}">${name}</li>`)
    .join("");
  suggestionsEl.hidden = false;
});

suggestionsEl.addEventListener("mousedown", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  answerInput.value = li.dataset.name;
  suggestionsEl.hidden = true;
  suggestionsEl.innerHTML = "";
  answerInput.focus();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".answer-area")) {
    suggestionsEl.hidden = true;
  }
});

answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleSubmit();
  }
});

/* ============================================================
   ANSWER HANDLING
   ============================================================ */
function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

function isCorrect(q, userAnswer) {
  const normalizedUser = normalize(userAnswer);
  return q.answers.some(a => normalize(a) === normalizedUser);
}

submitBtn.addEventListener("click", handleSubmit);

function handleSubmit() {
  const q = questions[currentIndex];
  const userAnswer = answerInput.value.trim();

  if (!userAnswer) {
    feedbackEl.textContent = "Type an answer, or use Hint / Skip.";
    feedbackEl.className = "feedback incorrect";
    return;
  }

  if (isCorrect(q, userAnswer)) {
    feedbackEl.textContent = hintUsedForCurrent ? "Correct! (half credit for the hint)" : "Correct!";
    feedbackEl.className = "feedback correct";
    finalizeQuestion(hintUsedForCurrent ? "hint" : "correct", userAnswer);
  } else {
    feedbackEl.textContent = "Not quite — try again, grab a hint, or skip.";
    feedbackEl.className = "feedback incorrect";
  }
}

hintBtn.addEventListener("click", () => {
  const q = questions[currentIndex];
  hintUsedForCurrent = true;
  hintTextEl.textContent = "Hint: " + buildHint(q);
  hintTextEl.hidden = false;
  hintBtn.disabled = true;
});

skipBtn.addEventListener("click", () => {
  finalizeQuestion("skipped", null);
});

function finalizeQuestion(status, userAnswer) {
  const q = questions[currentIndex];

  if (status === "correct") score += 1;
  else if (status === "hint") score += 0.5;

  results.push({
    question: q.question,
    correctAnswer: q.answers[0],
    userAnswer: userAnswer,
    status: status
  });

  updateScoreChip();

  const delay = status === "skipped" ? 150 : 700;
  suggestionsEl.hidden = true;
  answerInput.disabled = true;
  submitBtn.disabled = true;
  hintBtn.disabled = true;
  skipBtn.disabled = true;

  setTimeout(() => {
    submitBtn.disabled = false;
    hintBtn.disabled = false;
    skipBtn.disabled = false;
    currentIndex++;
    if (currentIndex < questions.length) {
      renderQuestion();
    } else {
      showResults();
    }
  }, delay);
}

/* ============================================================
   RESULTS
   ============================================================ */
function showResults() {
  quizScreen.hidden = true;
  resultsScreen.hidden = false;
  progressFill.style.width = "100%";

  resultsHeading.textContent = `Nice game, ${playerName}!`;
  finalScoreEl.textContent = `${formatScore(score)} / ${questions.length}`;

  resultsListEl.innerHTML = results.map(r => {
    const isWrong = r.status === "skipped";
    const icon = isWrong ? "✕" : "✓";
    const iconClass = isWrong ? "wrong" : "correct";
    const itemClass = isWrong ? "is-wrong" : "is-correct";
    const answerLine = isWrong
      ? `Skipped — correct answer: ${escapeHtml(r.correctAnswer)}`
      : `Your answer: ${escapeHtml(r.userAnswer)}`;
    const tag = r.status === "hint" ? `<span class="result-tag">used hint · 0.5 pt</span>` : "";

    return `
      <li class="result-item ${itemClass}">
        <span class="result-icon ${iconClass}">${icon}</span>
        <div class="result-body">
          <div class="result-question">${escapeHtml(r.question)}</div>
          <div class="result-answer-line">${answerLine}${tag}</div>
        </div>
      </li>`;
  }).join("");

  sendResultsEmail();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

/* ============================================================
   EMAIL
   ============================================================ */
function buildSummaryText() {
  const lines = results.map((r, i) => {
    const mark = r.status === "skipped" ? "X" : "✓";
    const yourAnswer = r.status === "skipped" ? "(skipped)" : r.userAnswer;
    const note = r.status === "hint" ? " [used hint, 0.5 pt]" : "";
    return `${i + 1}. [${mark}] ${r.question}\n   Your answer: ${yourAnswer}${note}\n   Correct answer: ${r.correctAnswer}`;
  });
  return lines.join("\n\n");
}

function sendResultsEmail() {
  if (emailAlreadySent) return;

  if (!window.emailjs || CONFIG.EMAILJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY") {
    emailStatusEl.textContent = "Email isn't set up yet — see README to enable it.";
    return;
  }

  emailAlreadySent = true;
  emailStatusEl.textContent = "Sending your results…";

  const templateParams = {
    player_name: playerName,
    score: formatScore(score),
    total: questions.length,
    summary: buildSummaryText()
  };

  emailjs.send(CONFIG.EMAILJS_SERVICE_ID, CONFIG.EMAILJS_TEMPLATE_ID, templateParams)
    .then(() => {
      emailStatusEl.textContent = "Results emailed!";
    })
    .catch((err) => {
      console.error("EmailJS error:", err);
      emailStatusEl.textContent = "Couldn't send the results email (see console for details).";
      emailAlreadySent = false;
    });
}

/* ============================================================
   RESTART
   ============================================================ */
restartBtn.addEventListener("click", () => {
  resultsScreen.hidden = true;
  startScreen.hidden = false;
  scoreChip.hidden = true;
  emailAlreadySent = false;
  playerNameInput.value = "";
});
