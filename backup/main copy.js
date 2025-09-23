let sentences = { simple: [], medium: [], hard: [] };
let sequenceSets = [];
let currentIdx = 0;
let wordTimer = 1000;
let timerId = null;

// Load sentences.json
fetch("sentences.json")
  .then(res => res.json())
  .then(data => {
    sentences = data;
    console.log("✅ Sentences loaded", sentences);
  })
  .catch(err => console.error("Error loading JSON", err));

const flashWord = document.getElementById("flashWord");
const timerInput = document.getElementById("timer");
const timerValue = document.getElementById("timerValue");
const startBtn = document.getElementById("startSequence");
const repeatBtn = document.getElementById("repeatSequence");
const showFullToggle = document.getElementById("showFullSentenceToggle");
const showFullSequenceBtn = document.getElementById("showFullSequence");
const numSentencesInput = document.getElementById("numSentences");
const difficultySelect = document.getElementById("difficulty");

timerInput.addEventListener("input", () => {
  wordTimer = parseInt(timerInput.value);
  timerValue.textContent = wordTimer;
});

function normalizeSentence(item) {
  if (Array.isArray(item)) return item;
  if (typeof item === "string") return item.split(/\s+/);
  return [];
}

function generateSequence() {
  sequenceSets = [];
  currentIdx = 0;
  const numSentences = parseInt(numSentencesInput.value);
  const difficulty = difficultySelect.value;
  let pool = sentences[difficulty] || [];
  if (!pool.length) pool = sentences.simple || [];

  for (let i = 0; i < numSentences; i++) {
    let item = pool[Math.floor(Math.random() * pool.length)];
    sequenceSets.push(normalizeSentence(item));
  }
  playSentence();
}

function playSentence() {
  if (currentIdx >= sequenceSets.length) {
    flashWord.textContent = "";
    return;
  }
  const words = sequenceSets[currentIdx];
  if (showFullToggle.checked) {
    flashWord.textContent = words.join(" ");
    currentIdx++;
  } else {
    let wi = 0;
    function showWord() {
      if (wi >= words.length) {
        currentIdx++;
        playSentence();
        return;
      }
      flashWord.textContent = words[wi];
      wi++;
      timerId = setTimeout(showWord, wordTimer);
    }
    showWord();
  }
}

// Buttons
startBtn.addEventListener("click", generateSequence);
repeatBtn.addEventListener("click", () => {
  if (currentIdx > 0) currentIdx--;
  playSentence();
});
showFullSequenceBtn.addEventListener("click", () => {
  const fullSequenceDiv = document.getElementById("fullSequence");
  fullSequenceDiv.innerHTML = "";
  sequenceSets.forEach(sentence => {
    const p = document.createElement("p");
    p.textContent = sentence.join(" ");
    fullSequenceDiv.appendChild(p);
  });
  fullSequenceDiv.classList.remove("hidden");
});

// ----------------- Recall / Partial Recall with fuzzy scoring -----------------
function cleanWord(word) {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
    }
  }
  return dp[a.length][b.length];
}

function scoreRecall(input, refSeq) {
  const ignore = ["the", "a", "an", "is", "to", "and", "with", "of", "on", "in"];
  const inputWords = input.split(/\s+/).map(cleanWord).filter(w => w && !ignore.includes(w));
  const refWords = refSeq.flat().map(cleanWord);

  let matched = [], mistakes = [];
  inputWords.forEach(word => {
    const found = refWords.find(rw => {
      if (rw === word) return true;
      const maxDist = word.length >= 5 ? 2 : 1;
      return levenshtein(rw, word) <= maxDist;
    });
    if (found) matched.push(word); else mistakes.push(word);
  });

  return { matched, mistakes };
}

document.getElementById("checkRecall").addEventListener("click", () => {
  const res = scoreRecall(document.getElementById("recallInput").value, sequenceSets);
  document.getElementById("recallResult").textContent =
    `Matched: ${res.matched.length}/${sequenceSets.flat().length}`;
  document.getElementById("recallMistakes").textContent = res.mistakes.join(", ");
});

document.getElementById("checkPartial").addEventListener("click", () => {
  let lastN = parseInt(document.getElementById("lastN").value);
  lastN = Math.min(lastN, sequenceSets.length);
  const subset = sequenceSets.slice(-lastN);
  const res = scoreRecall(document.getElementById("partialRecallInput").value, subset);
  document.getElementById("partialRecallResult").textContent =
    `Matched: ${res.matched.length}/${subset.flat().length}`;
  document.getElementById("partialMistakes").textContent = res.mistakes.join(", ");
});

document.getElementById("resetPartial").addEventListener("click", () => {
  document.getElementById("partialRecallInput").value = "";
  document.getElementById("partialRecallResult").textContent = "";
  document.getElementById("partialMistakes").textContent = "";
});
