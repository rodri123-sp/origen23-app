// ═══════════════════════════════════════
// TRADING/INDEX.JS — Módulo de trading profesional
// Métricas nivel fondeo. Separado de UI y lógica.
// ═══════════════════════════════════════
import State from '../../services/state.js';
import { DB, genId } from '../../services/db.js';
import { Dates } from '../../utils/dates.js';
import { Fmt } from '../../utils/formatters.js';
import { Validators } from '../../utils/validators.js';
import { DOM } from '../../components/dom.js';
import {
  calcTradeStats, calcSetupAnalysis, calcSessionAnalysis,
  calcDayOfWeekAnalysis, calcTradeCalendar, calcEquityCurve,
  calcFundedProgress, canAddTradeToday,
} from '../../services/trading-calc.js';

// ── Configuración de fondeo (customizable) ──
const FUNDED_DEFAULTS = {
  FundedNext:  { nombre: 'FundedNext',  maxDD: 0.10, objetivo: 0.10 },
  FTMO:        { nombre: 'FTMO',        maxDD: 0.10, objetivo: 0.10 },
  'The5ers':   { nombre: 'The5ers',     maxDD: 0.06, objetivo: 0.06 },
  FundingPips: { nombre: 'FundingPips', maxDD: 0.08, objetivo: 0.08 },
};

let currentFirma  = 'FundedNext';
let capitalInicial = 10000;

// ── Tab activo ────────────────────────────
let activeTab = 'overview';

// ── Checklist temporal ────────────────────
let tempPreCheck  = {};
let tempPostCheck = {};

const PRE_CHECKLIST = [
  { id: 'sesgo',   label: 'Sesgo definido (alcista/bajista)' },
  { id: 'liquidez',label: 'Liquidez identificada' },
  { id: 'poi',     label: 'POI marcado (order block / FVG)' },
  { id: 'riesgo',  label: 'Gestión de riesgo definida' },
  { id: 'horario', label: 'Horario válido (sesión activa)' },
];
const POST_CHECKLIST = [
  { id: 'plan',     label: 'Respeté el plan original' },
  { id: 'gestion',  label: 'Gestioné correctamente el riesgo' },
  { id: 'capturas', label: 'Registré capturas / evidencia' },
  { id: 'errores',  label: 'Identifiqué errores cometidos' },
];

// ═══════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════
export function renderTrading() {
  switchTab(activeTab, false);
}

export function switchTab(tab, rerender = true) {
  activeTab = tab;
  const tabs    = ['overview', 'journal', 'fondeo', 'checklist', 'calendario', 'errores'];
  const tabEls  = document.querySelectorAll('#page-trading .tab-switch-btn');
  tabEls.forEach((b, i) => b.classList.toggle('active', tabs[i] === tab));

  tabs.forEach(t => DOM.toggle('trade-' + t, t === tab));

  if (rerender) {
    const renders = {
      overview:   renderOverview,
      journal:    renderJournal,
      fondeo:     renderFondeo,
      checklist:  renderChecklist,
      calendario: renderCalendario,
      errores:    renderErrores,
    };
    (renders[tab] || renderOverview)();
  }
}

