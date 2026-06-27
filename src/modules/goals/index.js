// ═══════════════════════════════════════
// GOALS/INDEX.JS — Sistema de objetivos
// Tipos: Financiero, Trading, Hábito, Personal
// ═══════════════════════════════════════
import State from '../../services/state.js';
import { DB, genId } from '../../services/db.js';
import { Dates } from '../../utils/dates.js';
import { Fmt } from '../../utils/formatters.js';
import { Validators } from '../../utils/validators.js';
import { DOM } from '../../components/dom.js';
import { calcTradeStats } from '../../services/trading-calc.js';
import { calcMonthKPIs, calcPatrimonio } from '../../services/finance-calc.js';
import { habitDoneCount, habitStreak } from '../../services/score-calc.js';

// ── Tipos de objetivo ─────────────────────
export const GOAL_TYPES = {
  financiero: { label: 'Financiero',  icon: '💰', color: '#00E87A' },
  trading:    { label: 'Trading',     icon: '📈', color: '#F59E0B' },
  habito:     { label: 'Hábito',      icon: '🔥', color: '#8B5CF6' },
  personal:   { label: 'Personal',    icon: '🎯', color: '#4F8EF7' },
};

// ── Estado del módulo ─────────────────────
let activeFilter = 'todos';
let activeGoalModal = null;  // id del objetivo expandido

// ═══════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════
export function renderGoals() {
  const container = document.getElementById('page-metas');
  if (!container) return;

  const goals   = getGoals();
  const summary = calcGoalsSummary(goals);

  container.innerHTML = `
    <!-- Header stats -->
    <div class="goals-summary">
      <div class="goals-summary-card">
        <div class="gscard-num" style="color:var(--green)">${summary.completados}</div>
        <div class="gscard-lbl">Completados</div>
      </div>
      <div class="goals-summary-card">
        <div class="gscard-num" style="color:var(--blue)">${summary.enProgreso}</div>
        <div class="gscard-lbl">En progreso</div>
      </div>
      <div class="goals-summary-card">
        <div class="gscard-num" style="color:${summary.vencidos > 0 ? 'var(--red)' : 'var(--t3)'}">${summary.vencidos}</div>
        <div class="gscard-lbl">Vencidos</div>
      </div>
      <div class="goals-summary-card">
        <div class="gscard-num" style="color:var(--purple)">${Math.round(summary.avgPct)}%</div>
        <div class="gscard-lbl">Progreso promedio</div>
      </div>
    </div>

    <!-- Progreso general ring -->
    ${renderOverallRing(summary)}

    <!-- Filtros por tipo -->
    <div class="goals-filter-row">
      ${['todos','financiero','trading','habito','personal'].map(f => `
        <button onclick="filterGoals('${f}')" class="chip ${activeFilter === f ? 'chip-active' : ''}">
          ${f === 'todos' ? '📋 Todos' : GOAL_TYPES[f].icon + ' ' + GOAL_TYPES[f].label}
        </button>`).join('')}
    </div>

    <!-- Lista de objetivos -->
    <div id="goals-list">
      ${renderGoalsList(goals)}
    </div>

    <!-- FAB -->
    <button onclick="openNewGoalModal()" class="fab" style="background:var(--green);bottom:80px">+</button>`;
}

