// ═══════════════════════════════════════
// DOM.JS — Creación segura de elementos
// Nunca usa innerHTML con datos de usuario.
// Reemplaza el patrón de template literals con datos sin sanitizar.
// ═══════════════════════════════════════

export const DOM = {

  // ── Crear elemento con opciones ─────────
  el(tag, opts = {}) {
    const el = document.createElement(tag);
    if (opts.class)      el.className = opts.class;
    if (opts.id)         el.id = opts.id;
    if (opts.text)       el.textContent = opts.text;
    if (opts.style)      Object.assign(el.style, opts.style);
    if (opts.onclick)    el.addEventListener('click', opts.onclick);
    if (opts.attrs) {
      Object.entries(opts.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    }
    if (opts.children) {
      opts.children.forEach(child => el.appendChild(
        typeof child === 'string' ? document.createTextNode(child) : child
      ));
    }
    return el;
  },

  // ── Vaciar un contenedor ─────────────────
  clear(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
    return container;
  },

  // ── Reemplazar contenido de forma segura ─
  // Acepta un array de nodos o un nodo único.
  render(container, ...nodes) {
    this.clear(container);
    nodes.flat().forEach(node => {
      if (node !== null && node !== undefined) {
        container.appendChild(
          typeof node === 'string' ? document.createTextNode(node) : node
        );
      }
    });
    return container;
  },

  // ── Helpers de conveniencia ──────────────
  div(opts = {})    { return this.el('div',    opts); },
  span(opts = {})   { return this.el('span',   opts); },
  p(opts = {})      { return this.el('p',      opts); },
  h3(opts = {})     { return this.el('h3',     opts); },
  button(opts = {}) { return this.el('button', opts); },
  input(opts = {})  { return this.el('input',  opts); },

  // ── Toast notification ──────────────────
  toast(msg, type = 'default') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast-show toast-${type}`;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = '', 2500);
  },

  // ── Modal helpers ──────────────────────
  openModal(id)  { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); },

  // ── Valor seguro de input ───────────────
  val(id)        { return document.getElementById(id)?.value?.trim() || ''; },
  numVal(id)     { return parseFloat(document.getElementById(id)?.value) || 0; },
  checkVal(id)   { return document.getElementById(id)?.checked || false; },
  setVal(id, v)  { const el = document.getElementById(id); if (el) el.value = v; },
  clearVal(...ids) { ids.forEach(id => this.setVal(id, '')); },

  // ── Mostrar/ocultar ────────────────────
  show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; },
  hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; },
  toggle(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  },

  // ── Tarjeta KPI genérica ────────────────
  kpiBox({ value, label, color = 'var(--t2)', subtext = '' }) {
    return this.div({
      class: 'kpi-box',
      children: [
        this.div({ class: 'kpi-box-val mono', style: { color }, text: value }),
        this.div({ class: 'kpi-box-lbl', text: label }),
        subtext ? this.div({ class: 'kpi-box-sub', text: subtext }) : null,
      ].filter(Boolean),
    });
  },

  // ── Progress bar ───────────────────────
  progressBar({ pct, color, height = '5px' }) {
    const track = this.div({ class: 'prog-track', style: { height } });
    const fill  = this.div({
      class: 'prog-fill',
      style: { width: `${Math.min(100, Math.max(0, pct * 100))}%`, height, background: color },
    });
    track.appendChild(fill);
    return track;
  },

  // ── Badge de estado ────────────────────
  statusBadge(text, color) {
    return this.span({ class: 'status-badge', text, style: { color } });
  },

  // ── Error de campo de formulario ────────
  fieldError(msg) {
    return this.div({ class: 'field-error', text: msg });
  },

  // ── Empty state ─────────────────────────
  emptyState({ icon, title, subtitle, action }) {
    const container = this.div({ class: 'empty-state' });
    container.appendChild(this.div({ class: 'empty-icon', text: icon }));
    container.appendChild(this.div({ class: 'empty-title', text: title }));
    if (subtitle) container.appendChild(this.div({ class: 'empty-subtitle', text: subtitle }));
    if (action) {
      const btn = this.button({ class: 'btn btn-ghost btn-sm', text: action.label, onclick: action.fn });
      container.appendChild(btn);
    }
    return container;
  },

  // ── Sección con título ──────────────────
  section({ title, children = [], action }) {
    const wrap = this.div({ class: 'sec-header' });
    const row  = this.div({ style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } });
    row.appendChild(this.div({ class: 'sec-title', text: title }));
    if (action) {
      row.appendChild(this.button({ class: 'btn btn-ghost btn-sm', text: action.label, onclick: action.fn }));
    }
    wrap.appendChild(row);
    const container = this.div({});
    wrap.appendChild(container);
    children.forEach(c => container.appendChild(c));
    return wrap;
  },
};
