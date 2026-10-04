/**
 * LevelUp English — study session (flashcard review loop)
 */
import { SM2, Store, Game } from './core.js';
import { getDeck, exitStudy, toast } from './app.js';

const RATING_XP = { 0: -5, 1: 5, 2: 10, 3: 15 };
const RATING_LABEL = { 0: 'Lupa', 1: 'Sulit', 2: 'Baik', 3: 'Mudah' };
const DAILY_GOAL_BONUS = 50;

const today = () => new Date().toISOString().slice(0, 10);

// ─── Streak helpers (shared logic with views, duplicated intentionally) ──────
function touchStreak() {
  const p = Store._state.progress;
  const t = today();
  if (p.last_study === t) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  p.streak = (p.last_study === yesterday) ? p.streak + 1 : 1;
  p.longest_streak = Math.max(p.longest_streak, p.streak);
  p.last_study = t;
}

function addXP(n) {
  const p = Store._state.progress;
  p.xp = Math.max(0, p.xp + n);
  const d = Store._state.daily[today()] || (Store._state.daily[today()] = { xp: 0, cards: 0, time: 0 });
  d.xp = Math.max(0, d.xp + n);
}

// ─── Session state ────────────────────────────────────────────────────────────
let session = null;

export function startSession(root, mode = 'mixed') {
  const deck = getDeck();
  const now = Date.now();

  const due = Object.keys(deck).filter(k => {
    const s = Store._state.cards[k];
    return s && (s.due_at || 0) <= now;
  });

  const newLimit = parseInt(localStorage.getItem('levelup_new_limit')) || 20;
  const fresh = Object.keys(deck).filter(k => !Store._state.cards[k]).slice(0, newLimit);

  const queue = [...due, ...fresh].slice(0, 100);
  if (!queue.length) {
    toast('Tidak ada kartu untuk dipelajari hari ini 🎉');
    exitStudy();
    return;
  }

  session = { queue, idx: 0, flipped: false, xp: 0, done: 0, correct: 0, start: Date.now(), root };
  draw();
}

function draw() {
  const root = session.root;
  root.innerHTML = '';

  if (session.idx >= session.queue.length) {
    drawDone(root);
    return;
  }

  const key = session.queue[session.idx];
  const card = getDeck()[key];
  if (!card) { session.idx++; draw(); return; }

  root.innerHTML = `
    <div class="session-progress">
      <button class="nav-item" id="quit" style="padding:0;color:var(--text-muted);">✕ Keluar</button>
      <span>${session.idx + 1} / ${session.queue.length}</span>
      <span style="color:var(--xp)">+${session.xp} XP</span>
    </div>
    <div class="flashcard-wrap">
      <div class="flashcard ${session.flipped ? 'flipped' : ''}" id="fc">
        <div class="flashcard-inner">
          <div class="flashcard-face">
            <span class="level-badge lvl-${card.l}">${card.l}</span>
            <div class="flashcard-word">${card.w}</div>
            <div class="pos-tag">${card.p}</div>
            <div class="flashcard-hint">tap kartu untuk melihat definisi</div>
          </div>
          <div class="flashcard-face back">
            <span class="level-badge lvl-${card.l}" style="position:absolute;top:16px;left:16px;margin:0;">${card.l}</span>
            <div class="flashcard-word" style="font-size:28px;">${card.w}</div>
            <div class="flashcard-def">${card.d}</div>
            <button class="nav-item" id="speak" style="position:absolute;bottom:14px;right:16px;padding:6px;">🔊</button>
          </div>
        </div>
      </div>
    </div>
    <div class="rating-btns ${session.flipped ? '' : 'hidden'}">
      <button class="rating-btn again">Lupa</button>
      <button class="rating-btn hard">Sulit</button>
      <button class="rating-btn good">Baik</button>
      <button class="rating-btn easy">Mudah</button>
    </div>
  `;

  root.querySelector('#quit').addEventListener('click', () => {
    if (session.done > 0 || confirm('Keluar dari sesi? Progress sesi ini hilang.')) exitStudy();
  });

  root.querySelector('#fc').addEventListener('click', () => {
    session.flipped = !session.flipped;
    draw();
  });

  root.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const map = { 'Lupa': 0, 'Sulit': 1, 'Baik': 2, 'Mudah': 3 };
      rate(key, map[btn.textContent]);
    });
  });

  const spk = root.querySelector('#speak');
  if (spk) spk.addEventListener('click', e => {
    e.stopPropagation();
    speak(card.w);
  });
}

function rate(key, rating) {
  const s = Store._state.cards[key] || { ease: 2.5, interval: 0, reps: 0 };
  const next = SM2.schedule(s, rating);
  Store._state.cards[key] = {
    ease: next.ease,
    interval: next.interval,
    reps: next.reps,
    due_at: Date.now() + (next.interval > 0 ? next.interval * 86400000 : 60 * 1000)
  };

  const xp = RATING_XP[rating];
  addXP(xp);
  session.xp += xp;
  session.done++;
  if (rating >= 2) session.correct++;

  // Update daily card count
  Store._state.daily[today()].cards = (Store._state.daily[today()].cards || 0) + 1;
  session.idx++;
  session.flipped = false;
  touchStreak();

  // daily goal bonus
  const p = Store._state.progress;
  const daily = Store._state.daily[today()];
  const before = daily.xp - xp;
  if (before < p.daily_goal && daily.xp >= p.daily_goal) {
    addXP(DAILY_GOAL_BONUS);
    session.xp += DAILY_GOAL_BONUS;
    toast(`Target harian tercapai! +${DAILY_GOAL_BONUS} XP bonus 🎯`);
  }

  Store.save();
  draw();
}

function drawDone(root) {
  const mins = Math.max(1, Math.round((Date.now() - session.start) / 60000));
  const acc = session.done ? Math.round(session.correct / session.done * 100) : 0;
  const p = Store._state.progress;

  root.innerHTML = `
    <div class="completion">
      <div class="big">🎉</div>
      <h2>Sesi Selesai!</h2>
      <div class="sub">${session.done} kartu · ${mins} menit · akurasi ${acc}%</div>
      <div class="stats-mini">
        <div class="stat-card"><div class="stat-value" style="color:var(--xp)">+${session.xp}</div><div class="stat-label">XP</div></div>
        <div class="stat-card"><div class="stat-value">${acc}%</div><div class="stat-label">Akurasi</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--flame)">${p.streak}</div><div class="stat-label">🔥 Streak</div></div>
      </div>
      <button class="study-btn" id="back">Kembali ke Beranda</button>
    </div>
  `;

  root.querySelector('#back').addEventListener('click', exitStudy);
  session = null;
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
function speak(text) {
  if (!('speechSynthesis' in window)) { toast('TTS tidak tersedia'); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