// ═══════════════════════════════════════
// OVERVIEW — Métricas profesionales
// ═══════════════════════════════════════
function renderOverview() {
  const st = calcTradeStats();
  const setups   = calcSetupAnalysis();
  const sessions = calcSessionAnalysis();
  const days     = calcDayOfWeekAnalysis();
  const curve    = calcEquityCurve();

  const container = document.getElementById('trade-overview');
  if (!container) return;

  // Win rate ring + KPIs top
  const wrPct = Math.round(st.wr * 100);
  const circ  = 232.5;

  container.innerHTML = `
    <div style="text-align:center;padding:10px 0 14px">
      <div class="wr-ring">
        <svg viewBox="0 0 100 100" width="100" height="100">
          <circle class="wr-bg" cx="50" cy="50" r="37"/>
          <circle class="wr-fg" cx="50" cy="50" r="37"
            stroke-dasharray="${circ}"
            stroke-dashoffset="${circ - circ * st.wr}"
            stroke-width="8"
            stroke="${st.wr >= 0.5 ? '#00E87A' : '#EF4444'}"/>
        </svg>
        <div class="wr-center">
          <div class="wr-num">${wrPct}%</div>
          <div class="wr-lbl">Win Rate</div>
        </div>
      </div>
    </div>

    <div class="kpi-grid-3">
      <div class="kpi-box"><div class="kpi-box-val mono">${st.totalTrades}</div><div class="kpi-box-lbl">Operaciones</div></div>
      <div class="kpi-box"><div class="kpi-box-val mono" style="color:var(--green)">${st.wins.length}</div><div class="kpi-box-lbl">Wins</div></div>
      <div class="kpi-box"><div class="kpi-box-val mono" style="color:var(--red)">${st.losses.length}</div><div class="kpi-box-lbl">Losses</div></div>
    </div>

    <div class="card card-p" style="margin-bottom:12px">
      <div class="label" style="margin-bottom:10px">Métricas ICT Profesionales</div>
      <div class="kpi-grid-2">
        ${kpiBox(st.profitFactor.toFixed(2), 'Profit Factor',
            st.profitFactor >= 1.5 ? 'var(--green)' : st.profitFactor >= 1 ? 'var(--amber)' : 'var(--red)')}
        ${kpiBox(`-$${st.maxDD.toFixed(0)}`, 'Drawdown Máx', 'var(--red)')}
        ${kpiBox(Fmt.rrLabel(st.rrAvg), 'RR Promedio',
            st.rrAvg >= 1.5 ? 'var(--green)' : 'var(--amber)')}
        ${kpiBox(
            (st.expectancy >= 0 ? '+' : '') + '$' + Math.abs(st.expectancy).toFixed(1),
            'Expectativa',
            st.expectancy >= 0 ? 'var(--green)' : 'var(--red)')}
        ${kpiBox(st.avgWin.toFixed(0), 'Avg Win ($)', 'var(--green)')}
        ${kpiBox(st.avgLoss.toFixed(0), 'Avg Loss ($)', 'var(--red)')}
        ${kpiBox(
            (st.pnl >= 0 ? '+' : '') + '$' + Math.abs(st.pnl).toFixed(0),
            'P&L Neto',
            st.pnl >= 0 ? 'var(--green)' : 'var(--red)')}
        ${kpiBox(
            st.riesgoAvg > 0 ? st.riesgoAvg.toFixed(1) + '%' : '—',
            'Riesgo % Prom', 'var(--amber)')}
      </div>

      ${renderConsistencyBar(st)}
      ${st.tasaCumplimiento !== null ? renderPlanBar(st.tasaCumplimiento) : ''}
      ${renderErrorBadges(st)}

      ${st.currentStreak >= 2 ? `
        <div class="streak-badge" style="margin-top:12px;padding:8px 12px;border-radius:10px;
          background:${st.streakType === 'Win' ? 'rgba(0,232,122,.1)' : 'rgba(239,68,68,.1)'};
          border:1px solid ${st.streakType === 'Win' ? 'rgba(0,232,122,.3)' : 'rgba(239,68,68,.3)'};
          font-size:12px;font-weight:700;
          color:${st.streakType === 'Win' ? 'var(--green)' : 'var(--red)'}">
          ${st.streakType === 'Win' ? '🔥' : '⚠️'}
          Racha actual: ${st.currentStreak} ${st.streakType === 'Win' ? 'wins seguidos' : 'pérdidas seguidas'}
        </div>` : ''}

      ${st.bestTrade ? `
        <div style="margin-top:12px;display:flex;gap:8px">
          <div style="flex:1;background:rgba(0,232,122,.06);border:1px solid rgba(0,232,122,.2);border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:14px;font-weight:800;color:var(--green)">+$${(parseFloat(st.bestTrade.pnl)||0).toFixed(0)}</div>
            <div style="font-size:10px;color:var(--t3);margin-top:2px">Mejor operación</div>
          </div>
          <div style="flex:1;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:14px;font-weight:800;color:var(--red)">$${Math.abs(parseFloat(st.worstTrade?.pnl)||0).toFixed(0)}</div>
            <div style="font-size:10px;color:var(--t3);margin-top:2px">Peor operación</div>
          </div>
        </div>` : ''}
    </div>

    ${curve.length > 1 ? renderEquityCurveCard(curve, st.pnl) : ''}
    ${setups.length   ? renderSetupCard(setups)   : ''}
    ${sessions.length ? renderSessionCard(sessions) : ''}
    ${days.length     ? renderDayOfWeekCard(days)  : ''}`;

  if (curve.length > 1) renderEquityChart(curve, st.pnl);
}

