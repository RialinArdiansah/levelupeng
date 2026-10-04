/**
 * LevelUp English — main app (routing + views)
 */
import { SM2, Store, Game } from './core.js';
import { renderHome, renderStats, renderBrowse, renderSettings } from './views.js';

const app = document.getElementById('app');
let NAV = null; // bottom nav element

const routes = {
  home: { icon: '🏠', label: 'Home', render: renderHome },
  stats: { icon: '📊', label: 'Stats', render: renderStats },
  browse: { icon: '📖', label: 'Words', render: renderBrowse },
  settings: { icon: '⚙️', label: 'Settings', render: renderSettings }
};

let currentRoute = 'home';

// ─── Deck data ───────────────────────────────────────────────────────────────
let DECK = null;
export function getDeck() {
  return DECK;
}

export async function loadDeck() {
  if (DECK) return DECK;
  const res = await fetch('data/oxford5000.json');
  const cards = await res.json();
  DECK = {};
  for (const c of cards) {
    // unique key: word+pos (some words have multiple POS)
    const key = `${c.w}#${c.p}`;
    DECK[key] = c;
  }
  return DECK;
}

// ─── Navigation shell ────────────────────────────────────────────────────────
function buildShell() {
  app.innerHTML = `
    <div class="screen" id="screen"></div>
    <nav class="bottom-nav" id="nav">
      ${Object.entries(routes).map(([key, r]) => `
        <button class="nav-item" data-route="${key}">
          <span class="icon">${r.icon}</span>
          <span>${r.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
  NAV = document.getElementById('nav');
  NAV.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });
}

export function navigate(route, params) {
  if (route === '__study__') { startStudy(); return; }
  if (!routes[route]) return;
  currentRoute = route;
  NAV.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.route === route));
  const screen = document.getElementById('screen');
  screen.innerHTML = '';
  routes[route].render(screen, params);
  screen.scrollTop = 0;
}

// ─── Study session (special full-screen route, no nav) ───────────────────────
export function startStudy(mode) {
  app.innerHTML = '<div id="study-root"></div>';
  import('./study.js').then(m => m.startSession(document.getElementById('study-root'), mode));
}

export function exitStudy() {
  buildShell();
  navigate('home');
}

// ─── Toast ───────────────────────────────────────────────────────────────────
export function toast(msg, ms = 2000) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ─── Init ────────────────────────────────────────────────────────────────────
(async function init() {
  Store.load();
  await loadDeck();
  buildShell();
  navigate('home');
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
