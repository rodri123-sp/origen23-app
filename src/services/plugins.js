// ═══════════════════════════════════════
// PLUGINS.JS — Sistema de plugins para integraciones futuras
// IA, Recordatorios, Calendario, Exportación, Móvil
// ═══════════════════════════════════════
import State from '../services/state.js';
import { Err } from './error-handler.js';

// ── Registro de plugins ───────────────────
const _registry = new Map();
const _active   = new Set();
const _hooks    = {};     // { 'hook:name': [fn, fn, ...] }

// ═══════════════════════════════════════
// PLUGIN MANAGER
// ═══════════════════════════════════════
export const PluginManager = {

  // Registrar un plugin
  register(plugin) {
    if (!plugin.id || !plugin.name) throw new Error('Plugin requires id and name');
    _registry.set(plugin.id, plugin);
    console.log(`[Plugin] Registered: ${plugin.name} v${plugin.version || '1.0'}`);
  },

  // Activar plugin
  async activate(id) {
    const plugin = _registry.get(id);
    if (!plugin) throw new Error(`Plugin ${id} not found`);
    if (_active.has(id)) return;

    try {
      if (plugin.onActivate) await plugin.onActivate();
      _active.add(id);

      // Registrar hooks del plugin
      if (plugin.hooks) {
        Object.entries(plugin.hooks).forEach(([hook, fn]) => {
          if (!_hooks[hook]) _hooks[hook] = [];
          _hooks[hook].push(fn);
        });
      }
      console.log(`[Plugin] Activated: ${plugin.name}`);
    } catch (err) {
      Err.capture(err, { context: `Plugin activation: ${id}` });
    }
  },

  // Desactivar plugin
  async deactivate(id) {
    const plugin = _registry.get(id);
    if (!plugin || !_active.has(id)) return;
    if (plugin.onDeactivate) await plugin.onDeactivate();
    _active.delete(id);

    // Quitar hooks
    if (plugin.hooks) {
      Object.entries(plugin.hooks).forEach(([hook, fn]) => {
        if (_hooks[hook]) _hooks[hook] = _hooks[hook].filter(f => f !== fn);
      });
    }
  },

  // Ejecutar un hook (todos los plugins que lo registraron)
  async runHook(hookName, payload = {}) {
    const fns = _hooks[hookName] || [];
    const results = [];
    for (const fn of fns) {
      try { results.push(await fn(payload)); } catch (err) { Err.capture(err, { hook: hookName }); }
    }
    return results;
  },

  isActive:    (id) => _active.has(id),
  getPlugin:   (id) => _registry.get(id),
  listActive:  ()   => [..._active].map(id => _registry.get(id)),
  listAll:     ()   => [..._registry.values()],
};

// ═══════════════════════════════════════
// HOOKS DISPONIBLES
// Los módulos llaman estos hooks en momentos clave.
// ═══════════════════════════════════════
export const Hooks = {
  TRADE_ADDED:       'trade:added',
  HABIT_TOGGLED:     'habit:toggled',
  GOAL_COMPLETED:    'goal:completed',
  SCORE_UPDATED:     'score:updated',
  DATA_SYNCED:       'data:synced',
  PAGE_CHANGED:      'page:changed',
  EXPORT_REQUESTED:  'export:requested',
  NOTIFICATION_DUE:  'notification:due',
};

