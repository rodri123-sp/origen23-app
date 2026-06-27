// ═══════════════════════════════════════
// FINANCE-CALC.JS — Motor financiero profesional
// ═══════════════════════════════════════
import State from '../services/state.js';
import { Dates } from '../utils/dates.js';

// ── Helpers ──────────────────────────────
function getFinData() {
  const uid = State.get('user')?.id;
  const fd = State.get('finData')?.[uid];
  if (!fd) return {
    movimientos: [], activos: {}, pasivos: {},
    emergencia: { gastos: 0, meses: 6, actual: 0 },
    proyeccion: { ahorro: 0, rentabilidad: 8 },
    inversiones: [],
  };
  return fd;
}

function getIngreso() {
  const uid = State.get('user')?.id;
  const mk = Dates.monthKey();
  return State.get('ingresos')?.[`${uid}_${mk}`] || 0;
}

// ── Movimientos filtrados por mes ────────
export function movsThisMonth() {
  const fd = getFinData();
  const mk = Dates.monthKey();
  return fd.movimientos.filter(m => m.fecha && m.fecha.startsWith(mk));
}

export function movsPrevMonth() {
  const fd = getFinData();
  const d = Dates.now();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const pk = Dates.monthKey(prev);
  return fd.movimientos.filter(m => m.fecha && m.fecha.startsWith(pk));
}

export function movsThisYear() {
  const fd = getFinData();
  const year = String(Dates.currentYear());
  return fd.movimientos.filter(m => m.fecha && m.fecha.startsWith(year));
}

export function movsByPeriod(period) {
  const fd = getFinData();
  const today = new Date();
  switch (period) {
    case 'hoy': {
      const iso = Dates.todayISO();
      return fd.movimientos.filter(m => m.fecha === iso);
    }
    case 'semana': {
      const weekAgo = Dates.daysAgo(7);
      return fd.movimientos.filter(m => new Date(m.fecha) >= weekAgo);
    }
    case 'mes':
      return movsThisMonth();
    case 'año':
      return movsThisYear();
    default:
      return fd.movimientos;
  }
}

// ── Suma por tipo ─────────────────────────
export function sumByTipo(movs, tipo) {
  return movs.filter(m => m.tipo === tipo).reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
}

// ── KPIs del mes ─────────────────────────
export function calcMonthKPIs() {
  const movs  = movsThisMonth();
  const prevMovs = movsPrevMonth();

  const ing  = sumByTipo(movs, 'ingreso') + getIngreso();
  const gas  = sumByTipo(movs, 'gasto');
  const inv  = sumByTipo(movs, 'inversion');
  const ahorro = ing - gas;

  const ingPrev = sumByTipo(prevMovs, 'ingreso') || ing || 0;
  const gasPrev = sumByTipo(prevMovs, 'gasto') || 0;

  const tasaAhorro = ing > 0 ? ahorro / ing : 0;
  const ingTrend = ingPrev > 0 ? ((ing - ingPrev) / ingPrev) * 100 : 0;
  const gasTrend = gasPrev > 0 ? ((gas - gasPrev) / gasPrev) * 100 : 0;

  return { ing, gas, ahorro, tasaAhorro, inv, ingTrend, gasTrend };
}

// ── Gasto por categoría (este mes) ───────
export function catGastoMes(catId) {
  return movsThisMonth()
    .filter(m => m.tipo === 'gasto' && m.catId === catId)
    .reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
}

// ── Patrimonio ───────────────────────────
export function calcPatrimonio() {
  const fd = getFinData();
  const a = fd.activos || {};
  const p = fd.pasivos || {};

  const totalA = (a.efectivo || 0) + (a.mp || 0) + (a.banco || 0) + (a.inversiones || 0) + (a.otros || 0);
  const totalP = (p.tarjetas || 0) + (p.prestamos || 0) + (p.deudas || 0) + (p.otros || 0);
  const neto   = totalA - totalP;

  // Ratios financieros profesionales
  const ratioAhorro      = calcMonthKPIs().tasaAhorro;
  const ratioEndeudamiento = totalA > 0 ? totalP / totalA : 0;
  const ratioInversion   = totalA > 0 ? (a.inversiones || 0) / totalA : 0;
  const liquidez         = (a.efectivo || 0) + (a.mp || 0) + (a.banco || 0);

  return { totalA, totalP, neto, liquidez, ratioAhorro, ratioEndeudamiento, ratioInversion, activos: a, pasivos: p };
}

