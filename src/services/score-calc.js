// ═══════════════════════════════════════
// SCORE-CALC.JS — Motor del Life Score
// Única fuente de verdad. Dashboard, IA Coach,
// y Logros leen de acá.
// ═══════════════════════════════════════
import State from '../services/state.js';
import { Dates } from '../utils/dates.js';
import { calcMonthKPIs, catGastoMes } from './finance-calc.js';
import { calcTradeStats } from './trading-calc.js';

// ── Helpers de hábitos ───────────────────
export function habitDoneCount(hid) {
  const uid = State.get('user')?.id;
  const mk  = Dates.monthKey();
  const logs = State.get('habitLogs') || {};
  const days = Dates.daysInMonth();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    if (logs[`${uid}:${mk}:${hid}:${d}`]) count++;
  }
  return count;
}

export function habitPct(hid) {
  return habitDoneCount(hid) / Dates.daysInMonth();
}

export function habitStreak(hid) {
  const uid  = State.get('user')?.id;
  const mk   = Dates.monthKey();
  const logs = State.get('habitLogs') || {};
  const today = Dates.today();
  let streak = 0;
  for (let d = today; d >= 1; d--) {
    if (logs[`${uid}:${mk}:${hid}:${d}`]) streak++;
    else break;
  }
  return streak;
}