// ═══════════════════════════════════════
// PLUGIN: EXPORTACIÓN PDF/EXCEL
// ═══════════════════════════════════════
export const ExportPlugin = {
  id: 'export',
  name: 'Exportación',
  version: '1.0',

  hooks: {
    [Hooks.EXPORT_REQUESTED]: async ({ format, module }) => {
      if (format === 'csv') await ExportPlugin.exportCSV(module);
      if (format === 'json') await ExportPlugin.exportJSON(module);
    },
  },

  async exportCSV(module) {
    const uid  = State.get('user')?.id;
    let rows   = [];
    let filename = 'origen23-export';

    if (module === 'trades') {
      const trades = (State.get('trades') || []).filter(t => t.userId === uid);
      rows = trades.map(t => ({
        Fecha: t.date, Resultado: t.result, PnL: t.pnl,
        RR: t.rr || '', Riesgo: t.riesgo || '', Setup: t.setup || '',
        Horario: t.hour || '', Notas: t.notes || '',
        ErrorEmocional: t.errorEmocional ? 'Sí' : 'No',
        ErrorTecnico: t.errorTecnico ? 'Sí' : 'No',
      }));
      filename = 'trades';
    } else if (module === 'habits') {
      const habits = State.get('habits') || [];
      const logs   = State.get('habitLogs') || {};
      rows = habits.map(h => {
        const row = { Hábito: h.name, Ícono: h.icon, Sección: h.section };
        for (let d = 1; d <= 31; d++) {
          row[`Día ${d}`] = logs[`${uid}:${State.get('monthKey')}:${h.id}:${d}`] ? '✓' : '';
        }
        return row;
      });
      filename = 'habitos';
    } else if (module === 'movimientos') {
      const fd = (State.get('finData') || {})[uid] || {};
      rows = (fd.movimientos || []).map(m => ({
        Fecha: m.fecha, Tipo: m.tipo, Descripción: m.desc, Monto: m.monto,
      }));
      filename = 'movimientos';
    } else if (module === 'goals') {
      const goals = (State.get('goals') || []).filter(g => g.userId === uid);
      rows = goals.map(g => ({
        Nombre: g.name, Tipo: g.tipo, Progreso: g.pct + '%',
        FechaLímite: g.fechaLimite || '', Estado: g.status,
      }));
      filename = 'objetivos';
    }

    if (!rows.length) { window.toast?.('Sin datos para exportar', 'warning'); return; }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `origen23-${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.toast?.(`Exportado como ${filename}.csv ✓`);
  },

  async exportJSON(module) {
    const uid = State.get('user')?.id;
    const data = {
      exportedAt: new Date().toISOString(),
      module,
      trades:     module === 'all' || module === 'trades'     ? (State.get('trades') || []).filter(t => t.userId === uid) : undefined,
      habits:     module === 'all' || module === 'habits'     ? State.get('habits')   : undefined,
      goals:      module === 'all' || module === 'goals'      ? (State.get('goals') || []).filter(g => g.userId === uid) : undefined,
      finData:    module === 'all' || module === 'finance'    ? (State.get('finData') || {})[uid] : undefined,
    };
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `origen23-${module}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.toast?.('Exportado como JSON ✓');
  },
};

// ═══════════════════════════════════════
// PLUGIN: RECORDATORIOS / NOTIFICACIONES
// ═══════════════════════════════════════
export const ReminderPlugin = {
  id: 'reminders',
  name: 'Recordatorios',
  version: '1.0',
  _timers: [],

  hooks: {
    [Hooks.DATA_SYNCED]: async () => ReminderPlugin.scheduleAll(),
  },

  async onActivate() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    this.scheduleAll();
  },

  onDeactivate() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
  },

  scheduleAll() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];

    const reminders = this.getReminders();
    reminders.forEach(r => {
      const delay = r.time - Date.now();
      if (delay > 0 && delay < 86400000) { // solo si es hoy
        const timer = setTimeout(() => this.fire(r), delay);
        this._timers.push(timer);
      }
    });
  },

  getReminders() {
    const now   = new Date();
    const goals = (State.get('goals') || []).filter(g => {
      if (!g.fechaLimite) return false;
      const diff = (new Date(g.fechaLimite) - now) / 86400000;
      return diff >= 0 && diff <= 3; // vence en 3 días
    });

    return [
      // Hábitos de la mañana — 7 AM
      { id: 'morning', type: 'habit', title: '🌅 Buenos días', body: 'Hora de completar tus hábitos matutinos', time: this._todayAt(7, 0) },
      // Hábitos nocturnos — 9 PM
      { id: 'evening', type: 'habit', title: '🌙 Cierre del día', body: 'Completá tus hábitos nocturnos y el diario', time: this._todayAt(21, 0) },
      // Metas por vencer
      ...goals.map(g => ({
        id: 'goal-' + g.id, type: 'goal',
        title: '⏰ Meta próxima a vencer',
        body: `"${g.name}" vence pronto — progreso actual: ${g.pct || 0}%`,
        time: this._todayAt(10, 0),
      })),
    ].filter(r => r.time > Date.now());
  },

  fire(reminder) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(reminder.title, {
        body: reminder.body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: reminder.id,
      });
    }
    PluginManager.runHook(Hooks.NOTIFICATION_DUE, reminder);
  },

  _todayAt(h, m) {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
  },
};

