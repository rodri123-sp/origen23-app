// ═══════════════════════════════════════
// FINANCE/INDEX.JS — Módulo financiero nivel banco digital
// ═══════════════════════════════════════
import State from '../../services/state.js';
import { DB, genId } from '../../services/db.js';
import { Dates } from '../../utils/dates.js';
import { Fmt } from '../../utils/formatters.js';
import { Validators } from '../../utils/validators.js';
import { DOM } from '../../components/dom.js';
import {
  calcMonthKPIs, calcPatrimonio, calcEmergencia,
  calcProjection, calcFinHeatmap, calcMonthlyHistory,
  calcAlerts, catGastoMes, movsThisMonth, movsByPeriod,
  sumByTipo, getFinData, getIngreso, calcInversionesStats,
} from '../../services/finance-calc.js';

let activeTab   = 'resumen';
let activePeriod = 'mes';

// ═══════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════
export function renderFinanzas() {
  switchTab(activeTab, false);
}

export function switchTab(tab, rerender = true) {
  activeTab = tab;
  const tabs = ['resumen', 'movimientos', 'presupuesto', 'patrimonio', 'proyeccion', 'metas'];
  tabs.forEach(t => DOM.toggle('fin-' + t, t === tab));

  document.querySelectorAll('#page-finanzas .tab-switch-btn').forEach((b, i) => {
    b.classList.toggle('active', tabs[i] === tab);
  });

  if (rerender) {
    const renders = {
      resumen:      renderResumen,
      movimientos:  renderMovimientos,
      presupuesto:  renderPresupuesto,
      patrimonio:   renderPatrimonio,
      proyeccion:   renderProyeccion,
      metas:        renderFinMetas,
    };
    (renders[tab] || renderResumen)();
  }
}

