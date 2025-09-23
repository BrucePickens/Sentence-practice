// ----------------------------
// Globals
// ----------------------------
let sentences = { simple: [], medium: [], hard: [] };
let sequenceSets = [];           // array of sentences; each is array of words
let currentIdx = 0;
let lastShownWords = [];         // track the last full sentence shown
let wordTimer = 1000;

// DOM
const flashWord = document.getElementById("flashWord");
const timerInput = document.getElementById("timer");
const timerValue = document.getElementById("timerValue");
const showFullToggle = document.getElementById("showFullToggle");
const speechToggle = document.getElementById("speechToggle");
const recallInput = document.getElementById("recallInput");
const partialInput = document.getElementById("partialRecallInput");

// Default categories
const DEFAULT_CATEGORIES = ["People", "Objects", "Places", "Events", "Actions"];

// Memory notes storage
let memoryNotes = JSON.parse(localStorage.getItem("memoryNotes") || "{}");
function ensureDefaultCategories() {
  if (!memoryNotes || typeof memoryNotes !== "object") memoryNotes = {};
  DEFAULT_CATEGORIES.forEach(cat => {
    if (!memoryNotes[cat]) memoryNotes[cat] = [];
  });
  saveNotes();
}
ensureDefaultCategories();

// ----------------------------
// Load Sentences
// ----------------------------
fetch("sentences.json")
  .then(res => res.json())
  .then(data => { sentences = data; })
  .catch(err => console.error("❌ Error loading JSON", err));

// ----------------------------
// Speech
// ----------------------------
function speak(text) {
  if (!speechToggle.checked) return;
  if (!("speechSynthesis" in window)) return;
  const warmup = new SpeechSynthesisUtterance("Next sentence.");
  const utter = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(warmup);
  window.speechSynthesis.speak(utter);
}

// ----------------------------
// Helpers
// ----------------------------
function cleanWordForKey(w) { return (w || "").replace(/[^\w]/g, ""); }
function appendNoteToText(originalWord, desc) {
  const m = originalWord.match(/^(.*?)([.!?,;:]+)$/);
  if (m) return `${m[1]} (${desc})${m[2]}`;
  return `${originalWord} (${desc})`;
}
function getDescription(wordKey) {
  const keyLower = (wordKey || "").toLowerCase();
  for (const cat in memoryNotes) {
    const found = memoryNotes[cat].find(n => (n.word || "").toLowerCase() === keyLower);
    if (found) return found.desc;
  }
  return null;
}

// ----------------------------
// Sequence generation/playback
// ----------------------------
function generateSequence() {
  const num = parseInt(document.getElementById("numSentences").value);
  const diff = document.getElementById("difficulty").value;

  sequenceSets = [];
  for (let i = 0; i < num; i++) {
    const pool = sentences[diff];
    if (!pool || pool.length === 0) continue;
    const sent = pool[Math.floor(Math.random() * pool.length)];
    sequenceSets.push(sent.split(/\s+/)); // keep punctuation on tokens
  }
  currentIdx = 0;

  // Clear recall UI
  recallInput.value = "";
  partialInput.value = "";
  document.getElementById("recallResult").textContent = "";
  document.getElementById("recallMistakes").textContent = "";
  document.getElementById("partialResult").textContent = "";
  document.getElementById("partialMistakes").textContent = "";

  playSentence();
}

function renderSentence(words) {
  // Append words into flashWord (do not clear here; caller controls clearing)
  words.forEach(word => {
    const key = cleanWordForKey(word);
    const span = document.createElement("span");
    span.className = "sequence-word";
    const desc = getDescription(key);
    span.textContent = desc ? appendNoteToText(word, desc) : word;
    if (desc) span.classList.add("with-note");
    span.addEventListener("click", () => openDescriptionEditor(key, span, word));
    flashWord.appendChild(span);
    flashWord.append(" ");
  });
}

function playSentence() {
  if (currentIdx >= sequenceSets.length) { flashWord.textContent = ""; return; }
  const words = sequenceSets[currentIdx];

  // Remember the sentence we’re about to show (so “Show Sequence” opens this one)
  lastShownWords = words.slice();

  if (showFullToggle.checked) {
    flashWord.innerHTML = "";
    renderSentence(words);
    speak(words.join(" "));
    currentIdx++;
    setTimeout(playSentence, wordTimer);
  } else {
    let wi = 0;
    const tick = () => {
      if (wi >= words.length) {
        currentIdx++;
        setTimeout(playSentence, wordTimer);
        return;
      }
      flashWord.innerHTML = "";
      renderSentence([words[wi]]);
      speak(words[wi]);
      wi++;
      setTimeout(tick, wordTimer);
    };
    tick();
  }
}