function renderOverallRing(summary) {
  const pct  = summary.total > 0 ? summary.avgPct : 0;
  const circ = 163;  // 2π × 26
  const dash = circ * (pct / 100);

  return `<div class="card card-p" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:20px">
      <svg viewBox="0 0 60 60" width="70" height="70" style="flex-shrink:0">
        <circle cx="30" cy="30" r="26" fill="none" stroke="var(--s4)" stroke-width="6"/>
        <circle cx="30" cy="30" r="26" fill="none"
          stroke="${pct >= 80 ? '#00E87A' : pct >= 50 ? '#4F8EF7' : '#F59E0B'}"
          stroke-width="6" stroke-dasharray="${dash} ${circ}"
          stroke-dashoffset="${circ / 4}"
          stroke-linecap="round"
          style="transition:stroke-dasharray .5s ease"/>
        <text x="30" y="34" text-anchor="middle" font-size="11" font-weight="800" fill="var(--off)">${Math.round(pct)}%</text>
      </svg>
      <div style="flex:1">
        <div style="font-size:11px;color:var(--t3);margin-bottom:2px">Progreso general de objetivos</div>
        <div style="font-size:16px;font-weight:800;color:var(--off)">${summary.total} objetivo${summary.total !== 1 ? 's' : ''}</div>
        <div style="display:flex;gap:10px;margin-top:8px">
          ${Object.entries(GOAL_TYPES).map(([k, v]) => {
            const cnt = (State.get('goals') || []).filter(g => g.userId === State.get('user')?.id && g.tipo === k).length;
            return cnt > 0 ? `<span style="font-size:10px;color:var(--t3)">${v.icon} ${cnt}</span>` : '';
          }).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function renderGoalsList(all) {
  const goals = activeFilter === 'todos'
    ? all
    : all.filter(g => g.tipo === activeFilter);

  if (!goals.length) {
    return `<div class="empty-state">
      <div style="font-size:40px;margin-bottom:12px">🎯</div>
      <div class="empty-title">Sin objetivos${activeFilter !== 'todos' ? ' de este tipo' : ''}</div>
      <div class="empty-subtitle">Definí un objetivo para empezar a medir tu progreso</div>
      <button onclick="openNewGoalModal('${activeFilter !== 'todos' ? activeFilter : ''}')" class="btn btn-ghost btn-sm" style="margin-top:10px">+ Crear objetivo</button>
    </div>`;
  }

  // Ordenar: en progreso primero, completados al final, vencidos entre medio
  const sorted = [...goals].sort((a, b) => {
    const statusOrder = { progreso: 0, vencido: 1, completado: 2 };
    return (statusOrder[getGoalStatus(a)] ?? 0) - (statusOrder[getGoalStatus(b)] ?? 0);
  });

  return sorted.map(g => renderGoalCard(g)).join('');
}

function renderGoalCard(g) {
  const tipo    = GOAL_TYPES[g.tipo] || GOAL_TYPES.personal;
  const status  = getGoalStatus(g);
  const pct     = Math.min(100, Math.max(0, g.pct || 0));
  const daysRem = Fmt.daysRemaining(g.fechaLimite);
  const proj    = calcGoalProjection(g);

  const statusBadge = {
    completado: `<span style="font-size:9px;padding:2px 7px;border-radius:100px;background:rgba(0,232,122,.15);color:var(--green);font-weight:700">✓ Completado</span>`,
    vencido:    `<span style="font-size:9px;padding:2px 7px;border-radius:100px;background:rgba(239,68,68,.15);color:var(--red);font-weight:700">⚠ Vencido</span>`,
    progreso:   daysRem !== null && daysRem <= 7 && daysRem >= 0
      ? `<span style="font-size:9px;padding:2px 7px;border-radius:100px;background:rgba(245,158,11,.15);color:var(--amber);font-weight:700">⏰ ${daysRem}d restantes</span>`
      : '',
  }[status] || '';

  const autoData = g.autoCalc ? getAutoProgress(g) : null;
  const displayPct = autoData !== null ? Math.round(autoData * 100) : pct;
  const displayVal = autoData !== null ? Math.round(autoData * 100) : pct;

  return `<div class="goal-card ${status === 'completado' ? 'goal-completed' : ''}" id="goal-${g.id}" onclick="toggleGoalDetail('${g.id}')">
    <div class="goal-card-header">
      <div class="goal-type-badge" style="background:${tipo.color}20;border:1px solid ${tipo.color}40">
        <span>${tipo.icon}</span>
        <span style="font-size:9px;font-weight:700;color:${tipo.color}">${tipo.label.toUpperCase()}</span>
      </div>
      ${statusBadge}
    </div>

    <div style="display:flex;align-items:flex-start;gap:12px;margin:10px 0">
      <div style="font-size:26px;flex-shrink:0">${g.icon || tipo.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--off);margin-bottom:2px">${Fmt.escHtml(g.name)}</div>
        ${g.desc ? `<div style="font-size:11px;color:var(--t3)">${Fmt.escHtml(g.desc)}</div>` : ''}
      </div>
      <div style="font-size:22px;font-weight:800;font-family:var(--mono);color:${tipo.color};flex-shrink:0">
        ${displayVal}%
      </div>
    </div>

    <!-- Barra de progreso -->
    <div class="goal-progress-track">
      <div class="goal-progress-fill" style="width:${displayPct}%;background:${tipo.color};transition:width .6s cubic-bezier(.4,0,.2,1)"></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:10px;color:var(--t3)">
      <span>${g.meta ? Fmt.escHtml(g.meta) : ''}</span>
      ${g.fechaLimite ? `<span>${Fmt.displayDate(g.fechaLimite)}</span>` : ''}
    </div>

    <!-- Detalle expandible -->
    <div id="goal-detail-${g.id}" style="display:none;margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
      ${renderGoalDetail(g, proj, autoData)}
    </div>
  </div>`;
}

function renderGoalDetail(g, proj, autoData) {
  const tipo = GOAL_TYPES[g.tipo] || GOAL_TYPES.personal;

  const kpis = [
    g.tipo === 'financiero' && g.metaValor ? { label: 'Meta ($)', val: Fmt.currencyFull(g.metaValor), color: tipo.color } : null,
    g.tipo === 'financiero' && g.avanceValor ? { label: 'Acumulado', val: Fmt.currencyFull(g.avanceValor), color: 'var(--off)' } : null,
    g.fechaLimite ? { label: 'Vence', val: Fmt.displayDate(g.fechaLimite), color: 'var(--t2)' } : null,
    proj.estimatedDays !== null ? { label: 'Est. completar', val: proj.estimatedDays <= 0 ? 'Hoy ✓' : `${proj.estimatedDays}d`, color: proj.onTrack ? 'var(--green)' : 'var(--amber)' } : null,
    proj.velocity !== null ? { label: 'Velocidad', val: `+${proj.velocity.toFixed(1)}%/sem`, color: 'var(--blue)' } : null,
  ].filter(Boolean);

  return `
    ${kpis.length ? `<div class="kpi-grid-${kpis.length >= 4 ? '2' : kpis.length}" style="margin-bottom:12px">
      ${kpis.map(k => `<div class="kpi-box">
        <div class="kpi-box-val mono" style="color:${k.color}">${k.val}</div>
        <div class="kpi-box-lbl">${k.label}</div>
      </div>`).join('')}
    </div>` : ''}

    ${proj.projectedDate ? `<div style="font-size:11px;color:var(--t3);margin-bottom:10px">
      📅 A este ritmo, lo completarás el <strong style="color:var(--off)">${Fmt.displayDate(proj.projectedDate)}</strong>
      ${proj.onTrack ? '✅' : '⚠️ Por debajo del ritmo esperado'}
    </div>` : ''}

    ${autoData !== null ? `<div style="font-size:11px;padding:8px 12px;border-radius:10px;background:rgba(79,142,247,.08);border:1px solid rgba(79,142,247,.2);color:var(--blue);margin-bottom:10px">
      ⚡ Progreso calculado automáticamente desde tus datos
    </div>` : ''}

    <!-- Actualizar progreso manualmente -->
    ${!g.autoCalc ? `<div style="display:flex;gap:8px;align-items:center">
      <input type="range" id="goal-slider-${g.id}" min="0" max="100" value="${g.pct || 0}"
        oninput="updateGoalPctLive('${g.id}', this.value)"
        style="flex:1;accent-color:${tipo.color}">
      <span id="goal-pct-label-${g.id}" style="font-size:13px;font-weight:800;font-family:var(--mono);color:${tipo.color};min-width:40px">${g.pct || 0}%</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="saveGoalPct('${g.id}');event.stopPropagation()" class="btn btn-green btn-sm" style="flex:1">Guardar progreso</button>
      <button onclick="deleteGoal('${g.id}');event.stopPropagation()" class="btn btn-ghost btn-sm" style="color:var(--red)">Eliminar</button>
    </div>` : `<button onclick="deleteGoal('${g.id}');event.stopPropagation()" class="btn btn-ghost btn-sm" style="color:var(--red);width:100%;margin-top:4px">Eliminar objetivo</button>`}`;
}

// ═══════════════════════════════════════
// CÁLCULO DE PROGRESO AUTOMÁTICO
// ═══════════════════════════════════════
function getAutoProgress(g) {
  const uid = State.get('user')?.id;
  try {
    switch (g.autoCalcType) {
      case 'habit_pct': {
        const h = (State.get('habits') || []).find(h => h.id === g.linkedId);
        if (!h) return null;
        const done = habitDoneCount(h.id);
        const target = g.autoTarget || 30;
        return Math.min(done / target, 1);
      }
      case 'habit_streak': {
        const streak = habitStreak(g.linkedId);
        const target = g.autoTarget || 30;
        return Math.min(streak / target, 1);
      }
      case 'trade_wr': {
        const st = calcTradeStats();
        const target = g.autoTarget || 0.6;
        return Math.min((st.wr || 0) / target, 1);
      }
      case 'trade_pf': {
        const st = calcTradeStats();
        const target = g.autoTarget || 2;
        return Math.min((st.profitFactor || 0) / target, 1);
      }
      case 'trade_pnl': {
        const st = calcTradeStats();
        const target = g.autoTarget || 1000;
        return Math.max(0, Math.min((st.pnl || 0) / target, 1));
      }
      case 'fin_ahorro': {
        const { ahorro } = calcMonthKPIs();
        const target = g.autoTarget || 500;
        return Math.max(0, Math.min(ahorro / target, 1));
      }
      case 'fin_patrimonio': {
        const { neto } = calcPatrimonio();
        const target = g.autoTarget || 10000;
        return Math.max(0, Math.min(neto / target, 1));
      }
      default:
        return null;
    }
  } catch { return null; }
}

// ═══════════════════════════════════════
// PROYECCIÓN DE OBJETIVO
// ═══════════════════════════════════════
function calcGoalProjection(g) {
  const uid  = State.get('user')?.id;
  const hist = (State.get('scoreHistory') || []).filter(h => h.userId === uid);
  const pct  = g.pct || 0;
  const today = Dates.todayISO();

  // Velocidad: % ganado por semana basado en historial
  // Estimación simple: si no hay historial, asumimos que lleva 0 días
  const createdAt = g.createdAt || today;
  const daysElapsed = Math.max(1, Dates.diffDays ? (new Date() - new Date(createdAt + 'T00:00:00')) / 86400000 : 7);
  const velocity = daysElapsed > 0 ? (pct / daysElapsed) * 7 : 0; // % por semana

  const remaining     = 100 - pct;
  const estimatedDays = velocity > 0 ? Math.ceil((remaining / velocity) * 7) : null;
  const projectedDate = estimatedDays !== null
    ? new Date(Date.now() + estimatedDays * 86400000).toISOString().split('T')[0]
    : null;

  const onTrack = g.fechaLimite && projectedDate
    ? projectedDate <= g.fechaLimite
    : true;

  return { velocity, estimatedDays, projectedDate, onTrack };
}

// ═══════════════════════════════════════
// RESUMEN GENERAL
// ═══════════════════════════════════════
function calcGoalsSummary(goals) {
  const completados = goals.filter(g => getGoalStatus(g) === 'completado').length;
  const vencidos    = goals.filter(g => getGoalStatus(g) === 'vencido').length;
  const enProgreso  = goals.filter(g => getGoalStatus(g) === 'progreso').length;
  const avgPct      = goals.length ? goals.reduce((s, g) => s + (g.pct || 0), 0) / goals.length : 0;
  return { total: goals.length, completados, vencidos, enProgreso, avgPct };
}

function getGoalStatus(g) {
  if ((g.pct || 0) >= 100) return 'completado';
  if (g.fechaLimite && g.fechaLimite < Dates.todayISO() && (g.pct || 0) < 100) return 'vencido';
  return 'progreso';
}

function getGoals() {
  const uid = State.get('user')?.id;
  return (State.get('goals') || []).filter(g => g.userId === uid);
}

// ═══════════════════════════════════════
// ACCIONES
// ═══════════════════════════════════════
window.toggleGoalDetail = function(id) {
  const el = document.getElementById(`goal-detail-${id}`);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
};

window.filterGoals = function(f) {
  activeFilter = f;
  renderGoals();
};

window.updateGoalPctLive = function(id, val) {
  const label = document.getElementById(`goal-pct-label-${id}`);
  if (label) label.textContent = val + '%';
  const fill = document.querySelector(`#goal-${id} .goal-progress-fill`);
  if (fill) fill.style.width = val + '%';
  // Guardar temporalmente
  const goals = [...(State.get('goals') || [])];
  const idx   = goals.findIndex(g => g.id === id);
  if (idx !== -1) goals[idx] = { ...goals[idx], _tempPct: parseInt(val) };
  State.setState({ goals });
};

