// ═══════════════════════════════════════
// ERROR-HANDLER.JS — Sistema global de errores
// Captura Supabase, red, validación e inesperados.
// ═══════════════════════════════════════
import State from '../services/state.js';

// ── Tipos de error ────────────────────────
export const ErrorType = {
  NETWORK:     'network',
  SUPABASE:    'supabase',
  VALIDATION:  'validation',
  AUTH:        'auth',
  UNEXPECTED:  'unexpected',
};

// ── Severidades ───────────────────────────
export const Severity = {
  INFO:    'info',
  WARNING: 'warning',
  ERROR:   'error',
  FATAL:   'fatal',
};

// ── Log interno (últimos 50 errores) ──────
const errorLog = [];

// ═══════════════════════════════════════
// CLASE PRINCIPAL
// ═══════════════════════════════════════
class ErrorHandler {
  constructor() {
    this._listeners = [];
    this._setupGlobalHandlers();
  }

  // ── Capturar error ────────────────────
  capture(error, context = {}) {
    const entry = this._normalize(error, context);
    errorLog.unshift(entry);
    if (errorLog.length > 50) errorLog.pop();

    console.error(`[ORIGEN23 ${entry.type.toUpperCase()}]`, entry.message, entry.raw || '');

    // Notificar al UI
    this._dispatch(entry);

    // Actualizar estado de notificaciones
    const notifications = [...(State.get('notifications') || [])];
    if (entry.severity !== Severity.INFO) {
      notifications.unshift({ id: Date.now(), ...entry });
      State.setState({ notifications: notifications.slice(0, 20) });
    }

    return entry;
  }

  // ── Wrapper para promesas async ───────
  async wrap(fn, context = {}) {
    try {
      return await fn();
    } catch (err) {
      this.capture(err, context);
      return null;
    }
  }

  // ── Wrapper con retry ─────────────────
  async retry(fn, maxAttempts = 3, context = {}) {
    let lastErr;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (i < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
    this.capture(lastErr, { ...context, attempts: maxAttempts });
    return null;
  }

  // ── Obtener log ───────────────────────
  getLog() { return [...errorLog]; }
  clearLog() { errorLog.length = 0; }

  // ── Suscribirse a errores ─────────────
  onError(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  // ── Privados ──────────────────────────
  _normalize(error, context) {
    const base = {
      timestamp: new Date().toISOString(),
      context,
      raw: error,
    };

    // Supabase error
    if (error?.code && error?.message) {
      return {
        ...base,
        type: ErrorType.SUPABASE,
        severity: this._supabaseSeverity(error.code),
        message: this._supabaseMessage(error),
        code: error.code,
      };
    }

    // Network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        ...base,
        type: ErrorType.NETWORK,
        severity: Severity.ERROR,
        message: 'Sin conexión a internet. Los cambios se guardarán al reconectar.',
      };
    }

    // Auth error
    if (error?.message?.toLowerCase().includes('auth') ||
        error?.message?.toLowerCase().includes('jwt') ||
        error?.message?.toLowerCase().includes('unauthorized')) {
      return {
        ...base,
        type: ErrorType.AUTH,
        severity: Severity.WARNING,
        message: 'Tu sesión expiró. Por favor volvé a iniciar sesión.',
      };
    }

    // Validation error (thrown as string or with .validation flag)
    if (typeof error === 'string' || error?.validation) {
      return {
        ...base,
        type: ErrorType.VALIDATION,
        severity: Severity.WARNING,
        message: typeof error === 'string' ? error : error.message,
      };
    }

    // Unexpected
    return {
      ...base,
      type: ErrorType.UNEXPECTED,
      severity: Severity.ERROR,
      message: error?.message || 'Ocurrió un error inesperado. Intentá de nuevo.',
    };
  }

  _supabaseSeverity(code) {
    const fatal = ['42501', 'PGRST116', '23503'];
    const warn  = ['23505', 'PGRST301'];
    if (fatal.includes(String(code))) return Severity.ERROR;
    if (warn.includes(String(code)))  return Severity.WARNING;
    return Severity.ERROR;
  }

  _supabaseMessage(error) {
    const messages = {
      '23505':    'Ya existe un registro con estos datos.',
      '23503':    'No se puede eliminar: hay datos relacionados.',
      '42501':    'No tenés permiso para realizar esta acción.',
      'PGRST116': 'No se encontraron datos.',
      'PGRST301': 'Sesión expirada. Por favor ingresá de nuevo.',
    };
    return messages[error.code] || error.message || 'Error de base de datos.';
  }

  _dispatch(entry) {
    this._listeners.forEach(fn => {
      try { fn(entry); } catch {}
    });
    // Mostrar en UI automáticamente
    showErrorUI(entry);
  }

  _setupGlobalHandlers() {
    // Errores JS no capturados
    window.addEventListener('error', (e) => {
      if (e.error) this.capture(e.error, { source: 'global', file: e.filename, line: e.lineno });
    });

    // Promesas rechazadas no capturadas
    window.addEventListener('unhandledrejection', (e) => {
      this.capture(e.reason, { source: 'unhandledRejection' });
      e.preventDefault();
    });

    // Detectar cuando vuelve la conexión
    window.addEventListener('online',  () => showNetworkStatus(true));
    window.addEventListener('offline', () => showNetworkStatus(false));
  }
}

// ═══════════════════════════════════════
// UI DE ERRORES
// ═══════════════════════════════════════
function showErrorUI(entry) {
  const { severity, message, type } = entry;

  // Fatal → modal bloqueante
  if (severity === Severity.FATAL) {
    showFatalModal(message);
    return;
  }

  // Auth → modal especial
  if (type === ErrorType.AUTH) {
    showAuthExpiredModal();
    return;
  }

  // Resto → toast
  showToast(message, severity);
}

function showToast(msg, severity = Severity.ERROR) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const icons = { info: 'ℹ️', warning: '⚠️', error: '❌', fatal: '🚨' };
  toast.textContent = `${icons[severity] || '❌'} ${msg}`;
  toast.className = `toast-show toast-${severity}`;

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = 'toast-hide';
    setTimeout(() => { toast.className = ''; }, 300);
  }, severity === Severity.ERROR ? 4000 : 2500);
}

function showFatalModal(msg) {
  const modal = document.getElementById('modal-fatal-error');
  if (!modal) { alert(msg); return; }
  const msgEl = modal.querySelector('.fatal-error-msg');
  if (msgEl) msgEl.textContent = msg;
  modal.classList.add('open');
}

function showAuthExpiredModal() {
  const modal = document.getElementById('modal-auth-expired');
  if (modal) modal.classList.add('open');
}

function showNetworkStatus(online) {
  const banner = document.getElementById('network-banner');
  if (!banner) return;
  banner.textContent = online ? '✓ Conexión restaurada' : '📡 Sin conexión — trabajando en modo offline';
  banner.className   = online ? 'network-banner online' : 'network-banner offline';
  banner.style.display = '';
  if (online) setTimeout(() => { banner.style.display = 'none'; }, 3000);
}

// ═══════════════════════════════════════
// SINGLETON + EXPORT
// ═══════════════════════════════════════
export const Err = new ErrorHandler();

// Shorthand para uso frecuente
export const captureError = (e, ctx) => Err.capture(e, ctx);
export const wrapAsync    = (fn, ctx) => Err.wrap(fn, ctx);
export { showToast };