// Show the last sentence that was posted
document.getElementById("showSequence").addEventListener("click", () => {
  flashWord.innerHTML = "";
  if (lastShownWords.length) {
    renderSentence(lastShownWords);
  } else if (sequenceSets.length) {
    // fallback: show the last in the current set
    renderSentence(sequenceSets[sequenceSets.length - 1]);
  } else {
    flashWord.textContent = "No sentence to show yet.";
  }
});

// ----------------------------
// Fuzzy scoring
// ----------------------------
function normalizeToken(w) { return (w || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
      else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}
function allowedDistance(len) { return len <= 4 ? 1 : len <= 7 ? 2 : 3; }

function scoreRecall(input, refSeq) {
  const inputWords = (input || "").split(/\s+/).map(normalizeToken).filter(Boolean);
  const refWords = refSeq.map(s => s.map(normalizeToken).filter(Boolean));
  const flatRef = refWords.flat();

  let matched = 0, mistakes = [];
  inputWords.forEach(word => {
    const candidates = new Set([word, word.replace(/s$/, ""), word + "s"]);
    let ok = false;
    for (const cand of candidates) {
      if (flatRef.includes(cand)) { ok = true; break; }
      const distOk = flatRef.some(rw => levenshtein(rw, cand) <= allowedDistance(Math.max(rw.length, cand.length)));
      if (distOk) { ok = true; break; }
    }
    if (ok) matched++; else mistakes.push(word);
  });
  if (matched > flatRef.length) matched = flatRef.length; // clamp
  return { matched, mistakes, total: flatRef.length };
}

// Full recall
document.getElementById("checkRecall").addEventListener("click", () => {
  const res = scoreRecall(recallInput.value, sequenceSets);
  document.getElementById("recallResult").textContent = `Matched: ${res.matched}/${res.total}`;
  document.getElementById("recallMistakes").textContent = res.mistakes.join(", ");
});

// Partial recall: EXACTLY last N sentences
document.getElementById("checkPartial").addEventListener("click", () => {
  let lastN = parseInt(document.getElementById("lastN").value);
  if (Number.isNaN(lastN) || lastN < 1) lastN = 1;
  lastN = Math.min(lastN, sequenceSets.length);
  const subset = sequenceSets.slice(-lastN);
  const res = scoreRecall(partialInput.value, subset);
  document.getElementById("partialResult").textContent = `Matched: ${res.matched}/${res.total}`;
  document.getElementById("partialMistakes").textContent = res.mistakes.join(", ");
});
document.getElementById("resetPartial").addEventListener("click", () => {
  partialInput.value = "";
  document.getElementById("partialResult").textContent = "";
  document.getElementById("partialMistakes").textContent = "";
});

// Enter → submit (without Shift)
[recallInput, partialInput].forEach(el => {
  el.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (el.id === "recallInput") document.getElementById("checkRecall").click();
      else document.getElementById("checkPartial").click();
    }
  });
});

