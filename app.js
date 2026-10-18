/* =============================================================
   OLP AI Exam - Application Logic (IOAI 2026 Syllabus)
   ============================================================= */

// 14 exam sets aligned to IOAI 2026 official syllabus
// Each set = 40 questions, 60 minutes
// 10 questions per topic area (ML Classic / NN-DL / CV / NLP-Audio)
const ALL_SETS = window.EXAM_SETS || [];

// State
const state = {
  currentSet: null,
  currentQuestionIndex: 0,
  answers: [],          // {selected: number|null, revealed: boolean}
  flagged: [],          // boolean per question
  startTime: null,
  endTime: null,
  timerInterval: null,
  submitted: false
};

// ====== Utility ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => String(n).padStart(2, '0');
const fmtTime = (s) => `${fmt(Math.floor(s/60))}:${fmt(s%60)}`;

function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

// ====== Home view ======
function renderHome() {
  const grid = $('#examGrid');
  if (!grid) return;

  grid.innerHTML = '';
  ALL_SETS.forEach((set, idx) => {
    const card = document.createElement('div');
    card.className = 'exam-card';
    card.innerHTML = `
      <span class="exam-card-tag">Bộ ${String(idx + 1).padStart(2, '0')}</span>
      <h3 class="exam-card-title">${set.title}</h3>
      <div class="exam-card-meta">
        <span>📝 ${set.questions.length} câu</span>
        <span>⏱ ${set.duration} phút</span>
        <span>✅ Có giải thích</span>
      </div>
      <div class="exam-card-action">Bắt đầu làm bài →</div>
    `;
    card.addEventListener('click', () => startExam(set.id));
    grid.appendChild(card);
  });

  // Update totals
  const totalQ = ALL_SETS.reduce((sum, s) => sum + s.questions.length, 0);
  $('#totalSets').textContent = ALL_SETS.length;
  $('#totalQuestions').textContent = totalQ;
}

// ====== Exam view ======
function startExam(setId) {
  const set = ALL_SETS.find(s => s.id === setId);
  if (!set) {
    showToast('Không tìm thấy bộ đề', 'error');
    return;
  }

  state.currentSet = set;
  state.currentQuestionIndex = 0;
  state.answers = new Array(set.questions.length).fill(null).map(() => ({ selected: null, revealed: false }));
  state.flagged = new Array(set.questions.length).fill(false);
  state.startTime = Date.now();
  state.endTime = null;
  state.submitted = false;

  // Switch view
  $('#homeView').classList.add('hidden');
  $('#resultView').classList.add('hidden');
  $('#examView').classList.remove('hidden');

  $('#examTitle').textContent = set.title;
  $('#examMeta').textContent = `${set.questions.length} câu • ${set.duration} phút`;

  renderPalette();
  renderQuestion();

  // Start timer
  if (state.timerInterval) clearInterval(state.timerInterval);
  const totalSeconds = set.duration * 60;
  let remaining = totalSeconds;
  const timer = $('#timer');
  timer.className = 'timer';

  const tick = () => {
    timer.textContent = `⏱ ${fmtTime(remaining)}`;
    if (remaining <= 300 && remaining > 60) {
      timer.className = 'timer warning';
    } else if (remaining <= 60) {
      timer.className = 'timer danger';
    }
    if (remaining <= 0) {
      clearInterval(state.timerInterval);
      showToast('⏰ Hết giờ! Tự động nộp bài', 'error');
      submitExam();
      return;
    }
    remaining--;
  };
  tick();
  state.timerInterval = setInterval(tick, 1000);
}

function renderPalette() {
  const grid = $('#paletteGrid');
  grid.innerHTML = '';
  state.currentSet.questions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    const topic = (q.topic || '').substring(0, 2);
    btn.dataset.topic = topic;
    if (state.answers[idx]?.selected !== null) btn.classList.add('answered');
    if (idx === state.currentQuestionIndex) btn.classList.add('current');
    if (state.flagged[idx]) btn.classList.add('flagged');
    btn.textContent = idx + 1;
    btn.addEventListener('click', () => goToQuestion(idx));
    grid.appendChild(btn);
  });

  // Update stats
  const answered = state.answers.filter(a => a.selected !== null).length;
  const total = state.currentSet.questions.length;
  $('#paletteStats').textContent = `${answered}/${total}`;
}

