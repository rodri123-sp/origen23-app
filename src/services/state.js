// ═══════════════════════════════════════
// STATE.JS — Sistema de estado centralizado
// Único punto de verdad para toda la app.
// Inspirado en Redux pero sin dependencias.
// ═══════════════════════════════════════

const INITIAL_STATE = {
  // Auth
  user: null,           // Supabase user object
  profile: null,        // { id, name, color, email }

  // Data modules
  habits:     [],
  habitLogs:  {},       // { "uid:monthKey:habitId:day": true }
  trades:     [],
  tradeErrors:{},       // { uid: { errorType: count } }
  metas:      [],
  finCats:    [],
  finGoals:   [],
  ingresos:   {},       // { "uid_monthKey": amount }
  diario:     [],
  notas:      [],
  metrics:    [],
  finData:    {},       // { uid: { movimientos, activos, pasivos, ... } }
  plan:       {},       // { "uid:dia:slot": taskData }
  goals:        [],       // [{ id, userId, tipo, name, desc, icon, meta, fechaLimite, pct, status, autoCalc, ... }]
  scoreHistory: [],

  // UI state
  theme:        'dark',
  currentPage:  'dashboard',
  notifications: [],

  // Loading
  loading:   false,
  lastSync:  null,
};

class AppState {
  constructor() {
    this._state = { ...INITIAL_STATE };
    this._subscribers = {};
    this._nextSubId = 1;
  }

  // Leer estado completo o una slice
  get(key) {
    if (key === undefined) return { ...this._state };
    return this._state[key];
  }

  // Actualizar estado y notificar suscriptores
  setState(updates) {
    const prev = { ...this._state };
    this._state = { ...this._state, ...updates };
    this._notify(prev, updates);
  }

  // Actualizar un campo anidado profundamente (por ej: finData[uid])
  setNested(path, value) {
    const keys = path.split('.');
    const update = {};
    let ref = update;
    keys.forEach((k, i) => {
      if (i === keys.length - 1) ref[k] = value;
      else { ref[k] = { ...this._state[k] }; ref = ref[k]; }
    });
    this.setState(update);
  }

  // Suscribirse a cambios de una o varias keys
  subscribe(keys, callback) {
    const id = this._nextSubId++;
    const keyList = Array.isArray(keys) ? keys : [keys];
    this._subscribers[id] = { keys: keyList, callback };
    return () => delete this._subscribers[id]; // unsuscribe fn
  }

  _notify(prev, updates) {
    const changedKeys = Object.keys(updates);
    Object.values(this._subscribers).forEach(({ keys, callback }) => {
      if (keys.some(k => changedKeys.includes(k))) {
        callback(this._state, prev);
      }
    });
  }

  // Resetear a estado inicial (al hacer logout)
  reset() {
    const theme = this._state.theme;
    this._state = { ...INITIAL_STATE, theme };
    this._notify({}, INITIAL_STATE);
  }

  // Persistencia en localStorage como caché
  saveCache() {
    try {
      const cacheable = {
        habits: this._state.habits,
        habitLogs: this._state.habitLogs,
        trades: this._state.trades,
        tradeErrors: this._state.tradeErrors,
        metas: this._state.metas,
        finCats: this._state.finCats,
        finGoals: this._state.finGoals,
        ingresos: this._state.ingresos,
        diario: this._state.diario,
        notas: this._state.notas,
        metrics: this._state.metrics,
        finData: this._state.finData,
        plan: this._state.plan,
        scoreHistory: this._state.scoreHistory,
        profile: this._state.profile,
        theme: this._state.theme,
      };
      localStorage.setItem('o23_v2', JSON.stringify(cacheable));
    } catch(e) { console.warn('Cache save failed:', e); }
  }

  loadCache() {
    try {
      const raw = localStorage.getItem('o23_v2');
      if (raw) {
        const cached = JSON.parse(raw);
        this._state = { ...this._state, ...cached };
      }
    } catch(e) { console.warn('Cache load failed:', e); }
  }
}

// Singleton global
const AppStateInstance = new AppState();
export default AppStateInstance;