// ═══════════════════════════════════════
// RESUMEN — Dashboard financiero completo
// ═══════════════════════════════════════
function renderResumen() {
  const kpis  = calcMonthKPIs();
  const patr  = calcPatrimonio();
  const hist  = calcMonthlyHistory(6);
  const alerts = calcAlerts();
  const heatmap = calcFinHeatmap(30);
  const container = document.getElementById('fin-resumen');
  if (!container) return;

  const ingTrend = kpis.ingTrend >= 0
    ? `<span style="color:var(--green)">↑ ${Math.abs(kpis.ingTrend).toFixed(0)}%</span>`
    : `<span style="color:var(--red)">↓ ${Math.abs(kpis.ingTrend).toFixed(0)}%</span>`;
  const gasTrend = kpis.gasTrend <= 0
    ? `<span style="color:var(--green)">↓ ${Math.abs(kpis.gasTrend).toFixed(0)}%</span>`
    : `<span style="color:var(--red)">↑ ${Math.abs(kpis.gasTrend).toFixed(0)}%</span>`;

  container.innerHTML = `
    <!-- KPIs principales -->
    <div class="fin-kpi-row">
      <div class="fin-kpi ${kpis.ing > 0 ? 'fin-kpi-green' : ''}">
        <div class="fin-kpi-top">
          <span class="fin-kpi-icon">💵</span>${ingTrend}
        </div>
        <div class="fin-kpi-val mono">${Fmt.currency(kpis.ing)}</div>
        <div class="fin-kpi-lbl">Ingresos</div>
      </div>
      <div class="fin-kpi ${kpis.gas > kpis.ing ? 'fin-kpi-red' : ''}">
        <div class="fin-kpi-top">
          <span class="fin-kpi-icon">💸</span>${gasTrend}
        </div>
        <div class="fin-kpi-val mono" style="color:${kpis.gas > kpis.ing ? 'var(--red)' : 'var(--off)'}">
          ${Fmt.currency(kpis.gas)}
        </div>
        <div class="fin-kpi-lbl">Gastos</div>
      </div>
      <div class="fin-kpi ${kpis.ahorro > 0 ? 'fin-kpi-blue' : 'fin-kpi-red'}">
        <div class="fin-kpi-top">
          <span class="fin-kpi-icon">${kpis.ahorro >= 0 ? '📈' : '📉'}</span>
        </div>
        <div class="fin-kpi-val mono" style="color:${kpis.ahorro >= 0 ? 'var(--blue)' : 'var(--red)'}">
          ${kpis.ahorro >= 0 ? '' : '-'}${Fmt.currency(Math.abs(kpis.ahorro))}
        </div>
        <div class="fin-kpi-lbl">Ahorro del mes</div>
      </div>
    </div>

    <!-- Ratios financieros profesionales -->
    <div class="card card-p" style="margin-bottom:12px">
      <div class="label" style="margin-bottom:10px">Indicadores financieros</div>
      <div class="kpi-grid-2">
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${patr.ratioAhorro >= 0.2 ? 'var(--green)' : patr.ratioAhorro >= 0.1 ? 'var(--amber)' : 'var(--red)'}">
            ${Math.round(patr.ratioAhorro * 100)}%
          </div>
          <div class="kpi-box-lbl">Tasa de ahorro</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${patr.ratioEndeudamiento < 0.3 ? 'var(--green)' : patr.ratioEndeudamiento < 0.5 ? 'var(--amber)' : 'var(--red)'}">
            ${Math.round(patr.ratioEndeudamiento * 100)}%
          </div>
          <div class="kpi-box-lbl">Endeudamiento</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:var(--blue)">${Fmt.currency(patr.liquidez)}</div>
          <div class="kpi-box-lbl">Liquidez</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${patr.neto >= 0 ? 'var(--green)' : 'var(--red)'}">
            ${Fmt.currency(patr.neto)}
          </div>
          <div class="kpi-box-lbl">Patrimonio neto</div>
        </div>
      </div>
    </div>

    <!-- Ingreso mensual (editable) -->
    <div class="card card-p" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="label">Ingreso mensual</div>
          <div style="font-size:24px;font-weight:800;color:var(--green);font-family:var(--mono)" id="ing-display">
            ${Fmt.currencyFull(getIngreso())}
          </div>
        </div>
        <button onclick="openSetIngreso()" class="btn btn-ghost btn-sm">Editar</button>
      </div>
    </div>

    <!-- Alertas -->
    ${alerts.length ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
      ${alerts.map(a => `
        <div style="padding:8px 12px;border-radius:10px;font-size:11px;font-weight:600;
          background:${a.type === 'red' ? 'rgba(239,68,68,.1)' : a.type === 'amber' ? 'rgba(245,158,11,.1)' : 'rgba(0,232,122,.1)'};
          border:1px solid ${a.type === 'red' ? 'rgba(239,68,68,.3)' : a.type === 'amber' ? 'rgba(245,158,11,.3)' : 'rgba(0,232,122,.3)'};
          color:${a.type === 'red' ? 'var(--red)' : a.type === 'amber' ? 'var(--amber)' : 'var(--green)'}">
          ${a.type === 'red' ? '⚠️' : a.type === 'amber' ? '🔔' : '✅'} ${Fmt.escHtml(a.msg)}
        </div>`).join('')}
    </div>` : ''}

    <!-- Heatmap financiero últimos 30 días -->
    <div class="card card-p" style="margin-bottom:12px">
      <div class="label" style="margin-bottom:10px">Actividad financiera — últimos 30 días</div>
      ${renderFinHeatmapHTML(heatmap)}
    </div>

    <!-- Histórico mensual -->
    <div class="card card-p">
      <div class="label" style="margin-bottom:10px">Historial mensual</div>
      <div class="chart-wrap"><canvas id="chart-fin-hist"></canvas></div>
      <div style="margin-top:12px">
        ${hist.map(m => `
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:11px;font-weight:600;color:var(--off);text-transform:capitalize">${Fmt.escHtml(m.label)}</span>
              <span style="font-size:11px;color:${m.ahorro >= 0 ? 'var(--green)' : 'var(--red)'}">
                Ahorro: ${m.ahorro >= 0 ? '' : '-'}${Fmt.currency(Math.abs(m.ahorro))}
              </span>
            </div>
            <div style="display:flex;gap:4px;height:4px;border-radius:2px;overflow:hidden">
              <div style="flex:${m.ing};background:rgba(0,232,122,.5)"></div>
              <div style="flex:${m.gas};background:rgba(239,68,68,.5)"></div>
            </div>
          </div>`).join('')}
        <div style="display:flex;gap:12px;margin-top:8px">
          <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:rgba(0,232,122,.5)"></div><span style="font-size:10px;color:var(--t3)">Ingresos</span></div>
          <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:rgba(239,68,68,.5)"></div><span style="font-size:10px;color:var(--t3)">Gastos</span></div>
        </div>
      </div>
    </div>`;

  renderFinHistChart(hist);
}

function renderFinHeatmapHTML(heatmap) {
  const INTENSITY_COLORS = [
    'var(--s3)',               // 0 — sin actividad
    'rgba(0,232,122,.2)',      // leve verde
    'rgba(0,232,122,.5)',      // verde medio
    'rgba(0,232,122,.85)',     // verde fuerte
    'rgba(245,158,11,.4)',     // amarillo
    'rgba(239,68,68,.4)',      // rojo medio
    'rgba(239,68,68,.8)',      // rojo fuerte
  ];

  const cells = heatmap.map(d => {
    let colorIdx = 0;
    if (d.count > 0) {
      if (d.balance > 0)      colorIdx = d.intensity > 0.6 ? 3 : d.intensity > 0.3 ? 2 : 1;
      else if (d.balance < 0) colorIdx = d.intensity > 0.6 ? 6 : 5;
      else                    colorIdx = 4;
    }
    const tip = d.count > 0
      ? `${d.date}: $${d.ingresos.toFixed(0)} in / $${d.gastos.toFixed(0)} gas`
      : d.date;

    return `<div style="width:calc(100%/30);aspect-ratio:1;border-radius:3px;background:${INTENSITY_COLORS[colorIdx]};cursor:${d.count > 0 ? 'pointer' : 'default'}" title="${tip}"></div>`;
  }).join('');

  return `<div style="display:flex;flex-wrap:wrap;gap:2px">${cells}</div>
    <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:rgba(0,232,122,.7)"></div><span style="font-size:10px;color:var(--t3)">Superávit</span></div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:rgba(239,68,68,.6)"></div><span style="font-size:10px;color:var(--t3)">Déficit</span></div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:var(--s3)"></div><span style="font-size:10px;color:var(--t3)">Sin actividad</span></div>
    </div>`;
}

function renderFinHistChart(hist) {
  setTimeout(() => {
    if (typeof charts !== 'undefined' && charts['chart-fin-hist']) {
      charts['chart-fin-hist'].destroy();
      delete charts['chart-fin-hist'];
    }
    const ctx = document.getElementById('chart-fin-hist')?.getContext('2d');
    if (!ctx) return;
    charts['chart-fin-hist'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: hist.map(m => m.label),
        datasets: [
          { label: 'Ingresos', data: hist.map(m => m.ing), backgroundColor: 'rgba(0,232,122,.6)', borderRadius: 4 },
          { label: 'Gastos',   data: hist.map(m => m.gas), backgroundColor: 'rgba(239,68,68,.5)', borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94A3B8', font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: '#64748B' }, grid: { color: '#1A1A2E' } },
          y: { ticks: { color: '#64748B', callback: v => '$' + v }, grid: { color: '#1A1A2E' } },
        },
      },
    });
  }, 50);
}

// ═══════════════════════════════════════
// MOVIMIENTOS
// ═══════════════════════════════════════
function renderMovimientos() {
  const movs = movsByPeriod(activePeriod);
  const cats = State.get('finCats') || [];
  const container = document.getElementById('fin-movimientos');
  if (!container) return;

  const ing = sumByTipo(movs, 'ingreso');
  const gas = sumByTipo(movs, 'gasto');
  const inv = sumByTipo(movs, 'inversion');

  const getCat = id => cats.find(c => c.id === id);

  container.innerHTML = `
    <!-- Período selector -->
    <div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">
      ${['hoy','semana','mes','año'].map(p =>
        `<button onclick="setFinPeriod('${p}')" class="btn btn-sm ${activePeriod === p ? 'btn-green' : 'btn-ghost'}"
          style="flex-shrink:0">${p.charAt(0).toUpperCase()+p.slice(1)}</button>`
      ).join('')}
    </div>

    <!-- Totales del período -->
    <div class="kpi-grid-3" style="margin-bottom:12px">
      <div class="kpi-box">
        <div class="kpi-box-val mono" style="color:var(--green)">${Fmt.currency(ing)}</div>
        <div class="kpi-box-lbl">Ingresos</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-box-val mono" style="color:var(--red)">${Fmt.currency(gas)}</div>
        <div class="kpi-box-lbl">Gastos</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-box-val mono" style="color:var(--blue)">${Fmt.currency(inv)}</div>
        <div class="kpi-box-lbl">Inversiones</div>
      </div>
    </div>

    <!-- Lista de movimientos -->
    ${movs.length ? movs.map(m => {
      const cat = m.catId ? getCat(m.catId) : null;
      const isGasto = m.tipo === 'gasto';
      const color = isGasto ? 'var(--red)' : m.tipo === 'ingreso' ? 'var(--green)' : 'var(--blue)';
      const sign  = isGasto ? '-' : '+';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:36px;height:36px;border-radius:10px;background:${cat?.color || 'var(--s4)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
          ${cat?.icon || (m.tipo === 'ingreso' ? '💵' : m.tipo === 'inversion' ? '📈' : '💸')}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--off);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Fmt.escHtml(m.desc)}</div>
          <div style="font-size:10px;color:var(--t3)">${cat?.name || m.tipo} · ${Fmt.shortDate(m.fecha)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:13px;font-weight:800;font-family:var(--mono);color:${color}">${sign}${Fmt.currency(m.monto)}</div>
          <button onclick="deleteMovimiento('${m.id}')" style="font-size:9px;color:var(--red);background:none;border:none;cursor:pointer;padding:0">Eliminar</button>
        </div>
      </div>`;
    }).join('') : `<div class="empty-state">
      <span class="empty-icon">📑</span>
      <div class="empty-text">Sin movimientos en este período</div>
    </div>`}`;
}

// ═══════════════════════════════════════
// PRESUPUESTO — Control por categorías
// ═══════════════════════════════════════
function renderPresupuesto() {
  const cats    = State.get('finCats') || [];
  const kpis    = calcMonthKPIs();
  const container = document.getElementById('fin-presupuesto');
  if (!container) return;

  const totalBudget  = cats.reduce((s, c) => s + (c.budget || 0), 0);
  const totalGastado = cats.reduce((s, c) => s + catGastoMes(c.id), 0);
  const disponible   = Math.max(0, totalBudget - totalGastado);

  container.innerHTML = `
    <!-- Overview presupuesto total -->
    <div class="card card-p" style="margin-bottom:12px">
      <div class="label" style="margin-bottom:10px">Presupuesto mes actual</div>
      <div class="kpi-grid-3" style="margin-bottom:12px">
        <div class="kpi-box">
          <div class="kpi-box-val mono">${Fmt.currency(totalBudget)}</div>
          <div class="kpi-box-lbl">Presupuestado</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:var(--red)">${Fmt.currency(totalGastado)}</div>
          <div class="kpi-box-lbl">Gastado</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${disponible > 0 ? 'var(--green)' : 'var(--red)'}">
            ${Fmt.currency(disponible)}
          </div>
          <div class="kpi-box-lbl">Disponible</div>
        </div>
      </div>
      <div class="prog-track" style="height:8px">
        <div class="prog-fill" style="width:${Math.min(100, totalBudget > 0 ? totalGastado/totalBudget*100 : 0)}%;height:8px;background:${totalGastado > totalBudget ? 'var(--red)' : 'var(--green)'}"></div>
      </div>
      <div style="font-size:10px;color:var(--t3);margin-top:4px;text-align:right">
        ${totalBudget > 0 ? Math.round(totalGastado/totalBudget*100) : 0}% utilizado
      </div>
    </div>

    <!-- Categorías detalle -->
    ${cats.length ? cats.map(f => {
      const gastado   = catGastoMes(f.id);
      const ratio     = f.budget > 0 ? gastado / f.budget : 0;
      const disp      = Math.max(0, (f.budget || 0) - gastado);
      const barColor  = ratio >= 1 ? 'var(--red)' : ratio >= 0.8 ? 'var(--amber)' : 'var(--green)';
      const badge     = ratio >= 1
        ? `<span style="font-size:9px;padding:2px 6px;border-radius:100px;background:rgba(239,68,68,.15);color:var(--red)">Superado</span>`
        : ratio >= 0.8
        ? `<span style="font-size:9px;padding:2px 6px;border-radius:100px;background:rgba(245,158,11,.15);color:var(--amber)">Alerta</span>`
        : '';

      return `<div class="card card-p" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:${f.color || 'var(--s4)'};display:flex;align-items:center;justify-content:center;font-size:18px">${f.icon || '📁'}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:var(--off)">${Fmt.escHtml(f.name)}</div>
            <div style="font-size:10px;color:var(--t3)">Presupuesto: ${Fmt.currencyFull(f.budget || 0)}</div>
          </div>
          ${badge}
        </div>
        <div class="prog-track" style="height:8px;margin-bottom:6px">
          <div class="prog-fill" style="width:${Math.min(100, ratio*100)}%;height:8px;background:${barColor}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3)">
          <span>Gastado: <span style="color:${barColor};font-weight:700">${Fmt.currencyFull(gastado)}</span></span>
          <span>Libre: <span style="color:var(--off);font-weight:600">${Fmt.currencyFull(disp)}</span></span>
        </div>
        <button onclick="editFinCat('${f.id}')" style="margin-top:6px;font-size:10px;color:var(--t3);background:none;border:none;cursor:pointer;padding:0">Editar presupuesto</button>
      </div>`;
    }).join('') : `<div class="empty-state">
      <span class="empty-icon">📂</span>
      <div class="empty-text">Sin categorías aún.<br>Tocá + para agregar.</div>
    </div>`}`;
}

// ═══════════════════════════════════════
// PATRIMONIO — Balance general
// ═══════════════════════════════════════
function renderPatrimonio() {
  const patr = calcPatrimonio();
  const em   = calcEmergencia();
  const inv  = calcInversionesStats();
  const container = document.getElementById('fin-patrimonio');
  if (!container) return;

  const a = patr.activos;
  const p = patr.pasivos;

  container.innerHTML = `
    <!-- Patrimonio neto -->
    <div class="card card-p" style="margin-bottom:12px">
      <div class="label" style="margin-bottom:10px">Patrimonio Neto = Activos − Pasivos</div>
      <div style="text-align:center;padding:8px 0 12px">
        <div style="font-size:11px;color:var(--t3);margin-bottom:2px">Patrimonio Neto</div>
        <div style="font-size:36px;font-weight:800;font-family:var(--mono);color:${patr.neto >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${patr.neto >= 0 ? '' : '-'}${Fmt.currencyFull(Math.abs(patr.neto))}
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div style="flex:1;text-align:center;padding:10px;background:rgba(0,232,122,.06);border-radius:12px;border:1px solid rgba(0,232,122,.15)">
          <div style="font-size:16px;font-weight:800;color:var(--green);font-family:var(--mono)">${Fmt.currency(patr.totalA)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px">Activos totales</div>
        </div>
        <div style="flex:1;text-align:center;padding:10px;background:rgba(239,68,68,.06);border-radius:12px;border:1px solid rgba(239,68,68,.15)">
          <div style="font-size:16px;font-weight:800;color:var(--red);font-family:var(--mono)">${Fmt.currency(patr.totalP)}</div>
          <div style="font-size:10px;color:var(--t3);margin-top:2px">Pasivos totales</div>
        </div>
      </div>
      <div class="kpi-grid-2" style="margin-bottom:12px">
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${patr.ratioEndeudamiento < 0.3 ? 'var(--green)' : 'var(--red)'}">
            ${Math.round(patr.ratioEndeudamiento * 100)}%
          </div>
          <div class="kpi-box-lbl">Ratio endeudamiento</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:var(--blue)">
            ${Math.round(patr.ratioInversion * 100)}%
          </div>
          <div class="kpi-box-lbl">Ratio inversión</div>
        </div>
      </div>
    </div>

    <!-- Activos detalle -->
    <div class="card card-p" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <div class="label">Activos</div>
        <button onclick="openEditPatrimonio('activos')" class="btn btn-ghost btn-sm">Editar</button>
      </div>
      ${renderPatrimonioRow('💵', 'Efectivo',    a.efectivo || 0, 'var(--green)')}
      ${renderPatrimonioRow('🏦', 'Banco',       a.banco    || 0, 'var(--green)')}
      ${renderPatrimonioRow('📱', 'MercadoPago', a.mp       || 0, 'var(--blue)')}
      ${renderPatrimonioRow('📈', 'Inversiones', a.inversiones || 0, 'var(--purple)')}
      ${renderPatrimonioRow('📦', 'Otros',       a.otros    || 0, 'var(--t2)')}
      <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;display:flex;justify-content:space-between">
        <span style="font-size:12px;font-weight:700;color:var(--off)">Total activos</span>
        <span style="font-size:14px;font-weight:800;font-family:var(--mono);color:var(--green)">${Fmt.currencyFull(patr.totalA)}</span>
      </div>
    </div>

    <!-- Pasivos detalle -->
    <div class="card card-p" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <div class="label">Pasivos</div>
        <button onclick="openEditPatrimonio('pasivos')" class="btn btn-ghost btn-sm">Editar</button>
      </div>
      ${renderPatrimonioRow('💳', 'Tarjetas',   p.tarjetas  || 0, 'var(--red)')}
      ${renderPatrimonioRow('🏦', 'Préstamos',  p.prestamos || 0, 'var(--red)')}
      ${renderPatrimonioRow('🤝', 'Deudas',     p.deudas    || 0, 'var(--red)')}
      ${renderPatrimonioRow('📦', 'Otros',      p.otros     || 0, 'var(--t2)')}
      <div style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px;display:flex;justify-content:space-between">
        <span style="font-size:12px;font-weight:700;color:var(--off)">Total pasivos</span>
        <span style="font-size:14px;font-weight:800;font-family:var(--mono);color:var(--red)">${Fmt.currencyFull(patr.totalP)}</span>
      </div>
    </div>

    <!-- Fondo de emergencia -->
    <div class="card card-p" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <div class="label">🛡️ Fondo de emergencia</div>
        <button onclick="openEditEmergencia()" class="btn btn-ghost btn-sm">Editar</button>
      </div>
      <div class="prog-track" style="height:10px;margin-bottom:8px">
        <div class="prog-fill" style="width:${em.ratio*100}%;height:10px;background:${em.ratio >= 1 ? 'var(--green)' : em.ratio >= 0.5 ? 'var(--amber)' : 'var(--red)'}"></div>
      </div>
      <div class="kpi-grid-3">
        <div class="kpi-box"><div class="kpi-box-val mono">${Fmt.currency(em.actual || 0)}</div><div class="kpi-box-lbl">Acumulado</div></div>
        <div class="kpi-box"><div class="kpi-box-val mono">${Fmt.currency(em.objetivo)}</div><div class="kpi-box-lbl">Objetivo</div></div>
        <div class="kpi-box"><div class="kpi-box-val mono" style="color:var(--amber)">${em.meses || 6} meses</div><div class="kpi-box-lbl">Cobertura</div></div>
      </div>
      ${em.mesesParaCompletar !== null && em.ratio < 1
        ? `<div style="margin-top:8px;font-size:11px;color:var(--t3)">
            Faltan ${Fmt.currencyFull(em.falta)} · ${em.mesesParaCompletar} mes${em.mesesParaCompletar !== 1 ? 'es' : ''} con el ahorro actual
          </div>`
        : em.ratio >= 1 ? `<div style="margin-top:8px;font-size:11px;color:var(--green);font-weight:700">✓ Fondo completo</div>` : ''}
    </div>

    <!-- Inversiones -->
    <div class="card card-p">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <div class="label">📈 Inversiones</div>
        <button onclick="openAddInversion()" class="btn btn-ghost btn-sm">+ Agregar</button>
      </div>
      ${inv.invs.length ? `
        <div class="kpi-grid-2" style="margin-bottom:12px">
          <div class="kpi-box"><div class="kpi-box-val mono">${Fmt.currency(inv.capitalTotal)}</div><div class="kpi-box-lbl">Capital invertido</div></div>
          <div class="kpi-box"><div class="kpi-box-val mono" style="color:${inv.gananciaTotal >= 0 ? 'var(--green)' : 'var(--red)'}">
            ${inv.gananciaTotal >= 0 ? '+' : ''}${Fmt.currency(inv.gananciaTotal)}
          </div><div class="kpi-box-lbl">Ganancia total</div></div>
        </div>
        ${inv.invs.map(i => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--off)">${Fmt.escHtml(i.nombre || i.tipo || 'Inversión')}</div>
              <div style="font-size:10px;color:var(--t3)">Capital: ${Fmt.currencyFull(i.capital)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:13px;font-weight:700;font-family:var(--mono);color:${(i.valor - i.capital) >= 0 ? 'var(--green)' : 'var(--red)'}">
                ${(i.valor - i.capital) >= 0 ? '+' : ''}${Fmt.currencyFull(i.valor - i.capital)}
              </div>
              <div style="font-size:10px;color:var(--t3)">${i.tipo || ''}</div>
            </div>
          </div>`).join('')}
      ` : `<div style="font-size:12px;color:var(--t3);text-align:center;padding:16px 0">Sin inversiones registradas</div>`}
    </div>`;
}

function renderPatrimonioRow(icon, label, value, color) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:14px">${icon}</span>
      <span style="font-size:12px;color:var(--t2)">${label}</span>
    </div>
    <span style="font-size:13px;font-weight:700;font-family:var(--mono);color:${color}">${Fmt.currencyFull(value)}</span>
  </div>`;
}

// ═══════════════════════════════════════
// PROYECCIÓN — Simulador financiero
// ═══════════════════════════════════════
function renderProyeccion() {
  const container = document.getElementById('fin-proyeccion');
  if (!container) return;

  const kpis = calcMonthKPIs();
  const defaultAhorro = Math.max(0, kpis.ahorro);
  const fd = getFinData();
  const proy = fd.proyeccion || { ahorro: defaultAhorro, rentabilidad: 8 };

  const curve1m  = calcProjection(1,  { ahorro: proy.ahorro || defaultAhorro, rentabilidad: proy.rentabilidad });
  const curve3m  = calcProjection(3,  { ahorro: proy.ahorro || defaultAhorro, rentabilidad: proy.rentabilidad });
  const curve6m  = calcProjection(6,  { ahorro: proy.ahorro || defaultAhorro, rentabilidad: proy.rentabilidad });
  const curve12m = calcProjection(12, { ahorro: proy.ahorro || defaultAhorro, rentabilidad: proy.rentabilidad });

  container.innerHTML = `
    <div class="card card-p" style="margin-bottom:12px">
      <div class="label" style="margin-bottom:12px">Simulador de proyección</div>

      <div style="display:flex;gap:10px;margin-bottom:12px">
        <div class="field" style="flex:1;margin:0">
          <label>Ahorro mensual ($)</label>
          <input type="number" id="proy-ahorro" value="${(proy.ahorro || defaultAhorro).toFixed(0)}"
            onchange="updateProyeccion()"
            style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--off);font-size:13px;font-family:var(--font)">
        </div>
        <div class="field" style="flex:1;margin:0">
          <label>Rentabilidad anual (%)</label>
          <input type="number" id="proy-rent" value="${proy.rentabilidad || 8}"
            onchange="updateProyeccion()"
            style="width:100%;background:var(--s3);border:1px solid var(--border);border-radius:10px;padding:8px 12px;color:var(--off);font-size:13px;font-family:var(--font)">
        </div>
      </div>

      <div class="kpi-grid-2" style="margin-bottom:12px">
        <div class="kpi-box" style="border:1px solid rgba(0,232,122,.2)">
          <div class="kpi-box-val mono" style="color:var(--green)">${Fmt.currency(curve1m[curve1m.length-1].value)}</div>
          <div class="kpi-box-lbl">En 1 mes</div>
        </div>
        <div class="kpi-box" style="border:1px solid rgba(79,142,247,.2)">
          <div class="kpi-box-val mono" style="color:var(--blue)">${Fmt.currency(curve3m[curve3m.length-1].value)}</div>
          <div class="kpi-box-lbl">En 3 meses</div>
        </div>
        <div class="kpi-box" style="border:1px solid rgba(139,92,246,.2)">
          <div class="kpi-box-val mono" style="color:var(--purple)">${Fmt.currency(curve6m[curve6m.length-1].value)}</div>
          <div class="kpi-box-lbl">En 6 meses</div>
        </div>
        <div class="kpi-box" style="border:1px solid rgba(245,158,11,.2)">
          <div class="kpi-box-val mono" style="color:var(--amber)">${Fmt.currency(curve12m[curve12m.length-1].value)}</div>
          <div class="kpi-box-lbl">En 12 meses</div>
        </div>
      </div>

      <div class="chart-wrap"><canvas id="chart-proyeccion"></canvas></div>
      <div style="margin-top:8px;font-size:10px;color:var(--t3);text-align:center">
        Basado en ahorro e interés compuesto mensual · No es asesoramiento financiero.
      </div>
    </div>`;

  renderProyeccionChart(curve12m);
}

function renderProyeccionChart(curve) {
  setTimeout(() => {
    if (typeof charts !== 'undefined' && charts['chart-proyeccion']) {
      charts['chart-proyeccion'].destroy();
      delete charts['chart-proyeccion'];
    }
    const ctx = document.getElementById('chart-proyeccion')?.getContext('2d');
    if (!ctx) return;
    charts['chart-proyeccion'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: curve.map(p => `M${p.month}`),
        datasets: [{
          data: curve.map(p => p.value),
          borderColor: '#4F8EF7',
          backgroundColor: 'rgba(79,142,247,.08)',
          fill: true, tension: 0.4, pointRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748B', font: { size: 9 } }, grid: { color: '#1A1A2E' } },
          y: { ticks: { color: '#64748B', callback: v => '$' + v, font: { size: 9 } }, grid: { color: '#1A1A2E' } },
        },
      },
    });
  }, 50);
}

// ═══════════════════════════════════════
// METAS FINANCIERAS
// ═══════════════════════════════════════
function renderFinMetas() {
  const goals = State.get('finGoals') || [];
  const container = document.getElementById('fin-metas');
  if (!container) return;

  container.innerHTML = goals.length ? goals.map(g => {
    const ratio = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0;
    const rem   = Fmt.daysRemaining(g.fecha);
    return `<div class="card card-p" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-size:24px">${g.icon || '🎯'}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--off)">${Fmt.escHtml(g.name)}</div>
          ${rem !== null ? `<div style="font-size:10px;color:${rem < 7 ? 'var(--red)' : 'var(--t3)'}">
            ${rem > 0 ? `Faltan ${rem} días` : rem === 0 ? 'Hoy' : 'Vencida'}
          </div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:800;font-family:var(--mono);color:${g.color || 'var(--green)'}">
            ${Math.round(ratio * 100)}%
          </div>
        </div>
      </div>
      <div class="prog-track" style="height:8px;margin-bottom:6px">
        <div class="prog-fill" style="width:${ratio*100}%;height:8px;background:${g.color || 'var(--green)'}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3)">
        <span>Ahorrado: <span style="font-weight:700;color:var(--off)">${Fmt.currencyFull(g.saved || 0)}</span></span>
        <span>Objetivo: <span style="font-weight:700;color:var(--off)">${Fmt.currencyFull(g.target)}</span></span>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state">
    <span class="empty-icon">🎯</span>
    <div class="empty-text">Sin metas financieras aún.<br>Tocá + para agregar.</div>
  </div>`;
}

// ═══════════════════════════════════════
// ACCIONES — Agregar movimiento, categoría, etc.
// ═══════════════════════════════════════
export async function addMovimiento() {
  const tipo  = DOM.val('mov-tipo');
  const desc  = DOM.val('mov-desc');
  const monto = DOM.val('mov-monto');
  const catId = DOM.val('mov-cat');
  const fecha = DOM.val('mov-fecha') || Dates.todayISO();

  const errors = Validators.movement({ tipo, desc, monto, fecha });
  if (Validators.hasErrors(errors)) {
    const form = document.getElementById('modal-new-mov');
    if (form) Validators.displayErrors(form, errors);
    DOM.toast(Object.values(errors)[0], 'error');
    return;
  }

  const mov = {
    id: genId(), tipo, catId: catId || null,
    desc, monto: parseFloat(monto), fecha,
  };

  await DB.addMovimiento(mov);
  DOM.closeModal('modal-new-mov');
  DOM.clearVal('mov-desc', 'mov-monto', 'mov-fecha');
  DOM.toast('Movimiento guardado ✓');
  renderFinanzas();
}

export async function deleteMovimiento(mid) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  await DB.deleteMovimiento(mid);
  renderMovimientos();
  DOM.toast('Eliminado');
}

export async function addFinCat() {
  const name   = DOM.val('cat-name');
  const budget = DOM.val('cat-budget');
  const icon   = DOM.val('cat-icon') || '📁';
  const color  = DOM.val('cat-color') || '#4F8EF7';

  const errors = Validators.finCategory({ name, budget });
  if (Validators.hasErrors(errors)) { DOM.toast(Object.values(errors)[0], 'error'); return; }

  await DB.addFinCat({ id: genId(), name, budget: parseFloat(budget), icon, color });
  DOM.closeModal('modal-new-cat');
  DOM.clearVal('cat-name', 'cat-budget', 'cat-icon');
  DOM.toast('Categoría guardada ✓');
  renderFinanzas();
}

export async function saveIngreso() {
  const amount = DOM.numVal('ingreso-amount');
  const err = Validators.nonNegativeNumber(amount, 'Ingreso');
  if (err) { DOM.toast(err, 'error'); return; }
  await DB.saveIngreso(amount);
  DOM.closeModal('modal-set-ingreso');
  DOM.toast('Ingreso guardado ✓');
  renderFinanzas();
}

export async function savePatrimonio(tipo) {
  const field = tipo === 'activos'
    ? { efectivo: DOM.numVal('pa-efectivo'), banco: DOM.numVal('pa-banco'), mp: DOM.numVal('pa-mp'), inversiones: DOM.numVal('pa-inv'), otros: DOM.numVal('pa-otros') }
    : { tarjetas: DOM.numVal('pp-tarjetas'), prestamos: DOM.numVal('pp-prestamos'), deudas: DOM.numVal('pp-deudas'), otros: DOM.numVal('pp-otros') };

  const current = calcPatrimonio();
  const activos = tipo === 'activos' ? field : current.activos;
  const pasivos = tipo === 'pasivos' ? field : current.pasivos;

  await DB.savePatrimonio(activos, pasivos);
  DOM.closeModal('modal-edit-patrimonio');
  DOM.toast('Patrimonio actualizado ✓');
  renderFinanzas();
}

export async function saveEmergencia() {
  const gastos = DOM.numVal('em-gastos');
  const meses  = DOM.numVal('em-meses');
  const actual = DOM.numVal('em-actual');
  await DB.saveEmergencia({ gastos, meses, actual });
  DOM.closeModal('modal-edit-emergencia');
  DOM.toast('Fondo de emergencia actualizado ✓');
  renderFinanzas();
}

export async function addInversion() {
  const nombre  = DOM.val('inv-nombre');
  const tipo    = DOM.val('inv-tipo');
  const capital = DOM.numVal('inv-capital');
  const valor   = DOM.numVal('inv-valor') || capital;

  if (!nombre || capital <= 0) { DOM.toast('Completá nombre y capital', 'error'); return; }
  await DB.addInversion({ id: genId(), nombre, tipo, capital, valor });
  DOM.closeModal('modal-add-inv');
  DOM.toast('Inversión agregada ✓');
  renderFinanzas();
}

// Actualizar proyección en tiempo real
window.updateProyeccion = function() {
  const ahorro = parseFloat(document.getElementById('proy-ahorro')?.value) || 0;
  const rent   = parseFloat(document.getElementById('proy-rent')?.value)   || 8;
  const curve  = calcProjection(12, { ahorro, rentabilidad: rent });
  const vals   = ['1','3','6','12'].map(n => calcProjection(parseInt(n), { ahorro, rentabilidad: rent }));

  const kpis = document.querySelectorAll('#fin-proyeccion .kpi-box-val');
  if (kpis[0]) kpis[0].textContent = Fmt.currency(vals[0][vals[0].length-1].value);
  if (kpis[1]) kpis[1].textContent = Fmt.currency(vals[1][vals[1].length-1].value);
  if (kpis[2]) kpis[2].textContent = Fmt.currency(vals[2][vals[2].length-1].value);
  if (kpis[3]) kpis[3].textContent = Fmt.currency(vals[3][vals[3].length-1].value);
  renderProyeccionChart(curve);
  DB.saveProyeccion({ ahorro, rentabilidad: rent });
};

// Helpers globales
window.setFinPeriod = function(p) { activePeriod = p; renderMovimientos(); };
window.openSetIngreso = function() { DOM.setVal('ingreso-amount', getIngreso() || ''); DOM.openModal('modal-set-ingreso'); };
window.openEditPatrimonio = function(tipo) {
  const patr = calcPatrimonio();
  if (tipo === 'activos') {
    DOM.setVal('pa-efectivo', patr.activos.efectivo || 0);
    DOM.setVal('pa-banco',    patr.activos.banco    || 0);
    DOM.setVal('pa-mp',       patr.activos.mp       || 0);
    DOM.setVal('pa-inv',      patr.activos.inversiones || 0);
    DOM.setVal('pa-otros',    patr.activos.otros    || 0);
    document.getElementById('pat-tipo-hidden').value = 'activos';
  } else {
    DOM.setVal('pp-tarjetas',  patr.pasivos.tarjetas  || 0);
    DOM.setVal('pp-prestamos', patr.pasivos.prestamos || 0);
    DOM.setVal('pp-deudas',    patr.pasivos.deudas    || 0);
    DOM.setVal('pp-otros',     patr.pasivos.otros     || 0);
    document.getElementById('pat-tipo-hidden').value = 'pasivos';
  }
  DOM.openModal('modal-edit-patrimonio');
};
window.openEditEmergencia = function() {
  const em = calcEmergencia();
  DOM.setVal('em-gastos', em.gastos || 0);
  DOM.setVal('em-meses',  em.meses  || 6);
  DOM.setVal('em-actual', em.actual || 0);
  DOM.openModal('modal-edit-emergencia');
};
window.openAddInversion = function() { DOM.openModal('modal-add-inv'); };
window.editFinCat = function(id) {
  const cat = (State.get('finCats') || []).find(c => c.id === id);
  if (!cat) return;
  DOM.setVal('cat-name', cat.name); DOM.setVal('cat-budget', cat.budget || 0);
  DOM.setVal('cat-icon', cat.icon || ''); DOM.setVal('cat-color', cat.color || '#4F8EF7');
  DOM.openModal('modal-new-cat');
};

window.addMovimiento   = addMovimiento;
window.deleteMovimiento = deleteMovimiento;
window.addFinCat       = addFinCat;
window.saveIngreso     = saveIngreso;
window.savePatrimonio  = savePatrimonio;
window.saveEmergencia  = saveEmergencia;
window.addInversion    = addInversion;
window.switchFinTab    = (tab) => switchTab(tab);
