// ═══════════════════════════════════════
// TRADING-CALC.JS — Motor de estadísticas profesional
// Separado de UI. Puede testearse de forma independiente.
// ═══════════════════════════════════════
import State from '../services/state.js';

// ── Helper interno ──────────────────────
function getUserTrades() {
  const uid = State.get('user')?.id;
  return (State.get('trades') || []).filter(t => t.userId === uid);
}

// ── Estadísticas completas ───────────────
export function calcTradeStats() {
  const trades = getUserTrades();
  if (!trades.length) return emptyStats();

  const wins   = trades.filter(t => t.result === 'Win');
  const losses = trades.filter(t => t.result === 'Loss');
  const bes    = trades.filter(t => t.result === 'Break Even');

  const wr = trades.length ? wins.length / trades.length : 0;
  const lr = trades.length ? losses.length / trades.length : 0;

  const pnl = trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0);
  const grossWin  = wins.reduce((s, t)   => s + (parseFloat(t.pnl) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0));

  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 99 : 0);
  const avgWin  = wins.length   ? grossWin  / wins.length   : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = (wr * avgWin) - (lr * avgLoss);

  // RR promedio (campo explícito preferido sobre ratio calculado)
  const tradesConRR = trades.filter(t => t.rr && parseFloat(t.rr) > 0);
  const rrAvg = tradesConRR.length
    ? tradesConRR.reduce((s, t) => s + parseFloat(t.rr), 0) / tradesConRR.length
    : (avgLoss > 0 ? avgWin / avgLoss : 0);

  // Riesgo % promedio
  const tradesConRiesgo = trades.filter(t => t.riesgo && parseFloat(t.riesgo) > 0);
  const riesgoAvg = tradesConRiesgo.length
    ? tradesConRiesgo.reduce((s, t) => s + parseFloat(t.riesgo), 0) / tradesConRiesgo.length
    : 0;

  // Drawdown desde pico de equity
  let peak = 0, cum = 0, maxDD = 0, currentDD = 0;
  trades.forEach(t => {
    cum += parseFloat(t.pnl) || 0;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  });
  currentDD = peak - cum;

  // Mejor y peor operación
  const sorted = [...trades].sort((a, b) => (parseFloat(b.pnl) || 0) - (parseFloat(a.pnl) || 0));
  const bestTrade  = sorted[0]  || null;
  const worstTrade = sorted[sorted.length - 1] || null;

  // Consistency score (coeficiente de variación invertido)
  const allPnls  = trades.map(t => parseFloat(t.pnl) || 0);
  const avgAbs   = allPnls.length ? allPnls.reduce((s, v) => s + Math.abs(v), 0) / allPnls.length : 0;
  const variance = allPnls.length ? allPnls.reduce((s, v) => s + Math.pow(Math.abs(v) - avgAbs, 2), 0) / allPnls.length : 0;
  const stdDev   = Math.sqrt(variance);
  const consistency = avgAbs > 0 ? Math.max(0, 100 - Math.min((stdDev / avgAbs) * 40, 100)) : 0;

  // Cumplimiento del plan
  const tradesConPlan = trades.filter(t => typeof t.cumplioPlan === 'boolean');
  const tasaCumplimiento = tradesConPlan.length
    ? tradesConPlan.filter(t => t.cumplioPlan).length / tradesConPlan.length
    : null;

  // Errores
  const errEmocional = trades.filter(t => t.errorEmocional).length;
  const errTecnico   = trades.filter(t => t.errorTecnico).length;

  const violations = Object.values((State.get('tradeErrors') || {})[State.get('user')?.id] || {})
    .reduce((s, v) => s + v, 0);

  // Racha actual
  let currentStreak = 0, streakType = null;
  for (let i = trades.length - 1; i >= 0; i--) {
    const r = trades[i].result;
    if (streakType === null && r !== 'Break Even') { streakType = r; currentStreak = 1; }
    else if (r === streakType) currentStreak++;
    else break;
  }

  return {
    trades, wins, losses, bes,
    totalTrades: trades.length,
    wr, lr, pnl, grossWin, grossLoss,
    profitFactor, avgWin, avgLoss,
    expectancy, rrAvg, riesgoAvg,
    maxDD, currentDD,
    bestTrade, worstTrade,
    consistency, violations,
    tasaCumplimiento, errEmocional, errTecnico,
    currentStreak, streakType,
  };
}

