// ═══════════════════════════════════════
// MAIN.JS — Punto de entrada de la app
// Orquesta auth, estado, módulos y routing.
// NO contiene lógica de negocio — solo conecta.
// ═══════════════════════════════════════
import State from './services/state.js';
import { Auth, loadAllData, insertDefaultData } from './services/db.js';
import { DOM } from './components/dom.js';
import { Dates } from './utils/dates.js';
import { lifeScore, lifeScoreBreakdown, areaCritica, scoreTrend, userXP, scoreLevel } from './services/score-calc.js';
import { Fmt } from './utils/formatters.js';
import { calcTradeStats } from './services/trading-calc.js';
import { DB } from './services/db.js';

// ── Módulos ────────────────────────────────
import { renderDashboard }  from './modules/dashboard/index.js';
import { renderHabitos }    from './modules/habits/index.js';
import { renderTrading }    from './modules/trading/index.js';
import { renderFinanzas }   from './modules/finance/index.js';
import { renderGoals }     from './modules/goals/index.js';
import { Err }             from './services/error-handler.js';
import { initPlugins }     from './services/plugins.js';

// ── Router ─────────────────────────────────
const PAGES = ['dashboard','habitos','trading','finanzas','metas','semana','diario','metricas','insights','gamificacion','perfil'];
let currentPage = 'dashboard';

export function goTo(page) {
  if (!PAGES.includes(page)) return;

  PAGES.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = p === page ? '' : 'none';
  });

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));

  // Ocultar FABs específicos antes de renderizar
  DOM.hide('mov-fab');

  currentPage = page;
  State.setState({ currentPage: page });
  renderPage(page);
}

function renderPage(page) {
  switch(page) {
    case 'dashboard':    renderDashboard(); break;
    case 'habitos':      renderHabitos();   break;
    case 'trading':      renderTrading();   break;
    case 'finanzas':     renderFinanzas();  break;
    default:
      renderPlaceholder(page);
  }
}

function renderPlaceholder(page) {
  const el = document.getElementById('page-' + page);
  if (!el) return;
  const labels = {
    metas: '🏆 Metas', semana: '📅 Semana', diario: '📓 Diario',
    metricas: '📊 Métricas', insights: '🔍 Insights', gamificacion: '🎮 Gamificación', perfil: '👤 Perfil',
  };
  const existing = el.querySelector('.empty-state');
  if (!existing) {
    el.innerHTML = `<div class="empty-state" style="padding-top:60px">
      <div style="font-size:40px">${labels[page]?.charAt(0) || '🔧'}</div>
      <div class="empty-text" style="margin-top:12px">Módulo en desarrollo próximamente</div>
    </div>`;
  }
}

// ── Auth ────────────────────────────────────
async function init() {
  // Inicializar sistema de errores
  Err.onError((entry) => console.warn('[ERROR]', entry));
  // Inicializar plugins
  initPlugins({ export: true, sync: true });

  State.loadCache();

  Auth.onAuthStateChange(async (_, session) => {
    const user = session?.user || null;
    State.setState({ user });

    if (!user) {
      showAuth();
      return;
    }

    showLoading(true);
    try {
      await Err.wrap(() => loadAllData(user.id), { context: 'init:loadAllData' });
      State.saveCache();
    } catch (err) {
      console.error('Load error:', err);
      DOM.toast('Error al cargar datos. Usando caché.', 'error');
    }
    showLoading(false);
    showApp();
    goTo('dashboard');

    // Snapshot de score diario
    DB.saveScoreSnapshot(Dates.todayISO(), lifeScore());
  });
}

function showAuth()       { document.getElementById('auth-screen').style.display = ''; document.getElementById('app-shell').style.display = 'none'; }
function showApp()        { document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app-shell').style.display = ''; }
function showLoading(on)  { document.getElementById('loading-overlay').style.display = on ? 'flex' : 'none'; }

// ── Auth actions ────────────────────────────
window.doLogin = async function() {
  const email = DOM.val('login-email');
  const pass  = DOM.val('login-pass');
  if (!email || !pass) { DOM.toast('Ingresá email y contraseña', 'error'); return; }
  try {
    showLoading(true);
    await Auth.signIn(email, pass);
  } catch(e) {
    showLoading(false);
    DOM.toast(e.message || 'Error de ingreso', 'error');
  }
};

window.doSignup = async function() {
  const email = DOM.val('signup-email');
  const pass  = DOM.val('signup-pass');
  if (!email || !pass) { DOM.toast('Completá email y contraseña', 'error'); return; }
  try {
    showLoading(true);
    const { user } = await Auth.signUp(email, pass);
    showLoading(false);
    if (user) {
      await insertDefaultData(user.id);
      DOM.toast('Cuenta creada. Revisá tu email para confirmar.', 'success');
    }
  } catch(e) {
    showLoading(false);
    DOM.toast(e.message || 'Error al registrarse', 'error');
  }
};

window.doLogout = async function() {
  if (!confirm('¿Cerrar sesión?')) return;
  State.reset();
  localStorage.removeItem('o23_v2');
  await Auth.signOut();
};

// ── Nav ─────────────────────────────────────
window.goTo = goTo;

// Suscribir cambios de tema
State.subscribe(['theme'], ({ theme }) => {
  document.body.classList.toggle('light', theme === 'light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
});

window.toggleTheme = function() {
  const newTheme = State.get('theme') === 'light' ? 'dark' : 'light';
  State.setState({ theme: newTheme });
  localStorage.setItem('o23_theme', newTheme);
};

// Restaurar tema guardado
const savedTheme = localStorage.getItem('o23_theme') || 'dark';
State.setState({ theme: savedTheme });

// ── Start ────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