function kpiBox(value, label, color = 'var(--t2)') {
  return `<div class="kpi-box">
    <div class="kpi-box-val mono" style="color:${color}">${value}</div>
    <div class="kpi-box-lbl">${label}</div>
  </div>`;
}

function renderConsistencyBar(st) {
  const c = st.consistency;
  const color = c >= 70 ? 'var(--green)' : c >= 40 ? 'var(--amber)' : 'var(--red)';
  return `<div style="margin-top:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:11px;color:var(--t2)">Consistency Score</span>
      <span style="font-size:12px;font-weight:700;color:${color}">${c.toFixed(0)}/100</span>
    </div>
    <div class="prog-track" style="height:5px">
      <div class="prog-fill" style="width:${c}%;height:5px;background:${color}"></div>
    </div>
  </div>`;
}

function renderPlanBar(rate) {
  const color = rate >= 0.8 ? 'var(--green)' : rate >= 0.5 ? 'var(--amber)' : 'var(--red)';
  return `<div style="margin-top:10px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:11px;color:var(--t2)">Cumplimiento del plan</span>
      <span style="font-size:12px;font-weight:700;color:${color}">${Math.round(rate*100)}%</span>
    </div>
    <div class="prog-track" style="height:5px">
      <div class="prog-fill" style="width:${rate*100}%;height:5px;background:${color}"></div>
    </div>
  </div>`;
}

function renderErrorBadges(st) {
  if (!st.errEmocional && !st.errTecnico) return '';
  return `<div style="margin-top:12px;display:flex;gap:8px">
    ${st.errEmocional ? `<div style="flex:1;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:var(--amber)">${st.errEmocional}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:2px">Errores emocionales</div>
    </div>` : ''}
    ${st.errTecnico ? `<div style="flex:1;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px;text-align:center">
      <div style="font-size:18px;font-weight:800;color:var(--red)">${st.errTecnico}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:2px">Errores técnicos</div>
    </div>` : ''}
  </div>`;
}

function renderEquityCurveCard(curve, pnl) {
  return `<div class="card card-p" style="margin-bottom:12px">
    <div class="label" style="margin-bottom:8px">Equity Curve</div>
    <div class="equity-wrap"><canvas id="chart-equity"></canvas></div>
  </div>`;
}

function renderEquityChart(curve, pnl) {
  setTimeout(() => {
    if (typeof charts !== 'undefined') {
      if (charts['chart-equity']) { charts['chart-equity'].destroy(); delete charts['chart-equity']; }
    }
    const ctx = document.getElementById('chart-equity')?.getContext('2d');
    if (!ctx) return;
    charts['chart-equity'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: curve.map(p => p.label),
        datasets: [{ data: curve.map(p => p.value),
          borderColor: pnl >= 0 ? '#00E87A' : '#EF4444',
          backgroundColor: pnl >= 0 ? 'rgba(0,232,122,.08)' : 'rgba(239,68,68,.08)',
          fill: true, tension: 0.4, pointRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748B', font: { size: 9 } }, grid: { color: '#1A1A2E' } },
          y: { ticks: { color: '#64748B', font: { size: 9 }, callback: v => '$' + v }, grid: { color: '#1A1A2E' } },
        },
      },
    });
  }, 50);
}

