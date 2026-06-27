// ═══════════════════════════════════════
// HABITS/INDEX.JS — Módulo de hábitos
// ═══════════════════════════════════════
import State from '../../services/state.js';
import { DB, genId } from '../../services/db.js';
import { Dates } from '../../utils/dates.js';
import { Fmt } from '../../utils/formatters.js';
import { Validators } from '../../utils/validators.js';
import { DOM } from '../../components/dom.js';
import { habitDoneCount, habitPct, habitStreak, habitMaxStreak, isDone } from '../../services/score-calc.js';

let activeTab = 'tracker';
let selectedDay = Dates.today();
const SECTIONS = ['matutino', 'diario', 'nocturno'];
const SECTION_LABELS = { matutino: '🌅 Matutino', diario: '☀️ Hábitos diarios', nocturno: '🌙 Nocturno' };

export function renderHabitos() {
  switchTab(activeTab, false);
}

export function switchTab(tab, rerender = true) {
  activeTab = tab;
  ['tracker', 'estadisticas', 'rachas'].forEach(t => DOM.toggle('hab-' + t, t === tab));
  document.querySelectorAll('#page-habitos .tab-switch-btn').forEach((b, i) => {
    b.classList.toggle('active', ['tracker', 'estadisticas', 'rachas'][i] === tab);
  });
  if (rerender) {
    ({ tracker: renderTracker, estadisticas: renderEstadisticas, rachas: renderRachas }[tab] || renderTracker)();
  }
}