function renderQuestion() {
  const idx = state.currentQuestionIndex;
  const q = state.currentSet.questions[idx];
  const userAnswer = state.answers[idx];
  const isRevealed = userAnswer.revealed;
  const userSelected = userAnswer.selected;

  const choicesHTML = q.opts.map((opt, optIdx) => {
    let cls = 'choice';
    let marker = String.fromCharCode(65 + optIdx);
    if (isRevealed) {
      cls += ' disabled';
      if (optIdx === q.ans) cls += ' correct';
      else if (optIdx === userSelected) cls += ' incorrect';
    } else if (userSelected === optIdx) {
      cls += ' selected';
    }
    return `
      <div class="${cls}" data-opt="${optIdx}" role="button" tabindex="0">
        <div class="choice-marker">${marker}</div>
        <div class="choice-text">${formatText(opt)}</div>
      </div>
    `;
  }).join('');

  const explanationHTML = isRevealed ? renderExplanation(q, userSelected) : '';

  $('#questionCard').innerHTML = `
    <div class="question-meta">
      <span class="question-number">Câu ${idx + 1} / ${state.currentSet.questions.length}</span>
      <span class="question-tag">${getTopicTag(idx)}</span>
    </div>
    <div class="question-text">${formatText(q.q)}</div>
    <div class="choices" id="choicesList">${choicesHTML}</div>
    ${explanationHTML}
    <div class="question-footer">
      <div class="question-nav">
        <button class="btn btn-secondary" id="prevBtn" ${idx === 0 ? 'disabled' : ''}>← Câu trước</button>
        <button class="btn btn-secondary" id="nextBtn" ${idx === state.currentSet.questions.length - 1 ? 'disabled' : ''}>Câu sau →</button>
      </div>
      <div class="question-nav">
        <button class="btn btn-ghost" id="flagBtn">${state.flagged[idx] ? '🚩 Bỏ đánh dấu' : '⚑ Đánh dấu'}</button>
        <button class="btn btn-primary" id="revealBtn" ${userSelected === null ? 'disabled' : ''}>${isRevealed ? '✓ Đã xem giải' : '👁 Xem giải thích'}</button>
      </div>
    </div>
  `;

  // Bind choice clicks
  $$('#choicesList .choice').forEach(el => {
    el.addEventListener('click', () => {
      if (isRevealed) return;
      const optIdx = parseInt(el.dataset.opt);
      state.answers[idx].selected = optIdx;
      renderQuestion();
      renderPalette();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  // Navigation
  $('#prevBtn').addEventListener('click', () => goToQuestion(Math.max(0, idx - 1)));
  $('#nextBtn').addEventListener('click', () => goToQuestion(Math.min(state.currentSet.questions.length - 1, idx + 1)));

  // Flag
  $('#flagBtn').addEventListener('click', () => {
    state.flagged[idx] = !state.flagged[idx];
    renderQuestion();
    renderPalette();
  });

  // Reveal
  $('#revealBtn').addEventListener('click', () => {
    if (state.answers[idx].selected === null) {
      showToast('Vui lòng chọn đáp án trước', 'error');
      return;
    }
    state.answers[idx].revealed = true;
    renderQuestion();
  });
}

function getTopicTag(idx) {
  // Use the topic from each question, mapped to IOAI 2026 syllabus 4 areas
  const q = state.currentSet.questions[idx];
  const topicCode = q.topic || '';
  const tagMap = {
    // T1 - Kỹ năng nền tảng + ML cổ điển
    'ML1': 'ML cổ điển (1.1)',
    'ML2': 'ML cổ điển (1.2)',
    'ML3': 'ML cổ điển (1.3)',
    'ML4': 'ML cổ điển (1.4)',
    'ML5': 'ML cổ điển (1.5)',
    'ML6': 'ML cổ điển (1.6)',
    'ML7': 'Ensemble (1.7)',
    'ML8': 'Boosting (1.8)',
    'ML9': 'K-Means (1.9)',
    'ML10': 'Unsupervised (1.10)',
    // T2 - Neural Networks + Deep Learning
    'DL1': 'NN/DL (2.1-2.2)',
    'DL2': 'NN/DL (2.3-2.10)',
    // T3 - Computer Vision
    'CV1': 'CV - Conv (3.1)',
    'CV2': 'CV - Classify (3.2)',
    'CV3': 'CV - Detect (3.3)',
    'CV4': 'CV - mAP/NMS (3.4)',
    'CV5': 'CV - Segment (3.5)',
    'CV6': 'CV - Transfer (3.6)',
    'CV7': 'CV - Augment (3.7)',
    'CV8': 'CV - GAN (3.8)',
    'CV9': 'CV - Diffusion (3.9)',
    'CV10': 'CV - SSL/CLIP (3.10)',
    // T4 - NLP + Audio
    'NL1': 'NLP - BERT (4.1)',
    'NL2': 'NLP - GPT/LM (4.2)',
    'NL3': 'NLP - Classify (4.3)',
    'NL4': 'NLP - Encoder-Dec (4.4)',
    'NL5': 'NLP - Embed (4.5)',
    'NL6': 'NLP - Tokenize (4.6)',
    'NL7': 'NLP - Fine-tune (4.7)',
    'NL8': 'Audio - HuBERT (4.8)',
    'NL9': 'Audio - Whisper (4.9)',
    'NL10': 'Audio - Voxtral (4.10)'
  };
  return tagMap[topicCode] || 'OLP AI';
}

function renderExplanation(q, userSelected) {
  const isCorrect = userSelected === q.ans;
  const correctLetter = String.fromCharCode(65 + q.ans);
  const userLetter = userSelected !== null ? String.fromCharCode(65 + userSelected) : '—';

  let headerText, headerClass, icon;
  if (isCorrect) {
    headerText = '✅ Chính xác! Đáp án đúng là ' + correctLetter;
    headerClass = 'correct';
    icon = '🎉';
  } else if (userSelected === null) {
    headerText = `⏭ Bạn đã bỏ qua. Đáp án đúng là ${correctLetter}`;
    headerClass = '';
    icon = '💡';
  } else {
    headerText = `❌ Bạn chọn ${userLetter}, đáp án đúng là ${correctLetter}`;
    headerClass = 'incorrect';
    icon = '💡';
  }

  return `
    <div class="explanation ${headerClass}">
      <div class="explanation-header">
        <span class="explanation-icon">${icon}</span>
        <span>${headerText}</span>
      </div>
      <div class="explanation-content">${formatExplanation(q.exp, q.ans)}</div>
    </div>
  `;
}

function formatText(text) {
  if (!text) return '';
  // Escape HTML first
  const escaped = escapeHTML(text);

  // Process code blocks first: ```lang\n...\n```  ->  placeholders
  // Use a placeholder so subsequent \n-><br> doesn't touch the code
  const codeBlocks = [];
  let html = escaped.replace(/```([a-zA-Z0-9_+\-#]*)\n([\s\S]*?)```/g, (m, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang, code: code });
    return `\u0000CODE_BLOCK_${idx}\u0000`;
  });

  // Process markdown-like tables: multiple lines with | separators
  // Supports with or without separator line (--- | --- | ---)
  // Note: must run BEFORE \n -> <br> conversion
  html = html.replace(/(^|\n)((?:[^\n|<>]+(?:\|[^\n|<>]+)+\n){2,})/g, (m, before, block) => {
    const lines = block.trim().split('\n');
    // Filter out the separator line (--- | --- | ---)
    const dataLines = lines.filter(l => !/^[-:\s|]+$/.test(l.trim()));
    if (dataLines.length < 2) return m;
    const splitRow = (row) => row.split('|').map(c => c.trim()).filter(c => c.length > 0);
    const headerCells = splitRow(dataLines[0]);
    // Check that all rows have the same column count
    const colCount = headerCells.length;
    const rows = dataLines.slice(1).map(splitRow).filter(r => r.length === colCount);
    if (rows.length === 0) return m;
    let table = '<table class="data-table"><thead><tr>';
    headerCells.forEach(h => table += `<th>${h}</th>`);
    table += '</tr></thead><tbody>';
    rows.forEach(r => {
      table += '<tr>';
      r.forEach(c => table += `<td>${c}</td>`);
      table += '</tr>';
    });
    table += '</tbody></table>';
    return before + table;
  });

  // Process inline code: `code`  ->  <code>
  html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

  // Convert remaining newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // Restore code blocks with proper <pre><code> wrapping (newlines preserved via white-space: pre)
  html = html.replace(/\u0000CODE_BLOCK_(\d+)\u0000/g, (m, idx) => {
    const { lang, code } = codeBlocks[parseInt(idx)];
    return `<pre class="code-block" data-lang="${lang}"><code>${code}</code></pre>`;
  });

  return html;
}

function formatExplanation(text, correctIdx) {
  // Bold the answer key
  const correctLetter = String.fromCharCode(65 + correctIdx);
  return formatText(text).replace(/Đáp án đúng: ([A-D])/g, '<strong>Đáp án đúng: $1</strong>');
}

function goToQuestion(idx) {
  if (idx < 0 || idx >= state.currentSet.questions.length) return;
  state.currentQuestionIndex = idx;
  renderQuestion();
  renderPalette();
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ====== Submission ======
function confirmSubmit() {
  const total = state.currentSet.questions.length;
  const answered = state.answers.filter(a => a.selected !== null).length;
  const unanswered = total - answered;

  $('#confirmText').textContent = unanswered > 0
    ? `Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc chắn muốn nộp bài?`
    : 'Bạn đã trả lời đủ tất cả các câu. Nộp bài ngay?';

  $('#confirmModal').classList.remove('hidden');
}

function submitExam() {
  $('#confirmModal').classList.add('hidden');
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.endTime = Date.now();
  state.submitted = true;

  // Force reveal all answers
  state.answers.forEach(a => {
    if (a.selected !== null) a.revealed = true;
  });

  renderResult();
}

function renderResult() {
  const set = state.currentSet;
  const total = set.questions.length;
  let correct = 0, incorrect = 0, skipped = 0;

  set.questions.forEach((q, idx) => {
    const a = state.answers[idx];
    if (a.selected === null) skipped++;
    else if (a.selected === q.ans) correct++;
    else incorrect++;
  });

  const percent = Math.round((correct / total) * 100);
  const elapsed = Math.floor((state.endTime - state.startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  // Switch view
  $('#examView').classList.add('hidden');
  $('#resultView').classList.remove('hidden');

  // Render
  $('#resultScore').textContent = `${correct}/${total}`;
  $('#resultScore').className = 'result-score ' + (
    percent >= 90 ? 'excellent' :
    percent >= 70 ? 'good' :
    percent >= 50 ? 'average' : 'poor'
  );

  $('#resultLabel').textContent = getResultLabel(percent);
  $('#resultMessage').textContent = getResultMessage(percent, correct, total);
  $('#statCorrect').textContent = correct;
  $('#statIncorrect').textContent = incorrect;
  $('#statSkipped').textContent = skipped;
  $('#statTime').textContent = `${minutes}:${fmt(seconds)}`;
  $('#statPercent').textContent = `${percent}%`;

  // Render review
  const reviewList = $('#reviewList');
  reviewList.innerHTML = set.questions.map((q, idx) => {
    const a = state.answers[idx];
    const userSelected = a.selected;
    const isCorrect = userSelected === q.ans;
    const isSkipped = userSelected === null;

    let statusClass, statusText;
    if (isCorrect) { statusClass = 'correct'; statusText = 'Đúng'; }
    else if (isSkipped) { statusClass = 'skipped'; statusText = 'Bỏ qua'; }
    else { statusClass = 'incorrect'; statusText = 'Sai'; }

    const choicesReview = q.opts.map((opt, optIdx) => {
      let cls = 'review-choice';
      if (optIdx === q.ans) {
        cls += ' actual-correct';
        if (userSelected === optIdx) cls = 'review-choice user-correct';
        return `<div class="${cls}"><span>✓</span><span><strong>${String.fromCharCode(65+optIdx)}.</strong> ${formatText(opt)} ${optIdx === q.ans && userSelected !== optIdx ? '(Đáp án đúng)' : ''}</span></div>`;
      } else if (optIdx === userSelected) {
        cls += ' user-incorrect';
        return `<div class="${cls}"><span>✗</span><span><strong>${String.fromCharCode(65+optIdx)}.</strong> ${formatText(opt)} (Bạn chọn)</span></div>`;
      }
      return `<div class="review-choice"><span style="opacity:0.3">·</span><span><strong>${String.fromCharCode(65+optIdx)}.</strong> ${formatText(opt)}</span></div>`;
    }).join('');

    return `
      <div class="review-question">
        <div class="review-question-header">
          <div class="review-question-title">Câu ${idx + 1}: ${formatText(q.q)}</div>
          <span class="review-status ${statusClass}">${statusText}</span>
        </div>
        <div class="review-choices">${choicesReview}</div>
        <div class="review-explanation">
          <strong>💡 Giải thích:</strong> ${formatText(q.exp)}
        </div>
      </div>
    `;
  }).join('');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getResultLabel(percent) {
  if (percent >= 90) return '🏆 Xuất sắc!';
  if (percent >= 80) return '🌟 Rất tốt!';
  if (percent >= 70) return '👍 Khá tốt';
  if (percent >= 50) return '📚 Cần ôn tập thêm';
  if (percent >= 30) return '⚠️ Cần cố gắng nhiều';
  return '📖 Hãy xem lại kiến thức nền';
}

function getResultMessage(percent, correct, total) {
  if (percent >= 90) return `Tuyệt vời! Bạn đã nắm vững kiến thức với ${correct}/${total} câu đúng. Sẵn sàng cho kỳ thi OLP AI!`;
  if (percent >= 70) return `Bạn đã làm tốt với ${correct}/${total} câu đúng. Xem lại các câu sai để củng cố kiến thức.`;
  if (percent >= 50) return `Kết quả trung bình (${correct}/${total}). Hãy xem lại các giải thích và thử lại để cải thiện.`;
  return `Bạn cần ôn tập thêm. Hãy đọc kỹ các giải thích và thử lại các bộ đề khác.`;
}

// ====== Utilities ======
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ====== Event Bindings ======
document.addEventListener('DOMContentLoaded', () => {
  renderHome();

  // Submit button
  $('#submitBtn').addEventListener('click', confirmSubmit);

  // Modal
  $('#cancelSubmit').addEventListener('click', () => {
    $('#confirmModal').classList.add('hidden');
  });
  $('#confirmSubmit').addEventListener('click', submitExam);

  // Retake
  $('#retakeBtn').addEventListener('click', () => {
    if (state.currentSet) startExam(state.currentSet.id);
  });

  // Review (just scroll)
  $('#reviewBtn').addEventListener('click', () => {
    $('#reviewList').scrollIntoView({ behavior: 'smooth' });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ($('#examView').classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToQuestion(state.currentQuestionIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToQuestion(state.currentQuestionIndex + 1);
    } else if (/^[1-9]$/.test(e.key)) {
      // Number keys: jump to question
      const n = parseInt(e.key) - 1;
      if (n < state.currentSet.questions.length) {
        goToQuestion(n);
      }
    } else if (/^[A-D]$/.test(e.key.toUpperCase())) {
      // A/B/C/D: select choice
      const idx = e.key.toUpperCase().charCodeAt(0) - 65;
      const cur = state.answers[state.currentQuestionIndex];
      if (cur.selected === null && !cur.revealed) {
        state.answers[state.currentQuestionIndex].selected = idx;
        renderQuestion();
        renderPalette();
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Enter/Space: reveal or next
      const cur = state.answers[state.currentQuestionIndex];
      if (cur.selected !== null && !cur.revealed) {
        e.preventDefault();
        cur.revealed = true;
        renderQuestion();
      } else if (cur.revealed) {
        e.preventDefault();
        if (state.currentQuestionIndex < state.currentSet.questions.length - 1) {
          goToQuestion(state.currentQuestionIndex + 1);
        }
      }
    }
  });
});

// Auto-start exam if ?set=X in URL
window.addEventListener('load', () => {
  const setParam = getQueryParam('set');
  if (setParam) {
    const set = ALL_SETS.find(s => s.id === setParam);
    if (set) startExam(setParam);
  }
});