function renderSetupCard(setups) {
  return `<div class="card card-p" style="margin-bottom:12px">
    <div class="label" style="margin-bottom:10px">Rendimiento por Setup</div>
    ${setups.map(s => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:12px;font-weight:600;color:var(--off)">${Fmt.escHtml(s.name)}</span>
        <span style="font-size:11px;color:var(--t3)">${s.total} ops · ${Math.round(s.wr*100)}% WR · $${s.pnl.toFixed(0)}</span>
      </div>
      <div class="prog-track" style="height:4px">
        <div class="prog-fill" style="width:${s.wr*100}%;height:4px;background:var(--green)"></div>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderSessionCard(sessions) {
  const best = sessions[0];
  return `<div class="card card-p" style="margin-bottom:12px">
    <div class="label" style="margin-bottom:8px">Análisis por Sesión</div>
    ${sessions.map(s => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;font-weight:600;color:var(--off)">${Fmt.escHtml(s.name)}</span>
      <div style="display:flex;gap:10px;font-size:11px;color:var(--t3)">
        <span>${s.total} ops</span>
        <span style="color:${s.wr >= 0.5 ? 'var(--green)' : 'var(--red)'}">${Math.round(s.wr*100)}% WR</span>
        <span style="color:${s.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(0)}</span>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderDayOfWeekCard(days) {
  return `<div class="card card-p">
    <div class="label" style="margin-bottom:8px">Mejor día de la semana</div>
    ${days.map((d, i) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-size:12px;font-weight:700;color:var(--off);min-width:30px">${Fmt.escHtml(d.name)}</span>
      <div style="flex:1">
        <div class="prog-track" style="height:6px">
          <div class="prog-fill" style="width:${d.wr*100}%;height:6px;background:${i === 0 ? 'var(--green)' : 'var(--s4)'}"></div>
        </div>
      </div>
      <span style="font-size:11px;color:var(--t3);min-width:50px;text-align:right">${Math.round(d.wr*100)}% · $${d.pnl.toFixed(0)}</span>
    </div>`).join('')}
  </div>`;
}

// ═══════════════════════════════════════
// JOURNAL
// ═══════════════════════════════════════
function renderJournal() {
  const uid    = State.get('user')?.id;
  const trades = (State.get('trades') || []).filter(t => t.userId === uid);
  const container = document.getElementById('trade-journal');
  if (!container) return;

  if (!trades.length) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📊</span>
      <div class="empty-text">Sin operaciones aún.<br>Tocá + para registrar la primera.</div>
    </div>`;
    return;
  }

  container.innerHTML = [...trades].reverse().map(t => {
    const cls  = t.result === 'Win' ? 'win' : t.result === 'Loss' ? 'loss' : 'be';
    const fc   = t.result === 'Win' ? 'var(--green)' : t.result === 'Loss' ? 'var(--red)' : 'var(--amber)';
    const pnlV = parseFloat(t.pnl) || 0;
    const tags = [];
    if (t.rr)            tags.push(`RR ${parseFloat(t.rr).toFixed(1)}:1`);
    if (t.riesgo)        tags.push(`Riesgo ${parseFloat(t.riesgo).toFixed(1)}%`);
    if (t.errorEmocional) tags.push('⚠ Emocional');
    if (t.errorTecnico)   tags.push('⚠ Técnico');
    if (typeof t.cumplioPlan === 'boolean') tags.push(t.cumplioPlan ? '✓ Plan' : '✕ Plan');
    const preDone  = t.preChecklist  ? Object.values(t.preChecklist).filter(Boolean).length  : 0;
    const postDone = t.postChecklist ? Object.values(t.postChecklist).filter(Boolean).length : 0;

    return `<div class="trade-row ${cls}">
      <div class="trade-dot"></div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
          <span class="trade-result">${t.result}</span>
          <span class="trade-pnl" style="color:${fc}">${pnlV >= 0 ? '+' : ''}$${Math.abs(pnlV).toFixed(2)}</span>
        </div>
        <div style="font-size:11px;color:var(--t3);margin-bottom:3px">
          ${Fmt.escHtml(t.date || '')}${t.setup ? ' · ' + Fmt.escHtml(t.setup) : ''}${t.hour ? ' · ' + Fmt.escHtml(t.hour) : ''}
        </div>
        ${t.notes ? `<div class="trade-notes">${Fmt.escHtml(t.notes)}</div>` : ''}
        ${tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
          ${tags.map(tag => `<span style="font-size:9px;padding:2px 6px;border-radius:100px;background:var(--s3);color:var(--t3)">${Fmt.escHtml(tag)}</span>`).join('')}
        </div>` : ''}
        ${(preDone > 0 || postDone > 0) ? `<div style="margin-top:4px;display:flex;gap:8px">
          <span style="font-size:9px;color:var(--t3)">Pre: ${preDone}/${PRE_CHECKLIST.length}</span>
          <span style="font-size:9px;color:var(--t3)">Post: ${postDone}/${POST_CHECKLIST.length}</span>
        </div>` : ''}
        ${t.consecuencia ? `<div style="margin-top:4px;font-size:11px;color:var(--purple);font-style:italic">→ ${Fmt.escHtml(t.consecuencia)}</div>` : ''}
        <button onclick="deleteTrade('${t.id}')" style="margin-top:6px;font-size:10px;color:var(--red);background:none;border:none;cursor:pointer;padding:0">Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════
// FONDEO — Dashboard compatible con firmas
// ═══════════════════════════════════════
function renderFondeo() {
  const st   = calcTradeStats();
  const conf = FUNDED_DEFAULTS[currentFirma] || FUNDED_DEFAULTS.FundedNext;
  const prog = calcFundedProgress({
    capitalInicial,
    objetivo:    capitalInicial * (1 + conf.objetivo),
    maxDrawdown: capitalInicial * conf.maxDD,
    currentPnl:  st.pnl,
  });

  const container = document.getElementById('trade-fondeo');
  if (!container) return;

  container.innerHTML = `
    <div class="card card-p" style="margin-bottom:12px">
      <div class="label" style="margin-bottom:12px">Simulador de Fondeo</div>
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        ${Object.keys(FUNDED_DEFAULTS).map(k =>
          `<button onclick="setFirma('${k}')" class="btn btn-sm ${currentFirma === k ? 'btn-green' : 'btn-ghost'}">${k}</button>`
        ).join('')}
      </div>
      <div style="display:flex;gap:10px;margin-bottom:14px">
        <div class="field" style="flex:1;margin:0">
          <label>Capital inicial ($)</label>
          <input type="number" id="funded-capital" value="${capitalInicial}"
            onchange="updateFundedCapital(this.value)"
            style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--off);font-size:13px;font-family:var(--font)">
        </div>
      </div>

      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:11px;color:var(--t3);margin-bottom:4px">Progreso hacia objetivo</div>
        <div style="font-size:32px;font-weight:800;color:${prog.pnl >= 0 ? 'var(--green)' : 'var(--red)'}" class="mono">
          ${prog.pnl >= 0 ? '+' : ''}${Fmt.currencyFull(st.pnl)}
        </div>
        <div style="font-size:12px;color:var(--t3)">${conf.nombre} · ${Math.round(conf.objetivo*100)}% objetivo · ${Math.round(conf.maxDD*100)}% max DD</div>
      </div>

      <div class="kpi-grid-2" style="margin-bottom:12px">
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:var(--t2)">${Fmt.currencyFull(prog.capitalInicial)}</div>
          <div class="kpi-box-lbl">Capital Inicial</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${prog.capitalActual >= prog.capitalInicial ? 'var(--green)' : 'var(--red)'}">
            ${Fmt.currencyFull(prog.capitalActual)}
          </div>
          <div class="kpi-box-lbl">Capital Actual</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:var(--blue)">${Fmt.currencyFull(prog.objetivo)}</div>
          <div class="kpi-box-lbl">Objetivo</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${prog.distanciaObjetivo <= 0 ? 'var(--green)' : 'var(--amber)'}">
            ${prog.distanciaObjetivo <= 0 ? '✓ Alcanzado' : Fmt.currencyFull(prog.distanciaObjetivo)}
          </div>
          <div class="kpi-box-lbl">Distancia al Obj.</div>
        </div>
      </div>

      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:11px;color:var(--t2)">Progreso hacia objetivo</span>
          <span style="font-size:12px;font-weight:700;color:var(--green)">${Math.round(prog.pctObjetivo*100)}%</span>
        </div>
        <div class="prog-track" style="height:8px">
          <div class="prog-fill" style="width:${prog.pctObjetivo*100}%;height:8px;background:var(--green)"></div>
        </div>
      </div>

      <div style="margin-bottom:0">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:11px;color:var(--t2)">Drawdown usado</span>
          <span style="font-size:12px;font-weight:700;color:${prog.enRiesgo ? 'var(--red)' : 'var(--amber)'}">
            ${Math.round(prog.pctDrawdown*100)}%
            ${prog.enRiesgo ? ' ⚠️ PELIGRO' : ''}
          </span>
        </div>
        <div class="prog-track" style="height:8px">
          <div class="prog-fill" style="width:${prog.pctDrawdown*100}%;height:8px;background:${prog.enRiesgo ? 'var(--red)' : 'var(--amber)'}"></div>
        </div>
        <div style="font-size:11px;color:var(--t3);margin-top:4px">
          Drawdown restante: ${Fmt.currencyFull(prog.drawdownRestante)}
        </div>
      </div>
    </div>`;
}

// Funciones globales llamadas desde inline HTML
window.setFirma = function(firma) {
  currentFirma = firma;
  renderFondeo();
};
window.updateFundedCapital = function(val) {
  capitalInicial = parseFloat(val) || 10000;
  renderFondeo();
};

// ═══════════════════════════════════════
// CHECKLIST
// ═══════════════════════════════════════
function renderChecklist() {
  const container = document.getElementById('trade-checklist');
  if (!container) return;

  const checkRow = (item, isPost) => {
    const prefix = isPost ? 'post' : 'pre';
    const check  = isPost ? tempPostCheck : tempPreCheck;
    const color  = isPost ? 'var(--blue)' : 'var(--green)';
    const done   = !!check[item.id];
    const row    = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)';

    const box = document.createElement('div');
    box.id    = `${prefix}-${item.id}`;
    box.style.cssText = `width:20px;height:20px;border-radius:6px;border:2px solid ${done ? color : 'var(--s4)'};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${done ? color : 'transparent'}`;
    if (done) {
      const check_ = document.createElement('span');
      check_.style.cssText = 'color:#000;font-size:12px;font-weight:800';
      check_.textContent = '✓';
      box.appendChild(check_);
    }
    box.addEventListener('click', () => toggleCheck(item.id, isPost, color));

    const label = document.createElement('span');
    label.style.cssText = 'font-size:12px;color:var(--off)';
    label.textContent = item.label;

    row.appendChild(box);
    row.appendChild(label);
    return row;
  };

  const makeCard = (title, items, isPost, color) => {
    const card = document.createElement('div');
    card.className = 'card card-p';
    card.style.marginBottom = '12px';

    const titleEl = document.createElement('div');
    titleEl.className = 'label';
    titleEl.style.cssText = `margin-bottom:10px;color:${color}`;
    titleEl.textContent = title;
    card.appendChild(titleEl);

    items.forEach(item => card.appendChild(checkRow(item, isPost)));

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:var(--t3);margin-top:10px';
    hint.textContent = isPost ? 'Completá al cerrar cada operación' : 'Completá antes de entrar a operar';
    card.appendChild(hint);
    return card;
  };

  DOM.clear(container);
  container.appendChild(makeCard('✔ Pre-Operación',  PRE_CHECKLIST,  false, 'var(--green)'));
  container.appendChild(makeCard('✔ Post-Operación', POST_CHECKLIST, true,  'var(--blue)'));
}