// ── Análisis por setup ───────────────────
export function calcSetupAnalysis() {
  const trades = getUserTrades();
  const setups = {};
  trades.forEach(t => {
    if (!t.setup) return;
    if (!setups[t.setup]) setups[t.setup] = { wins: 0, losses: 0, total: 0, pnl: 0 };
    setups[t.setup].total++;
    setups[t.setup].pnl += parseFloat(t.pnl) || 0;
    if (t.result === 'Win')  setups[t.setup].wins++;
    if (t.result === 'Loss') setups[t.setup].losses++;
  });
  return Object.entries(setups)
    .map(([name, s]) => ({ name, ...s, wr: s.total ? s.wins / s.total : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

// ── Análisis por sesión/horario ──────────
export function calcSessionAnalysis() {
  const trades = getUserTrades();
  const sessions = {};
  trades.forEach(t => {
    if (!t.hour) return;
    if (!sessions[t.hour]) sessions[t.hour] = { wins: 0, total: 0, pnl: 0 };
    sessions[t.hour].total++;
    sessions[t.hour].pnl += parseFloat(t.pnl) || 0;
    if (t.result === 'Win') sessions[t.hour].wins++;
  });
  return Object.entries(sessions)
    .map(([name, s]) => ({ name, ...s, wr: s.total ? s.wins / s.total : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

// ── Análisis por día de la semana ────────
export function calcDayOfWeekAnalysis() {
  const trades = getUserTrades();
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const byDay = {};
  trades.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const dayName = DAYS[d.getDay()];
    if (!byDay[dayName]) byDay[dayName] = { wins: 0, total: 0, pnl: 0 };
    byDay[dayName].total++;
    byDay[dayName].pnl += parseFloat(t.pnl) || 0;
    if (t.result === 'Win') byDay[dayName].wins++;
  });
  return Object.entries(byDay)
    .map(([name, s]) => ({ name, ...s, wr: s.total ? s.wins / s.total : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

// ── Calendario de operaciones ────────────
// Devuelve un mapa { "YYYY-MM-DD": { wins, losses, pnl, count } }
export function calcTradeCalendar() {
  const trades = getUserTrades();
  const cal = {};
  trades.forEach(t => {
    if (!t.date) return;
    if (!cal[t.date]) cal[t.date] = { wins: 0, losses: 0, bes: 0, pnl: 0, count: 0 };
    cal[t.date].count++;
    cal[t.date].pnl += parseFloat(t.pnl) || 0;
    if (t.result === 'Win')         cal[t.date].wins++;
    else if (t.result === 'Loss')   cal[t.date].losses++;
    else                            cal[t.date].bes++;
  });
  return cal;
}

// ── Equity curve ─────────────────────────
export function calcEquityCurve() {
  const trades = getUserTrades();
  let cum = 0;
  return trades.map((t, i) => {
    cum += parseFloat(t.pnl) || 0;
    return { label: `Op ${i + 1}`, value: cum, date: t.date };
  });
}

// ── Fondeo dashboard ─────────────────────
export function calcFundedProgress(config) {
  const { capitalInicial, objetivo, maxDrawdown, currentPnl } = config;
  const capitalActual = capitalInicial + currentPnl;
  const distanciaObjetivo = objetivo - capitalActual;
  const drawdownUsado = Math.min(currentPnl, 0); // solo negativo
  const drawdownRestante = maxDrawdown - Math.abs(drawdownUsado);
  const pctObjetivo = objetivo > 0 ? Math.min(currentPnl / (objetivo - capitalInicial), 1) : 0;
  const pctDrawdown = maxDrawdown > 0 ? Math.abs(drawdownUsado) / maxDrawdown : 0;
  return {
    capitalInicial, capitalActual, objetivo,
    distanciaObjetivo, drawdownUsado, drawdownRestante,
    pctObjetivo: Math.max(0, pctObjetivo),
    pctDrawdown,
    enRiesgo: pctDrawdown >= 0.8,
    objetivoAlcanzado: capitalActual >= objetivo,
  };
}

// ── Limit check (max 2 trades por día) ──
export function canAddTradeToday(dateISO) {
  const trades = getUserTrades();
  const count = trades.filter(t => t.date === dateISO).length;
  return { allowed: count < 2, count, max: 2 };
}

// ── Stats vacías ─────────────────────────
function emptyStats() {
  return {
    trades: [], wins: [], losses: [], bes: [],
    totalTrades: 0, wr: 0, lr: 0, pnl: 0,
    grossWin: 0, grossLoss: 0, profitFactor: 0,
    avgWin: 0, avgLoss: 0, expectancy: 0,
    rrAvg: 0, riesgoAvg: 0, maxDD: 0, currentDD: 0,
    bestTrade: null, worstTrade: null,
    consistency: 0, violations: 0,
    tasaCumplimiento: null, errEmocional: 0, errTecnico: 0,
    currentStreak: 0, streakType: null,
  };
}