export function habitMaxStreak(hid) {
  const uid  = State.get('user')?.id;
  const mk   = Dates.monthKey();
  const logs = State.get('habitLogs') || {};
  const days = Dates.daysInMonth();
  let max = 0, cur = 0;
  for (let d = 1; d <= days; d++) {
    if (logs[`${uid}:${mk}:${hid}:${d}`]) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

export function isDone(hid, day, monthKey) {
  const uid = State.get('user')?.id;
  const mk  = monthKey || Dates.monthKey();
  return !!(State.get('habitLogs') || {})[`${uid}:${mk}:${hid}:${day}`];
}

// ── Score por dimensión ──────────────────

export function scoreSalud() {
  const habits = State.get('habits') || [];
  const uid    = State.get('user')?.id;

  const healthKeywords = ['gym','agua','sueño','dormir','meditación','meditacion','salud','ejercicio','correr','caminar','bañarse','stretching'];
  const healthHabits   = habits.filter(h => healthKeywords.some(k => h.name.toLowerCase().includes(k)));
  const toScore        = healthHabits.length ? healthHabits : habits;

  const habitScore = toScore.length
    ? toScore.reduce((s, h) => s + habitPct(h.id), 0) / toScore.length
    : 0;

  // Métricas
  const metrics     = (State.get('metrics') || []).filter(m => m.userId === uid);
  const enMetrics   = metrics.filter(m => m.energia);
  const avgEnergia  = enMetrics.length ? enMetrics.reduce((s, m) => s + m.energia, 0) / enMetrics.length / 10 : null;
  const suenoMet    = metrics.filter(m => m.sueno);
  const avgSueno    = suenoMet.length ? Math.min(suenoMet.reduce((s, m) => s + m.sueno, 0) / suenoMet.length / 8, 1) : null;

  // Diario emocional
  const entries  = (State.get('diario') || []).filter(e => e.userId === uid && e.mood);
  const moodScore = entries.length ? entries.filter(e => e.mood >= 4).length / entries.length : null;

  const parts = [habitScore];
  if (avgEnergia !== null) parts.push(avgEnergia);
  if (avgSueno   !== null) parts.push(avgSueno);
  if (moodScore  !== null) parts.push(moodScore);

  return Math.round(parts.reduce((s, p) => s + p, 0) / parts.length * 100);
}

export function scoreFinanzas() {
  const { ing, gas, tasaAhorro } = calcMonthKPIs();
  if (ing <= 0) return 50;

  const tasaScore = Math.min(tasaAhorro / 0.3, 1);
  const cats = State.get('finCats') || [];
  const overBudget = cats.filter(f => catGastoMes(f.id) / (f.budget || 1) >= 1).length;
  const budgetPenalty = Math.min(overBudget * 0.15, 0.5);

  return Math.round(Math.max(0, tasaScore - budgetPenalty) * 100);
}

export function scoreProductividad() {
  const habits  = State.get('habits') || [];
  const metas   = State.get('metas')  || [];
  const plan    = State.get('plan')   || {};

  const habitScore = habits.length
    ? habits.reduce((s, h) => s + habitPct(h.id), 0) / habits.length
    : 0;
  const metaScore = metas.length
    ? metas.reduce((s, m) => s + (m.pct || 0), 0) / metas.length / 100
    : 0;
  const allTasks  = Object.values(plan);
  const taskScore = allTasks.length
    ? allTasks.filter(t => t.done).length / allTasks.length
    : 0.5;

  return Math.round(((habitScore * 0.4) + (metaScore * 0.4) + (taskScore * 0.2)) * 100);
}

export function scoreTrading() {
  const st = calcTradeStats();
  if (!st.totalTrades) return 50;
  const pfScore     = Math.min(st.profitFactor / 2, 1);
  const consistency = st.consistency / 100;
  return Math.round(((st.wr * 0.4) + (pfScore * 0.3) + (consistency * 0.3)) * 100);
}

export function lifeScoreBreakdown() {
  return {
    salud:         scoreSalud(),
    finanzas:      scoreFinanzas(),
    productividad: scoreProductividad(),
    trading:       scoreTrading(),
  };
}

export function lifeScore() {
  const b = lifeScoreBreakdown();
  return Math.round((b.salud + b.finanzas + b.productividad + b.trading) / 4);
}

// ── Nivel del score ───────────────────────
export function scoreLevel(s) {
  if (s >= 95) return { name: 'Legendario', next: 100, color: '#00E87A' };
  if (s >= 80) return { name: 'Elite',      next: 95,  color: '#4F8EF7' };
  if (s >= 60) return { name: 'Progreso',   next: 80,  color: '#8B5CF6' };
  if (s >= 40) return { name: 'Normal',     next: 60,  color: '#F59E0B' };
  if (s >= 20) return { name: 'Inestable',  next: 40,  color: '#EF4444' };
  return         { name: 'Crisis',    next: 20,  color: '#64748B' };
}

// ── Tendencia (vs semana / mes anterior) ─
export function scoreTrend() {
  const uid    = State.get('user')?.id;
  const hist   = (State.get('scoreHistory') || []).filter(h => h.userId === uid);
  const today  = lifeScore();
  if (!hist.length) return { weekly: 0, monthly: 0 };

  const now_     = Dates.now();
  const weekAgo  = Dates.daysAgo(7);
  const monthAgo = Dates.daysAgo(30);

  const weekSnap  = hist.filter(h => new Date(h.date) <= weekAgo).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const monthSnap = hist.filter(h => new Date(h.date) <= monthAgo).sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  return {
    weekly:  weekSnap  ? today - weekSnap.score  : 0,
    monthly: monthSnap ? today - monthSnap.score : 0,
  };
}

// ── Área crítica ─────────────────────────
export function areaCritica() {
  const b = lifeScoreBreakdown();
  const labels = { salud: 'Salud', finanzas: 'Finanzas', productividad: 'Productividad', trading: 'Trading' };
  const msgs   = {
    salud:         'Tus hábitos de salud y energía están bajos. Revisá sueño y rutina.',
    finanzas:      'Tus gastos están superando tu objetivo de ahorro este mes.',
    productividad: 'Tu cumplimiento de hábitos y metas viene flojo esta semana.',
    trading:       'Tu consistencia en trading necesita atención — revisá el journal.',
  };
  const [key, val] = Object.entries(b).sort((a, b) => a[1] - b[1])[0];
  return { key, label: labels[key], val, msg: msgs[key] };
}

// ── Gamificación — XP del usuario ────────
export function userXP() {
  const uid    = State.get('user')?.id;
  const habits = State.get('habits') || [];
  const logs   = State.get('habitLogs') || {};
  const mk     = Dates.monthKey();
  const days   = Dates.daysInMonth();

  let habitXP = 0;
  habits.forEach(h => {
    for (let d = 1; d <= days; d++) {
      if (logs[`${uid}:${mk}:${h.id}:${d}`]) habitXP += 10;
    }
  });

  const trades  = (State.get('trades') || []).filter(t => t.userId === uid);
  const tradingXP = trades.filter(t => t.result === 'Win').length * 20;
  const metaXP  = (State.get('metas') || []).reduce((s, m) => s + ((m.pct || 0) > 0 ? 15 : 0), 0);

  return habitXP + tradingXP + metaXP;
}
