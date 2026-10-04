/**
 * LevelUp English — core app logic
 * Vanilla JS (ES modules), no framework. LocalStorage persistence.
 */

// ─── SM-2 Spaced Repetition ──────────────────────────────────────────────────
export const SM2 = {
  /**
   * Compute next scheduling state from a rating.
   * @param {Object} card current scheduling fields
   * @param {0|1|2|3} rating 0=Again 1=Hard 2=Good 3=Easy
   * @returns updated scheduling fields
   */
  schedule(card, rating) {
    let { ease = 2.5, interval = 0, reps = 0 } = card;

    if (rating === 0) { // Again
      reps = 0;
      interval = 0; // minutes (review again now/soon)
      ease = Math.max(1.3, ease - 0.20);
    } else if (rating === 1) { // Hard
      interval = Math.max(interval * 1.2, 1);
      ease = Math.max(1.3, ease - 0.15);
      reps += 1;
    } else if (rating === 2) { // Good
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 6;
      else interval = Math.round(interval * ease);
      ease = Math.max(1.3, ease);
      reps += 1;
    } else { // Easy (3)
      if (reps === 0) interval = 4;
      else interval = Math.round(interval * ease * 1.3);
      ease = Math.min(3.0, ease + 0.15);
      reps += 1;
    }

    return { ease: clamp(ease, 1.3, 3.0), interval, reps, due: interval * 86400000 };
  }
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ─── Storage ─────────────────────────────────────────────────────────────────
const STORE_KEY = 'levelup_data_v1';

export const Store = {
  _state: null,

  load() {
    if (this._state) return this._state;
    try {
      this._state = JSON.parse(localStorage.getItem(STORE_KEY)) || this._default();
    } catch {
      this._state = this._default();
    }
    return this._state;
  },

  _default() {
    return {
      cards: {},            // word(unique) -> scheduling + stats
      progress: {
        xp: 0,
        streak: 0,
        longest_streak: 0,
        last_study: null,   // YYYY-MM-DD
        daily_goal: 100
      },
      daily: {}             // YYYY-MM-DD -> {xp, cards, time}
    };
  },

  save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(this._state));
  },

  reset() {
    this._state = this._default();
    this.save();
  },

  // ── Card helpers ──
  getCard(word) {
    return this._state.cards[word] || null;
  },

  statusOf(word, allCards) {
    // Load deck def for status: NEW / LEARNING / REVIEW / MASTERED
    const s = this.getCard(word);
    const def = allCards[word];
    if (!s) return 'NEW';
    if (s.interval >= 21) return 'MASTERED';
    if (s.reps >= 1) return 'REVIEW';
    return 'LEARNING';
  }
};

// ─── XP / Level / Streak ─────────────────────────────────────────────────────
export const Game = {
  levelFromXP(xp) {
    return Math.floor(Math.sqrt(xp / 100));
  },
  levelTitle(lvl) {
    if (lvl >= 51) return 'Grandmaster';
    if (lvl >= 36) return 'Master';
    if (lvl >= 21) return 'Expert';
    if (lvl >= 11) return 'Journeyman';
    if (lvl >= 6) return 'Apprentice';
    return 'Beginner';
  }
};
