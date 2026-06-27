// ═══════════════════════════════════════
// FORMATTERS.JS — Formateo centralizado
// ═══════════════════════════════════════

export const Fmt = {

  // ── Números ──────────────────────────
  currency(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '$0';
    const abs = Math.abs(n);
    const formatted = abs >= 1_000_000
      ? (abs / 1_000_000).toFixed(1) + 'M'
      : abs >= 1_000
      ? (abs / 1_000).toFixed(1) + 'k'
      : abs.toLocaleString('es', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
  },

  currencyFull(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '$0';
    const abs = Math.abs(Number(n));
    const str = abs.toLocaleString('es', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return n < 0 ? `-$${str}` : `$${str}`;
  },

  pct(n, decimals = 0) {
    if (n === null || n === undefined || isNaN(n)) return '0%';
    return (n * 100).toFixed(decimals) + '%';
  },

  pctInt(n) {
    return Math.round((n || 0) * 100) + '%';
  },

  number(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toFixed(decimals);
  },

  // ── Fechas ──────────────────────────
  monthKey(date = new Date()) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  todayISO() {
    return new Date().toISOString().split('T')[0];
  },

  displayDate(isoStr) {
    if (!isoStr) return 'Sin fecha';
    const d = new Date(isoStr + 'T00:00:00');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
  },

  shortDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr + 'T00:00:00');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
  },

  daysAgo(isoStr) {
    if (!isoStr) return null;
    const diff = new Date() - new Date(isoStr + 'T00:00:00');
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  },

  daysRemaining(isoStr) {
    if (!isoStr) return null;
    const diff = new Date(isoStr + 'T00:00:00') - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },

  relativeTime(isoStr) {
    const days = this.daysAgo(isoStr);
    if (days === null) return '';
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    if (days < 30) return `Hace ${Math.floor(days / 7)} semanas`;
    return this.displayDate(isoStr);
  },

  // ── Strings ──────────────────────────
  initials(name = '') {
    return name.trim().charAt(0).toUpperCase() || '?';
  },

  slug(str) {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  },

  // ── Trading específico ──────────────
  pnlColored(pnl) {
    const n = parseFloat(pnl) || 0;
    const color = n >= 0 ? 'var(--green)' : 'var(--red)';
    const sign = n >= 0 ? '+' : '';
    return { text: `${sign}$${Math.abs(n).toFixed(2)}`, color };
  },

  rrLabel(rr) {
    const n = parseFloat(rr) || 0;
    return n > 0 ? `${n.toFixed(1)}:1` : '—';
  },

  // ── DOM seguro (reemplaza innerHTML con texto) ──
  // Devuelve un nodo de texto escapado — nunca use esto con HTML.
  safeText(str) {
    return document.createTextNode(String(str || ''));
  },

  // Escapa HTML para usar en template literals cuando sea inevitable
  escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};