// ── Tracker diario ────────────────────────
function renderTracker() {
  const habits = State.get('habits') || [];
  const mk     = Dates.monthKey();
  const daysInM = Dates.daysInMonth();
  const container = document.getElementById('hab-tracker');
  if (!container) return;

  // Day selector
  let dayPickerHtml = `<div class="day-picker-scroll" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px">`;
  for (let d = 1; d <= daysInM; d++) {
    const date = new Date(Dates.currentYear(), Dates.currentMonth(), d);
    const dow  = ['D','L','M','X','J','V','S'][date.getDay()];
    const isSel = d === selectedDay;
    const isToday = d === Dates.today();
    dayPickerHtml += `<div onclick="selectHabDay(${d})" style="flex-shrink:0;width:42px;height:58px;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
      background:${isSel ? 'var(--green)' : isToday ? 'rgba(0,232,122,.12)' : 'var(--s3)'};
      border:${isToday && !isSel ? '1px solid rgba(0,232,122,.4)' : '1px solid transparent'}">
      <span style="font-size:9px;font-weight:600;color:${isSel ? '#000' : 'var(--t3)'}">${dow}</span>
      <span style="font-size:16px;font-weight:800;color:${isSel ? '#000' : 'var(--off)'}">${d}</span>
    </div>`;
  }
  dayPickerHtml += '</div>';

  // Progreso del día
  const doneToday = habits.filter(h => isDone(h.id, selectedDay, mk)).length;
  const pctToday  = habits.length ? doneToday / habits.length : 0;

  // Secciones de hábitos
  let sectionsHtml = '';
  SECTIONS.forEach(sec => {
    const secHabits = habits.filter(h => h.section === sec || (!h.section && sec === 'diario'));
    if (!secHabits.length) return;
    sectionsHtml += `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:var(--t3);letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px">${SECTION_LABELS[sec]}</div>
      ${secHabits.map(h => {
        const done   = isDone(h.id, selectedDay, mk);
        const streak = habitStreak(h.id);
        return `<div onclick="toggleHabit('${h.id}',${selectedDay})" class="habit-row ${done ? 'done' : ''}"
          style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;margin-bottom:6px;cursor:pointer;
          background:${done ? `rgba(${hexToRgb(h.color || '#00E87A')},.1)` : 'var(--s3)'};
          border:1px solid ${done ? (h.color || 'var(--green)') + '40' : 'transparent'};
          transition:all .2s ease">
          <div style="width:40px;height:40px;border-radius:12px;background:${done ? (h.color || 'var(--green)') : 'var(--s4)'};
            display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;transition:all .2s">
            ${done ? '✅' : (h.icon || '⭕')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:${done ? '700' : '500'};color:${done ? 'var(--off)' : 'var(--t2)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${Fmt.escHtml(h.name)}
            </div>
            ${streak > 0 ? `<div style="font-size:10px;color:${h.color || 'var(--green)'};margin-top:1px">🔥 Racha: ${streak} días</div>` : ''}
          </div>
          <div style="width:24px;height:24px;border-radius:50%;border:2px solid ${done ? (h.color || 'var(--green)') : 'var(--s4)'};
            background:${done ? (h.color || 'var(--green)') : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${done ? '<span style="color:#000;font-size:12px;font-weight:800">✓</span>' : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  });

  container.innerHTML = `
    ${dayPickerHtml}

    <div class="card card-p" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;font-weight:600;color:var(--off)">
          ${selectedDay === Dates.today() ? 'Hoy' : `Día ${selectedDay}`} · ${doneToday}/${habits.length} hábitos
        </span>
        <span style="font-size:14px;font-weight:800;color:var(--green)">${Math.round(pctToday*100)}%</span>
      </div>
      <div class="prog-track" style="height:8px">
        <div class="prog-fill" style="width:${pctToday*100}%;height:8px;background:${pctToday >= 0.8 ? 'var(--green)' : pctToday >= 0.5 ? 'var(--amber)' : 'var(--red)'}"></div>
      </div>
    </div>

    ${habits.length ? sectionsHtml : `<div class="empty-state">
      <span class="empty-icon">🧩</span>
      <div class="empty-text">Sin hábitos aún.<br>Tocá + para crear tu rutina.</div>
    </div>`}`;
}

// ── Estadísticas ──────────────────────────
function renderEstadisticas() {
  const habits = State.get('habits') || [];
  const daysInM = Dates.daysInMonth();
  const container = document.getElementById('hab-estadisticas');
  if (!container) return;

  // Score mensual del mes
  let totalDone = 0, total = 0;
  habits.forEach(h => { totalDone += habitDoneCount(h.id); total += daysInM; });
  const overallPct = total > 0 ? totalDone / total : 0;

  container.innerHTML = `
    <div class="card card-p" style="margin-bottom:12px">
      <div class="label" style="margin-bottom:8px">Adherencia del mes</div>
      <div style="text-align:center;padding:8px 0 12px">
        <div style="font-size:48px;font-weight:800;font-family:var(--mono);color:${overallPct >= 0.8 ? 'var(--green)' : overallPct >= 0.5 ? 'var(--amber)' : 'var(--red)'}">
          ${Math.round(overallPct * 100)}%
        </div>
        <div style="font-size:11px;color:var(--t3)">${totalDone}/${total} días completados</div>
      </div>
      <div class="prog-track" style="height:10px">
        <div class="prog-fill" style="width:${overallPct*100}%;height:10px;background:${overallPct >= 0.8 ? 'var(--green)' : overallPct >= 0.5 ? 'var(--amber)' : 'var(--red)'}"></div>
      </div>
    </div>

    ${habits.map(h => {
      const count    = habitDoneCount(h.id);
      const pct      = habitPct(h.id);
      const streak   = habitStreak(h.id);
      const maxStreak = habitMaxStreak(h.id);
      const color     = h.color || 'var(--green)';

      return `<div class="card card-p" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:${color};display:flex;align-items:center;justify-content:center;font-size:16px">${h.icon || '⭕'}</div>
          <div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--off)">${Fmt.escHtml(h.name)}</div></div>
          <div style="font-size:16px;font-weight:800;font-family:var(--mono);color:${color}">${Math.round(pct*100)}%</div>
        </div>
        <div class="prog-track" style="height:6px;margin-bottom:8px">
          <div class="prog-fill" style="width:${pct*100}%;height:6px;background:${color}"></div>
        </div>
        <div style="display:flex;gap:10px;font-size:10px;color:var(--t3)">
          <span>✓ ${count}/${daysInM} días</span>
          ${streak > 0 ? `<span>🔥 Racha: ${streak}</span>` : ''}
          ${maxStreak > 0 ? `<span>⭐ Mejor: ${maxStreak}</span>` : ''}
        </div>
      </div>`;
    }).join('')}`;
}

// ── Rachas ───────────────────────────────
function renderRachas() {
  const habits = State.get('habits') || [];
  const mk     = Dates.monthKey();
  const daysInM = Dates.daysInMonth();
  const container = document.getElementById('hab-rachas');
  if (!container) return;

  container.innerHTML = habits.map(h => {
    const cells = Array.from({ length: daysInM }, (_, i) => {
      const d    = i + 1;
      const done = isDone(h.id, d, mk);
      const isToday = d === Dates.today();
      return `<div style="width:calc(100%/7 - 2px);min-width:28px;aspect-ratio:1;border-radius:6px;
        background:${done ? (h.color || 'var(--green)') : 'var(--s3)'};
        border:${isToday ? '2px solid var(--green)' : 'none'};
        display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;
        color:${done ? '#000' : 'var(--t3)'}">${d}</div>`;
    }).join('');

    return `<div class="card card-p" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:18px">${h.icon || '⭕'}</span>
        <span style="font-size:12px;font-weight:700;color:var(--off);flex:1">${Fmt.escHtml(h.name)}</span>
        <span style="font-size:12px;font-weight:700;color:${h.color || 'var(--green)'}">
          🔥 ${habitStreak(h.id)}
        </span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:2px">${cells}</div>
    </div>`;
  }).join('') || `<div class="empty-state"><span class="empty-icon">🔥</span><div class="empty-text">Agregá hábitos para ver tus rachas.</div></div>`;
}

// ── Toggle hábito ─────────────────────────
export async function toggleHabit(hid, day) {
  await DB.toggleHabit(hid, day);
  renderTracker();
}

// ── Agregar hábito ────────────────────────
export async function addHabit() {
  const name    = DOM.val('hab-name');
  const icon    = DOM.val('hab-icon') || '⭕';
  const section = DOM.val('hab-section') || 'diario';
  const color   = DOM.val('hab-color')  || '#00E87A';

  const errors = Validators.habit({ name, icon });
  if (Validators.hasErrors(errors)) { DOM.toast(Object.values(errors)[0], 'error'); return; }

  const habits = State.get('habits') || [];
  if (habits.some(h => h.name.toLowerCase() === name.toLowerCase())) {
    DOM.toast('Ya existe un hábito con ese nombre', 'error'); return;
  }

  await DB.addHabit({ id: genId(), icon, name, color, section });
  DOM.closeModal('modal-new-habit');
  DOM.clearVal('hab-name', 'hab-icon');
  DOM.toast('Hábito agregado ✓');
  renderHabitos();
}

export async function deleteHabit(hid) {
  if (!confirm('¿Eliminar hábito y su historial?')) return;
  await DB.deleteHabit(hid);
  renderHabitos();
  DOM.toast('Hábito eliminado');
}

// ── Helpers ────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

window.selectHabDay  = function(d) { selectedDay = d; renderTracker(); };
window.toggleHabit   = toggleHabit;
window.addHabit      = addHabit;
window.deleteHabit   = deleteHabit;
window.switchHabTab  = (tab) => switchTab(tab);