window.saveGoalPct = async function(id) {
  const slider = document.getElementById(`goal-slider-${id}`);
  if (!slider) return;
  const pct    = parseInt(slider.value);
  const status = pct >= 100 ? 'completado' : 'progreso';
  await DB.updateGoal(id, { pct, status });
  DOM.toast(pct >= 100 ? '🎉 ¡Objetivo completado!' : 'Progreso actualizado ✓');
  renderGoals();
};

window.deleteGoal = async function(id) {
  if (!confirm('¿Eliminar este objetivo?')) return;
  await DB.deleteGoal(id);
  DOM.toast('Objetivo eliminado');
  renderGoals();
};

window.openNewGoalModal = function(tipo = '') {
  DOM.setVal('goal-tipo', tipo);
  DOM.setVal('goal-name', '');
  DOM.setVal('goal-desc', '');
  DOM.setVal('goal-icon', '');
  DOM.setVal('goal-meta', '');
  DOM.setVal('goal-fecha', '');
  DOM.setVal('goal-meta-valor', '');
  DOM.setVal('goal-auto-calc', '');
  DOM.setVal('goal-auto-target', '');
  DOM.openModal('modal-new-goal');
};

export async function addGoal() {
  const name      = DOM.val('goal-name');
  const tipo      = DOM.val('goal-tipo') || 'personal';
  const desc      = DOM.val('goal-desc');
  const icon      = DOM.val('goal-icon') || GOAL_TYPES[tipo]?.icon || '🎯';
  const meta      = DOM.val('goal-meta');
  const fechaLimite = DOM.val('goal-fecha') || null;
  const metaValor = DOM.numVal('goal-meta-valor') || null;
  const autoCalcType = DOM.val('goal-auto-calc') || null;
  const autoTarget   = DOM.numVal('goal-auto-target') || null;

  const errors = Validators.meta({ name, pct: 0 });
  if (Validators.hasErrors(errors)) {
    DOM.toast(Object.values(errors)[0], 'error');
    return;
  }

  const uid  = State.get('user')?.id;
  const goal = {
    id: genId(), userId: uid, tipo, name, desc, icon, meta,
    fechaLimite, metaValor, avanceValor: 0,
    pct: 0, status: 'progreso',
    autoCalc: !!autoCalcType, autoCalcType, autoTarget,
    createdAt: Dates.todayISO(),
  };

  await DB.addGoal(goal);
  DOM.closeModal('modal-new-goal');
  DOM.toast('Objetivo creado ✓');
  renderGoals();
}

window.addGoal = addGoal;