// Auto-expand textareas
function autoExpand(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
[recallInput, partialInput].forEach(el => el.addEventListener("input", () => autoExpand(el)));

// ----------------------------
// Memory notes UI
// ----------------------------
const memoryHeader = document.getElementById("memoryHeader");
const memoryContent = document.getElementById("memoryContent");
const categoriesDiv = document.getElementById("categories");
const newCategoryInput = document.getElementById("newCategory");
const addCategoryBtn = document.getElementById("addCategory");

const entryCategory = document.getElementById("entryCategory");
const entryWord = document.getElementById("entryWord");
const entryDesc = document.getElementById("entryDesc");
const addEntryBtn = document.getElementById("addEntryBtn");

memoryHeader.addEventListener("click", () => {
  const open = memoryContent.style.display !== "none";
  memoryContent.style.display = open ? "none" : "block";
  memoryHeader.textContent = open ? "Memory Notes ▼" : "Memory Notes ▲";
});

function saveNotes() { localStorage.setItem("memoryNotes", JSON.stringify(memoryNotes)); }

function renderCategories() {
  categoriesDiv.innerHTML = "";
  for (const cat in memoryNotes) {
    const div = document.createElement("div");
    div.className = "category-block";

    const header = document.createElement("div");
    header.className = "category-header";
    header.innerHTML = `<span>${cat}</span><span class="delete-btn" title="Delete category">[x]</span>`;
    div.appendChild(header);

    const ul = document.createElement("ul");
    ul.className = "category-items";
    // If category has items, start collapsed; else keep hidden (empty)
    ul.style.display = memoryNotes[cat].length ? "none" : "none";

    memoryNotes[cat].forEach((note, idx) => {
      const li = document.createElement("li");
      li.textContent = `${note.word} → ${note.desc}`;
      const del = document.createElement("span");
      del.textContent = " [delete]";
      del.className = "delete-btn";
      del.title = "Delete this entry";
      del.onclick = (e) => {
        e.stopPropagation();
        memoryNotes[cat].splice(idx, 1);
        saveNotes();
        renderCategories();
      };
      li.appendChild(del);
      ul.appendChild(li);
    });
    div.appendChild(ul);

    // Expand/collapse by clicking left part of header (category name)
    header.addEventListener("click", (e) => {
      // ignore clicks on [x]
      if (e.target && e.target.classList.contains("delete-btn")) return;
      ul.style.display = ul.style.display === "none" ? "block" : "none";
    });

    // Delete category via [x]
    header.querySelector(".delete-btn").onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete category "${cat}" and all its items?`)) {
        delete memoryNotes[cat];
        saveNotes();
        renderCategories();
      }
    };

    categoriesDiv.appendChild(div);
  }
  refreshEntryCategoryDropdown();
}

function refreshEntryCategoryDropdown() {
  const prev = entryCategory.value;
  entryCategory.innerHTML = "";
  for (const cat in memoryNotes) {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    entryCategory.appendChild(opt);
  }
  // try to keep previous selection
  if (prev && memoryNotes[prev]) entryCategory.value = prev;
}

addCategoryBtn.addEventListener("click", () => {
  const cat = (newCategoryInput.value || "").trim();
  if (!cat) return;
  if (!memoryNotes[cat]) memoryNotes[cat] = [];
  newCategoryInput.value = "";
  saveNotes();
  renderCategories();
});

addEntryBtn.addEventListener("click", () => {
  const cat = entryCategory.value;
  const word = (entryWord.value || "").trim();
  const desc = (entryDesc.value || "").trim();
  if (!cat || !word) return;
  if (!memoryNotes[cat]) memoryNotes[cat] = [];
  const key = word.toLowerCase();
  const existing = memoryNotes[cat].find(n => (n.word || "").toLowerCase() === key);
  if (existing) existing.desc = desc;
  else memoryNotes[cat].push({ word, desc });
  saveNotes();
  renderCategories();
  entryWord.value = "";
  entryDesc.value = "";
});

// ----------------------------
// Click-word editor
// ----------------------------
function openDescriptionEditor(wordKey, span, originalWord) {
  // Remove any sibling editor first
  const existing = span.parentElement.querySelector(".description-box");
  if (existing) existing.remove();

  const editor = document.createElement("div");
  editor.className = "description-box";

  const dropdown = document.createElement("select");
  for (const cat in memoryNotes) {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    dropdown.appendChild(opt);
  }

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Description";
  const current = getDescription(wordKey);
  if (current) input.value = current;

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";

  saveBtn.addEventListener("click", () => {
    const cat = dropdown.value;
    if (!memoryNotes[cat]) memoryNotes[cat] = [];
    const keyLower = (wordKey || "").toLowerCase();
    const existing = memoryNotes[cat].find(n => (n.word || "").toLowerCase() === keyLower);
    if (existing) existing.desc = input.value;
    else memoryNotes[cat].push({ word: wordKey, desc: input.value });
    saveNotes();
    renderCategories();
    editor.remove();
    // Update the inline word
    span.textContent = input.value ? appendNoteToText(originalWord, input.value) : originalWord;
    if (input.value) span.classList.add("with-note"); else span.classList.remove("with-note");
  });

  editor.appendChild(dropdown);
  editor.appendChild(input);
  editor.appendChild(saveBtn);
  span.insertAdjacentElement("afterend", editor);
}

// ----------------------------
// Export / Import
// ----------------------------
document.getElementById("exportNotes").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(memoryNotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "memory_notes.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importNotes").click();
});

document.getElementById("importNotes").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object") throw new Error("Invalid data");
      memoryNotes = data;
      ensureDefaultCategories();
      saveNotes();
      renderCategories();
      alert("✅ Notes imported successfully!");
    } catch (err) {
      alert("❌ Invalid file format.");
    }
  };
  reader.readAsText(file);
});

// ----------------------------
// Search
// ----------------------------
const searchBox = document.getElementById("searchBox");
const searchResult = document.getElementById("searchResult");
searchBox.addEventListener("input", () => {
  const query = (searchBox.value || "").trim().toLowerCase();
  searchResult.innerHTML = "";
  if (!query) return;
  for (const cat in memoryNotes) {
    memoryNotes[cat].forEach(note => {
      if ((note.word || "").toLowerCase().includes(query)) {
        const div = document.createElement("div");
        div.textContent = note.desc || "(no description)";
        searchResult.appendChild(div);
      }
    });
  }
});

// ----------------------------
// Init
// ----------------------------
document.getElementById("startBtn").addEventListener("click", generateSequence);
timerInput.addEventListener("input", () => {
  wordTimer = parseInt(timerInput.value);
  timerValue.textContent = wordTimer;
});
renderCategories();
refreshEntryCategoryDropdown();
