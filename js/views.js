/**
 * LevelUp English — views (home, stats, browse, settings)
 */
import { SM2, Store, Game } from './core.js';
import { getDeck, navigate, toast } from './app.js';

const today = () => new Date().toISOString().slice(0, 10);
const CEFR_LABEL = { A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1' };
const GOAL_VALUES = ['50', '100', '150', '200'];
const NEW_LIMIT_VALUES = [5, 10, 20, 30, 50];

// ─── Shared helpers ───────────────────────────────────────────────────────────
function dueWords(now = Date.now()) {
  const deck = getDeck();
  return Object.keys(deck).filter(k => {
    const s = Store._state.cards[k];
    return s && (s.due_at || 0) <= now;
  });
}

function newWordsCount() {
  const limit = parseInt(localStorage.getItem('levelup_new_limit')) || 20;
  const deck = getDeck();
  return Object.keys(deck).filter(k => !Store._state.cards[k]).slice(0, limit).length;
}

function masteredCount() {
  const deck = getDeck();
  let n = 0;
  for (const k of Object.keys(deck)) {
    const s = Store._state.cards[k];
    if (s && s.interval >= 21) n++;
  }
  return n;
}

function learnedCount() { return Object.keys(Store._state.cards).length; }

let browseQuery = '';
let browseScroll = 0;

// ─── Home ─────────────────────────────────────────────────────────────────────
export function renderHome(el) {
  const p = Store._state.progress;
  const lvl = Game.levelFromXP(p.xp);
  const daily = Store._state.daily[today()] || { xp: 0, cards: 0, time: 0 };
  const goal = p.daily_goal;
  const pct = Math.min(100, Math.round((daily.xp / goal) * 100));

  const due = dueWords().length;
  const fresh = newWordsCount();
  const total = due + fresh;
  const learned = learnedCount();
  const mastered = masteredCount();

  el.innerHTML = `
    <div class="header">
      <h1>LevelUp</h1>
      <div class="streak-badge"><span class="flame">🔥</span><span class="num">${p.streak}</span></div>
    </div>

    <div class="xp-card">
      <div class="xp-header">
        <span class="xp-level">Level ${lvl} · ${Game.levelTitle(lvl)}</span>
        <span class="xp-count">${p.xp} XP</span>
      </div>
      <div class="xp-bar"><div class="xp-bar-fill" style="width:${pct}%"></div></div>
      <div class="xp-goal">${daily.xp} / ${goal} XP hari ini</div>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="stat-value">${due + fresh}</div><div class="stat-label">Siap belajar</div></div>
      <div class="stat-card"><div class="stat-value">${learned}</div><div class="stat-label">Dipelajari</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--success)">${mastered}</div><div class="stat-label">Mastered</div></div>
    </div>

    <button class="study-btn" data-mode="mixed" ${total === 0 ? 'disabled' : ''}>
      ${total === 0 ? 'Selesai hari ini 🎉' : `Mulai Belajar (${total})`}
    </button>
  `;

  const btn = el.querySelector('.study-btn');
  if (btn) btn.addEventListener('click', () => startStudy());
}

function startStudy() {
  navigate('__study__');  // placeholder route to trigger dynamic import
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export function renderStats(el) {
  const p = Store._state.progress;
  const lvl = Game.levelFromXP(p.xp);

  let totalReviews = 0;
  const dailyMap = Store._state.daily;
  for (const d of Object.values(dailyMap)) totalReviews += d.cards;

  let heat = '';
  for (let i = 83; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const v = dailyMap[day]?.cards || 0;
    const cls = v === 0 ? '' : v < 10 ? 'l1' : v < 25 ? 'l2' : v < 50 ? 'l3' : 'l4';
    heat += `<div class="heat-cell ${cls}" title="${day}: ${v} kartu"></div>`;
  }

  el.innerHTML = `
    <div class="header"><h1>Statistik</h1></div>
    <div class="xp-card">
      <div class="xp-header">
        <span class="xp-level">Level ${lvl} · ${Game.levelTitle(lvl)}</span>
        <span class="xp-count">${p.xp} XP</span>
      </div>
      <div class="xp-bar"><div class="xp-bar-fill" style="width:${Math.min(100,(p.xp % ((lvl+1)**2*100 - lvl**2*100 || 1)) / 1 * 100)}%"></div></div>
      <div class="xp-goal">${p.xp} XP total · ke level ${lvl + 1} butuh ${(lvl + 1) ** 2 * 100 - p.xp} XP</div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-value" style="color:var(--flame)">🔥 ${p.streak}</div><div class="stat-label">Streak</div></div>
      <div class="stat-card"><div class="stat-value">${p.longest_streak}</div><div class="stat-label">Terpanjang</div></div>
      <div class="stat-card"><div class="stat-value">${totalReviews}</div><div class="stat-label">Total Review</div></div>
    </div>
    <div class="ring-section">
      <h2>Aktivitas 12 Minggu</h2>
      <div class="heatmap">${heat}</div>
    </div>
  `;
}

// ─── Browse ───────────────────────────────────────────────────────────────────
export function renderBrowse(el) {
  el.innerHTML = `
    <div class="header"><h1>Kamus</h1></div>
    <input class="search-bar" id="q" placeholder="Cari kata... " value="${browseQuery}">
    <div id="word-list"></div>
  `;

  const input = el.querySelector('#q');
  const list = el.querySelector('#word-list');
  input.addEventListener('input', () => {
    browseQuery = input.value;
    drawList(list);
  });
  list.addEventListener('scroll', () => { browseScroll = list.scrollTop; });
  drawList(list);
}

function drawList(list) {
  const deck = getDeck();
  const query = browseQuery.toLowerCase();
  const keys = Object.keys(deck).filter(k => deck[k].w.toLowerCase().includes(query));
  const visible = keys.slice(0, 100);
  list.innerHTML = visible.map(k => {
    const c = deck[k];
    const s = Store._state.cards[k];
    return `
      <div class="word-item" data-key="${k}">
        <div class="w">${c.w}</div>
        <div class="meta">
          <span class="level-badge lvl-${c.l}" style="margin:0;padding:2px 10px;font-size:10px;">${c.l}</span>
          <span class="pos">${c.p}</span>
          ${s ? `<span class="pos">· ${s.interval}d · ${s.ease.toFixed(2)}</span>` : ''}
        </div>
        <div class="d">${c.id ? `<span class="d-id">${c.id}</span> · ` : ''}${c.d}</div>
        ${c.ex ? `<div class="d-ex">💡 ${c.ex}</div>` : ''}
      </div>`;
  }).join('') || '<div class="empty"><div class="icon">🔍</div>Kata tidak ditemukan.<br>Coba kata lain.</div>';

  list.querySelectorAll('.word-item').forEach(item => {
    item.addEventListener('click', () => {
      const c = deck[item.dataset.key];
      speak(c.w);
    });
  });
  list.scrollTop = browseScroll;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function renderSettings(el) {
  const p = Store._state.progress;
  el.innerHTML = `
    <div class="header"><h1>Setelan</h1></div>
    <div class="setting-item">
      <div><div class="label">Target XP harian</div><div class="desc">Bonus +50 XP kalau tercapai</div></div>
      <select class="select" id="goal">
        ${GOAL_VALUES.map(v => `<option value="${v}" ${p.daily_goal == v ? 'selected' : ''}>${v} XP</option>`).join('')}
      </select>
    </div>
    <div class="setting-item">
      <div><div class="label">Kartu baru / hari</div></div>
      <select class="select" id="newLimit">
        ${NEW_LIMIT_VALUES.map(v => `<option value="${v}" ${(parseInt(localStorage.getItem('levelup_new_limit')) || 20) == v ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="setting-item">
      <div><div class="label">Reset semua progress</div><div class="desc">Tidak bisa dibatalkan</div></div>
      <button class="rating-btn again" style="padding:8px 16px;" id="reset">Reset</button>
    </div>
    <p style="margin-top:24px;font-size:12px;color:var(--text-tertiary);text-align:center;">
      LevelUp English v1.0 · Oxford 5000<br>5292 kartu · offline · data di perangkat
    </p>
  `;

  el.querySelector('#goal').addEventListener('change', e => {
    p.daily_goal = +e.target.value;
    Store.save();
  });
  el.querySelector('#newLimit').addEventListener('change', e => {
    localStorage.setItem('levelup_new_limit', e.target.value);
  });
  el.querySelector('#reset').addEventListener('click', () => {
    if (confirm('Reset SEMUA progress? Streak, XP, kartu yang dipelajari akan hilang.')) {
      Store.reset();
      navigate('home');
      toast('Progress direset');
    }
  });
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
export function speak(text) {
  if (!('speechSynthesis' in window)) { toast('TTS tidak tersedia'); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