function toggleCheck(id, isPost, color) {
  const map    = isPost ? tempPostCheck : tempPreCheck;
  const prefix = isPost ? 'post' : 'pre';
  map[id] = !map[id];
  const el = document.getElementById(`${prefix}-${id}`);
  if (!el) return;
  el.style.background    = map[id] ? color : 'transparent';
  el.style.borderColor   = map[id] ? color : 'var(--s4)';
  el.innerHTML = map[id] ? '<span style="color:#000;font-size:12px;font-weight:800">✓</span>' : '';
}

// ═══════════════════════════════════════
// CALENDARIO DE OPERACIONES
// ═══════════════════════════════════════
function renderCalendario() {
  const cal = calcTradeCalendar();
  const today = new Date();
  const container = document.getElementById('trade-calendario');
  if (!container) return;

  // Últimos 3 meses
  const months = [];
  for (let i = 2; i >= 0; i--) {
    const d    = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const monthName = d.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    months.push({ d, days, monthName });
  }

  let html = '';
  months.forEach(({ d, days, monthName }) => {
    const firstDay = (d.getDay() + 6) % 7; // Lunes=0
    html += `<div class="card card-p" style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--off);margin-bottom:10px;text-transform:capitalize">${monthName}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px">
        ${['L','M','X','J','V','S','D'].map(d => `<div style="font-size:8px;text-align:center;color:var(--t3)">${d}</div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">
        ${Array(firstDay).fill('<div></div>').join('')}
        ${Array.from({length: days}, (_, i) => {
          const day  = i + 1;
          const iso  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const data = cal[iso];
          const isToday = iso === Dates.todayISO();
          let bg    = 'var(--s3)';
          let title = '';
          if (data) {
            bg    = data.pnl > 0 ? 'rgba(0,232,122,.7)' : data.pnl < 0 ? 'rgba(239,68,68,.7)' : 'rgba(245,158,11,.5)';
            title = `${data.count} op(s): ${data.wins}W ${data.losses}L · P&L $${data.pnl.toFixed(0)}`;
          }
          return `<div style="aspect-ratio:1;border-radius:5px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:${data ? '#000' : 'var(--t3)'};${isToday ? 'outline:2px solid var(--green);outline-offset:1px' : ''};cursor:${data ? 'pointer' : 'default'}" title="${title}">${day}</div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:8px">
        <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:rgba(0,232,122,.7)"></div><span style="font-size:10px;color:var(--t3)">Ganador</span></div>
        <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:rgba(239,68,68,.7)"></div><span style="font-size:10px;color:var(--t3)">Perdedor</span></div>
        <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:rgba(245,158,11,.5)"></div><span style="font-size:10px;color:var(--t3)">Break Even</span></div>
        <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:var(--s3)"></div><span style="font-size:10px;color:var(--t3)">Sin operar</span></div>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

// ═══════════════════════════════════════
// ERRORES
// ═══════════════════════════════════════
function renderErrores() {
  const uid  = State.get('user')?.id;
  const errs = (State.get('tradeErrors') || {})[uid] || {};
  const errTypes = [
    { id: 'fomo',   name: 'FOMO',             icon: '😰' },
    { id: 'over',   name: 'Overtrading',       icon: '🔄' },
    { id: 'impuls', name: 'Entrada impulsiva', icon: '⚡' },
    { id: 'early',  name: 'Salida anticipada', icon: '🏃' },
    { id: 'plan',   name: 'Ignorar el plan',   icon: '📋' },
    { id: 'size',   name: 'Tamaño excesivo',   icon: '📦' },
  ];

  const container = document.getElementById('trade-errores');
  if (!container) return;

  container.innerHTML = `
    <div class="error-grid">
      ${errTypes.map(e => {
        const cnt = errs[e.id] || 0;
        return `<div class="error-btn ${cnt > 0 ? 'active' : ''}" onclick="addTradeError('${e.id}')">
          <div style="font-size:22px;margin-bottom:4px">${e.icon}</div>
          <div class="error-name">${e.name}</div>
          <div class="error-count">${cnt}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:14px;font-size:11px;color:var(--t3);text-align:center">Tocá para registrar un error</div>`;
}

// ═══════════════════════════════════════
// AGREGAR TRADE — con validación y límite diario
// ═══════════════════════════════════════
export async function addTrade() {
  const result      = DOM.val('nt-result');
  const pnl         = DOM.val('nt-pnl');
  const rr          = DOM.val('nt-rr');
  const riesgo      = DOM.val('nt-riesgo');
  const setup       = DOM.val('nt-setup');
  const hour        = DOM.val('nt-hour');
  const notes       = DOM.val('nt-notes');
  const date        = DOM.val('nt-date') || Dates.todayISO();
  const errorEmocional = DOM.checkVal('nt-error-emocional');
  const errorTecnico   = DOM.checkVal('nt-error-tecnico');
  const cumplioPlanRaw = DOM.val('nt-cumplio-plan');
  const consecuencia   = DOM.val('nt-consecuencia');

  // Validar
  const errors = Validators.trade({ pnl, rr, riesgo, result, date });
  if (Validators.hasErrors(errors)) {
    const form = document.getElementById('modal-new-trade');
    if (form) Validators.displayErrors(form, errors);
    DOM.toast(Object.values(errors)[0], 'error');
    return;
  }

  // Límite diario
  const { allowed, count } = canAddTradeToday(date);
  if (!allowed) {
    DOM.toast(`Límite de 2 operaciones diarias alcanzado (${count}/2)`, 'error');
    return;
  }

  const trade = {
    id: genId(), userId: State.get('user')?.id,
    result, pnl: parseFloat(pnl) || 0,
    rr:     rr     ? parseFloat(rr)     : null,
    riesgo: riesgo ? parseFloat(riesgo) : null,
    setup, hour, notes, date,
    errorEmocional, errorTecnico,
    cumplioPlan: cumplioPlanRaw === '' ? null : cumplioPlanRaw === 'si',
    consecuencia,
    preChecklist:  { ...tempPreCheck  },
    postChecklist: { ...tempPostCheck },
  };

  await DB.addTrade(trade);
  DOM.closeModal('modal-new-trade');
  DOM.clearVal('nt-pnl', 'nt-rr', 'nt-riesgo', 'nt-notes', 'nt-consecuencia');
  document.getElementById('nt-error-emocional').checked = false;
  document.getElementById('nt-error-tecnico').checked   = false;
  DOM.setVal('nt-cumplio-plan', '');
  tempPreCheck = {}; tempPostCheck = {};

  renderTrading();
  DOM.toast('Operación registrada ✓');
}

export async function deleteTrade(tid) {
  if (!confirm('¿Eliminar esta operación?')) return;
  await DB.deleteTrade(tid);
  renderTrading();
  DOM.toast('Operación eliminada');
}

export async function addTradeError(type) {
  await DB.addTradeError(type);
  renderTrading();
  DOM.toast('Error registrado');
}

// Exponer al scope global para inline handlers
window.addTrade      = addTrade;
window.deleteTrade   = deleteTrade;
window.addTradeError = addTradeError;
window.switchTradeTab = (tab) => switchTab(tab);
