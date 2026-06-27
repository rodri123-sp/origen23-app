// ═══════════════════════════════════════
// DASHBOARD/INDEX.JS — Dashboard principal
// ═══════════════════════════════════════
import State from '../../services/state.js';
import { Dates } from '../../utils/dates.js';
import { Fmt } from '../../utils/formatters.js';
import { DOM } from '../../components/dom.js';
import { lifeScore, lifeScoreBreakdown, areaCritica, scoreTrend, scoreLevel, userXP, habitPct, isDone } from '../../services/score-calc.js';
import { calcMonthKPIs } from '../../services/finance-calc.js';
import { calcTradeStats } from '../../services/trading-calc.js';

export function renderDashboard() {
  const container = document.getElementById('page-dashboard');
  if (!container) return;

  const uid      = State.get('user')?.id;
  const profile  = State.get('profile') || {};
  const habits   = State.get('habits') || [];
  const mk       = Dates.monthKey();
  const today    = Dates.today();

  const score     = lifeScore();
  const breakdown = lifeScoreBreakdown();
  const trend     = scoreTrend();
  const level     = scoreLevel(score);
  const critica   = areaCritica();
  const xp        = userXP();
  const kpis      = calcMonthKPIs();
  const tradeSt   = calcTradeStats();
  const metas     = State.get('metas') || [];

  // Hábitos de hoy
  const doneToday = habits.filter(h => isDone(h.id, today, mk));
  const pctHoy    = habits.length ? doneToday.length / habits.length : 0;

  const weekDay = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date().getDay()];
  const dateStr = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long' });

  container.innerHTML = `
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div>
        <div style="font-size:11px;color:var(--t3)">${weekDay}, ${dateStr}</div>
        <div style="font-size:20px;font-weight:800;color:var(--off)">Buenos días${profile.name ? ', ' + Fmt.escHtml(profile.name.split(' ')[0]) : ''} 👋</div>
      </div>
      <div style="width:44px;height:44px;border-radius:14px;background:${profile.color || 'var(--green)'};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#000;cursor:pointer" onclick="goTo('perfil')">
        ${Fmt.initials(profile.name || 'U')}
      </div>
    </div>

    <!-- Life Score card -->
    <div class="card card-p" style="margin-bottom:14px;background:linear-gradient(135deg,var(--s3) 0%,var(--s4) 100%);border:1px solid rgba(0,232,122,.15)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--t3);letter-spacing:.08em;text-transform:uppercase">Life Score</div>
          <div style="font-size:52px;font-weight:800;font-family:var(--mono);color:${level.color};line-height:1">${score}</div>
          <div style="font-size:12px;color:${level.color};font-weight:700;margin-top:2px">${level.name}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:var(--t3)">Esta semana</div>
          <div style="font-size:14px;font-weight:700;color:${trend.weekly >= 0 ? 'var(--green)' : 'var(--red)'}">
            ${trend.weekly >= 0 ? '↑' : '↓'} ${Math.abs(trend.weekly)} pts
          </div>
          <div style="font-size:10px;color:var(--t3);margin-top:4px">XP total</div>
          <div style="font-size:14px;font-weight:700;color:var(--purple)" class="mono">${xp.toLocaleString()}</div>
        </div>
      </div>

      <!-- Breakdown barras -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          { key: 'salud', label: '💪 Salud', color: '#00E87A' },
          { key: 'productividad', label: '⚡ Productividad', color: '#4F8EF7' },
          { key: 'finanzas', label: '💰 Finanzas', color: '#8B5CF6' },
          { key: 'trading', label: '📈 Trading', color: '#F59E0B' },
        ].map(d => `
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:10px;color:var(--t2)">${d.label}</span>
              <span style="font-size:10px;font-weight:700;color:${d.color}">${breakdown[d.key]}</span>
            </div>
            <div class="prog-track" style="height:4px">
              <div class="prog-fill" style="width:${breakdown[d.key]}%;height:4px;background:${d.color}"></div>
            </div>
          </div>`).join('')}
      </div>

      ${critica.val < 40 ? `
        <div style="margin-top:12px;padding:10px;border-radius:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2)">
          <div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:2px">⚠️ Área crítica: ${critica.label}</div>
          <div style="font-size:10px;color:var(--t3)">${Fmt.escHtml(critica.msg)}</div>
        </div>` : ''}
    </div>

    <!-- Hábitos de hoy -->
    <div class="card card-p" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--off)">Hoy · ${doneToday.length}/${habits.length} hábitos</div>
        <button onclick="goTo('habitos')" class="btn btn-ghost btn-sm">Ver todo</button>
      </div>
      <div class="prog-track" style="height:8px;margin-bottom:10px">
        <div class="prog-fill" style="width:${pctHoy*100}%;height:8px;background:${pctHoy >= 0.8 ? 'var(--green)' : pctHoy >= 0.5 ? 'var(--amber)' : 'var(--red)'}"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${habits.slice(0, 8).map(h => {
          const done = isDone(h.id, today, mk);
          return `<div onclick="goTo('habitos')" style="display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:8px;cursor:pointer;
            background:${done ? `${h.color || '#00E87A'}20` : 'var(--s3)'};
            border:1px solid ${done ? (h.color || 'var(--green)') + '50' : 'transparent'}">
            <span style="font-size:12px">${done ? '✅' : (h.icon || '⭕')}</span>
            <span style="font-size:10px;font-weight:${done ? 700 : 400};color:${done ? 'var(--off)' : 'var(--t3)'}">${Fmt.escHtml(h.name)}</span>
          </div>`;
        }).join('')}
        ${habits.length > 8 ? `<div style="font-size:10px;color:var(--t3);padding:4px 8px;align-self:center">+${habits.length-8} más</div>` : ''}
      </div>
    </div>

    <!-- Finanzas quick view -->
    <div class="card card-p" style="margin-bottom:12px;cursor:pointer" onclick="goTo('finanzas')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--off)">💰 Finanzas del mes</div>
        <span style="font-size:10px;color:var(--t3)">Ver →</span>
      </div>
      <div class="kpi-grid-3">
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:var(--green)">${Fmt.currency(kpis.ing)}</div>
          <div class="kpi-box-lbl">Ingresos</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:var(--red)">${Fmt.currency(kpis.gas)}</div>
          <div class="kpi-box-lbl">Gastos</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${kpis.ahorro >= 0 ? 'var(--blue)' : 'var(--red)'}">
            ${kpis.ahorro >= 0 ? '' : '-'}${Fmt.currency(Math.abs(kpis.ahorro))}
          </div>
          <div class="kpi-box-lbl">Ahorro</div>
        </div>
      </div>
    </div>

    <!-- Trading quick view -->
    ${tradeSt.totalTrades > 0 ? `
    <div class="card card-p" style="margin-bottom:12px;cursor:pointer" onclick="goTo('trading')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--off)">📈 Trading</div>
        <span style="font-size:10px;color:var(--t3)">Ver →</span>
      </div>
      <div class="kpi-grid-3">
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${tradeSt.wr >= 0.5 ? 'var(--green)' : 'var(--red)'}">
            ${Math.round(tradeSt.wr*100)}%
          </div>
          <div class="kpi-box-lbl">Win Rate</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${tradeSt.profitFactor >= 1 ? 'var(--green)' : 'var(--red)'}">
            ${tradeSt.profitFactor.toFixed(2)}
          </div>
          <div class="kpi-box-lbl">Profit Factor</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-box-val mono" style="color:${tradeSt.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">
            ${tradeSt.pnl >= 0 ? '+' : ''}${Fmt.currency(tradeSt.pnl)}
          </div>
          <div class="kpi-box-lbl">P&L Neto</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Metas activas -->
    ${metas.length ? `
    <div class="card card-p">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--off)">🏆 Metas activas</div>
        <button onclick="goTo('metas')" class="btn btn-ghost btn-sm">Ver todo</button>
      </div>
      ${metas.slice(0,3).map(m => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-size:18px">${m.icon || '🎯'}</span>
          <div style="flex:1">
            <div style="font-size:11px;font-weight:600;color:var(--off);margin-bottom:3px">${Fmt.escHtml(m.name)}</div>
            <div class="prog-track" style="height:4px">
              <div class="prog-fill" style="width:${m.pct || 0}%;height:4px;background:${m.color || 'var(--green)'}"></div>
            </div>
          </div>
          <span style="font-size:12px;font-weight:700;font-family:var(--mono);color:${m.color || 'var(--green)'}">
            ${m.pct || 0}%
          </span>
        </div>`).join('')}
    </div>` : ''}`;
}