// ── Inversiones ───────────────────────────
export function calcInversionesStats() {
  const fd = getFinData();
  const invs = fd.inversiones || [];
  const capitalTotal = invs.reduce((s, i) => s + (i.capital || 0), 0);
  const valorTotal   = invs.reduce((s, i) => s + (i.valor || i.capital || 0), 0);
  const gananciaTotal = valorTotal - capitalTotal;
  const rentTotal    = capitalTotal > 0 ? gananciaTotal / capitalTotal : 0;
  return { invs, capitalTotal, valorTotal, gananciaTotal, rentTotal };
}

// ── Fondo de emergencia ───────────────────
export function calcEmergencia() {
  const fd = getFinData();
  const em = fd.emergencia || { gastos: 0, meses: 6, actual: 0 };
  const objetivo = (em.gastos || 0) * (em.meses || 6);
  const actual   = em.actual || 0;
  const ratio    = objetivo > 0 ? Math.min(actual / objetivo, 1) : 0;
  const falta    = Math.max(0, objetivo - actual);
  const { ahorro } = calcMonthKPIs();
  const mesesParaCompletar = falta > 0 && ahorro > 0 ? Math.ceil(falta / ahorro) : null;
  return { ...em, objetivo, ratio, falta, mesesParaCompletar };
}

// ── Proyección de riqueza ─────────────────
// Valor Futuro con interés compuesto mensual
export function calcProjection(months, overrides = {}) {
  const fd = getFinData();
  const proy = fd.proyeccion || { ahorro: 0, rentabilidad: 8 };
  const { ahorro } = calcMonthKPIs();

  const ahorroMensual = overrides.ahorro !== undefined ? overrides.ahorro : (proy.ahorro || ahorro || 0);
  const rentAnual     = (overrides.rentabilidad !== undefined ? overrides.rentabilidad : (proy.rentabilidad || 8)) / 100;
  const rentMensual   = rentAnual / 12;

  const points = [];
  let total = 0;
  for (let i = 0; i <= months; i++) {
    if (i > 0) total = (total + ahorroMensual) * (1 + rentMensual);
    points.push({ month: i, value: total });
  }
  return points;
}

// ── Heatmap financiero (últimos N días) ──
export function calcFinHeatmap(days = 90) {
  const fd = getFinData();
  const today = new Date();
  const result = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];

    const dayMovs = fd.movimientos.filter(m => m.fecha === key);
    const ingresos_ = sumByTipo(dayMovs, 'ingreso');
    const gastos_   = sumByTipo(dayMovs, 'gasto');
    const balance   = ingresos_ - gastos_;

    result.push({ date: key, ingresos: ingresos_, gastos: gastos_, balance, count: dayMovs.length });
  }

  const maxGasto = Math.max(...result.map(r => r.gastos), 1);
  return result.map(r => ({ ...r, intensity: r.gastos / maxGasto }));
}

// ── Evolución histórica (últimos 6 meses) ─
export function calcMonthlyHistory(monthsBack = 6) {
  const fd = getFinData();
  const today = new Date();
  const result = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const mk = Dates.monthKey(d);
    const movs = fd.movimientos.filter(m => m.fecha && m.fecha.startsWith(mk));
    const ing  = sumByTipo(movs, 'ingreso') + (i === 0 ? getIngreso() : 0);
    const gas  = sumByTipo(movs, 'gasto');
    result.push({
      label: d.toLocaleDateString('es', { month: 'short' }),
      key: mk, ing, gas, ahorro: ing - gas,
    });
  }
  return result;
}

// ── Alertas inteligentes ──────────────────
export function calcAlerts() {
  const alerts = [];
  const cats = State.get('finCats') || [];
  const { ing, gas, tasaAhorro } = calcMonthKPIs();

  cats.forEach(f => {
    const spent = catGastoMes(f.id);
    const ratio = f.budget > 0 ? spent / f.budget : 0;
    if (ratio >= 1) alerts.push({ type: 'red',   cat: f, spent, ratio, msg: `Presupuesto de ${f.name} superado (${Math.round(ratio * 100)}%)` });
    else if (ratio >= 0.8) alerts.push({ type: 'amber', cat: f, spent, ratio, msg: `${f.name} al ${Math.round(ratio * 100)}% del presupuesto` });
  });

  if (ing > 0 && gas > ing)
    alerts.push({ type: 'red', msg: `Gastaste $${Math.round(gas - ing).toLocaleString()} más de lo que ingresaste` });

  if (tasaAhorro >= 0.2)
    alerts.push({ type: 'green', msg: `Tasa de ahorro ${Math.round(tasaAhorro * 100)}% — excelente desempeño` });

  return alerts;
}

// ── Exportar finData (para acceso directo cuando sea necesario) ──
export { getFinData, getIngreso };