// ═══════════════════════════════════════
// PLUGIN: SINCRONIZACIÓN AVANZADA
// Reintentos, conflictos, offline queue
// ═══════════════════════════════════════
export const SyncPlugin = {
  id: 'sync',
  name: 'Sincronización avanzada',
  version: '1.0',
  _queue: [],
  _syncing: false,

  hooks: {
    [Hooks.DATA_SYNCED]: async () => SyncPlugin.flushQueue(),
  },

  onActivate() {
    window.addEventListener('online', () => this.flushQueue());
    // Cargar cola persistida
    try {
      const saved = localStorage.getItem('o23_sync_queue');
      if (saved) this._queue = JSON.parse(saved);
    } catch {}
  },

  enqueue(operation) {
    this._queue.push({ ...operation, queuedAt: Date.now() });
    this._persistQueue();
    if (navigator.onLine) this.flushQueue();
  },

  async flushQueue() {
    if (this._syncing || !this._queue.length || !navigator.onLine) return;
    this._syncing = true;

    while (this._queue.length > 0) {
      const op = this._queue[0];
      try {
        if (op.fn) await op.fn();
        this._queue.shift();
        this._persistQueue();
      } catch (err) {
        Err.capture(err, { context: 'SyncPlugin.flushQueue', op });
        break; // detener en caso de error para no perder datos
      }
    }

    this._syncing = false;
    if (!this._queue.length) window.toast?.('✓ Sincronización completa');
  },

  _persistQueue() {
    try {
      localStorage.setItem('o23_sync_queue', JSON.stringify(
        this._queue.slice(0, 50).map(op => ({ ...op, fn: undefined }))
      ));
    } catch {}
  },

  getPendingCount() { return this._queue.length; },
};

// ═══════════════════════════════════════
// PLUGIN: IA COACH (base para integración futura)
// ═══════════════════════════════════════
export const AICoachPlugin = {
  id: 'ai-coach',
  name: 'IA Coach',
  version: '1.0-beta',

  hooks: {
    [Hooks.SCORE_UPDATED]: async ({ score, breakdown }) => {
      if (score < 50) AICoachPlugin.suggestAction(breakdown);
    },
  },

  // Sugerencias basadas en estado actual (sin llamada externa todavía)
  suggestAction(breakdown) {
    const sorted = Object.entries(breakdown).sort((a, b) => a[1] - b[1]);
    const [worstKey, worstVal] = sorted[0];

    const tips = {
      salud:         ['Dormí 8h esta noche', 'Tomá 2L de agua hoy', 'Hacé 10 min de meditación'],
      productividad: ['Completá 3 hábitos antes del mediodía', 'Bloqueá 1h de trabajo profundo', 'Revisá tus metas de la semana'],
      finanzas:      ['Revisá en qué categoría gastaste más', 'Calculá tu tasa de ahorro actual', 'Actualizá tu patrimonio neto'],
      trading:       ['Revisá tu último trade perdedor', 'Estudiá el mercado 30 min', 'Completá el checklist pre-operación'],
    };

    const tip = tips[worstKey]?.[Math.floor(Math.random() * 3)] || 'Mantené la constancia';
    window.toast?.(`💡 IA Coach: ${tip}`);
  },

  // Interfaz para futura integración con LLM
  async generateInsight(prompt) {
    // Placeholder: cuando se agregue API key de IA
    // const res = await fetch('/api/ai-coach', { method: 'POST', body: JSON.stringify({ prompt }) });
    // return res.json();
    return { text: 'Integración IA próximamente disponible.', type: 'placeholder' };
  },
};

// ═══════════════════════════════════════
// REGISTRO INICIAL DE PLUGINS
// ═══════════════════════════════════════
export function initPlugins(options = {}) {
  PluginManager.register(ExportPlugin);
  PluginManager.register(ReminderPlugin);
  PluginManager.register(SyncPlugin);
  PluginManager.register(AICoachPlugin);

  // Activar según configuración
  if (options.export    !== false) PluginManager.activate('export');
  if (options.sync      !== false) PluginManager.activate('sync');
  if (options.reminders)           PluginManager.activate('reminders');
  if (options.aiCoach)             PluginManager.activate('ai-coach');
}

// Exponer funciones de exportación al scope global
window.exportData = (format, module) =>
  PluginManager.runHook(Hooks.EXPORT_REQUESTED, { format, module });
