// ═══════════════════════════════════════
// VALIDATORS.JS — Validación centralizada
// Todos los formularios pasan por acá.
// ═══════════════════════════════════════

export const Validators = {

  // ── Primitivos ──────────────────────────
  required(value, label = 'Campo') {
    if (value === null || value === undefined || String(value).trim() === '') {
      return `${label} es requerido`;
    }
    return null;
  },

  number(value, label = 'Valor') {
    const n = parseFloat(value);
    if (isNaN(n)) return `${label} debe ser un número`;
    return null;
  },

  positiveNumber(value, label = 'Valor') {
    const base = this.number(value, label);
    if (base) return base;
    if (parseFloat(value) <= 0) return `${label} debe ser mayor a 0`;
    return null;
  },

  nonNegativeNumber(value, label = 'Valor') {
    const base = this.number(value, label);
    if (base) return base;
    if (parseFloat(value) < 0) return `${label} no puede ser negativo`;
    return null;
  },

  range(value, min, max, label = 'Valor') {
    const n = parseFloat(value);
    if (isNaN(n)) return `${label} debe ser un número`;
    if (n < min || n > max) return `${label} debe estar entre ${min} y ${max}`;
    return null;
  },

  maxLength(value, max, label = 'Campo') {
    if (String(value).length > max) return `${label} no puede superar ${max} caracteres`;
    return null;
  },

  date(value, label = 'Fecha') {
    if (!value) return `${label} es requerida`;
    const d = new Date(value);
    if (isNaN(d.getTime())) return `${label} no es válida`;
    return null;
  },

  // ── Específicos por módulo ──────────────

  trade({ pnl, rr, riesgo, result, date }) {
    const errors = {};
    const req = this.required(result, 'Resultado');
    if (req) errors.result = req;

    const pnlErr = this.number(pnl, 'P&L');
    if (pnlErr) errors.pnl = pnlErr;

    if (rr !== '' && rr !== null && rr !== undefined) {
      const rrErr = this.positiveNumber(rr, 'Risk/Reward');
      if (rrErr) errors.rr = rrErr;
      const rrRange = this.range(rr, 0.1, 50, 'Risk/Reward');
      if (rrRange) errors.rr = rrRange;
    }

    if (riesgo !== '' && riesgo !== null && riesgo !== undefined) {
      const riesgoErr = this.range(riesgo, 0.01, 10, 'Riesgo %');
      if (riesgoErr) errors.riesgo = riesgoErr;
    }

    if (date) {
      const dateErr = this.date(date, 'Fecha');
      if (dateErr) errors.date = dateErr;
    }

    return errors; // {} = sin errores
  },

  movement({ tipo, desc, monto, fecha }) {
    const errors = {};
    const tipoErr = this.required(tipo, 'Tipo');
    if (tipoErr) errors.tipo = tipoErr;

    const descErr = this.required(desc, 'Descripción');
    if (descErr) errors.desc = descErr;
    else {
      const lenErr = this.maxLength(desc, 100, 'Descripción');
      if (lenErr) errors.desc = lenErr;
    }

    const montoErr = this.positiveNumber(monto, 'Monto');
    if (montoErr) errors.monto = montoErr;

    const fechaErr = this.date(fecha, 'Fecha');
    if (fechaErr) errors.fecha = fechaErr;

    return errors;
  },

  habit({ name, icon }) {
    const errors = {};
    const nameErr = this.required(name, 'Nombre');
    if (nameErr) errors.name = nameErr;
    else {
      const lenErr = this.maxLength(name, 60, 'Nombre');
      if (lenErr) errors.name = lenErr;
    }
    return errors;
  },

  meta({ name, pct }) {
    const errors = {};
    const nameErr = this.required(name, 'Objetivo');
    if (nameErr) errors.name = nameErr;

    if (pct !== '' && pct !== null && pct !== undefined) {
      const pctErr = this.range(pct, 0, 100, 'Porcentaje');
      if (pctErr) errors.pct = pctErr;
    }
    return errors;
  },

  finCategory({ name, budget }) {
    const errors = {};
    const nameErr = this.required(name, 'Nombre');
    if (nameErr) errors.name = nameErr;

    const budgetErr = this.nonNegativeNumber(budget, 'Presupuesto');
    if (budgetErr) errors.budget = budgetErr;

    return errors;
  },

  finGoal({ name, target, saved }) {
    const errors = {};
    const nameErr = this.required(name, 'Nombre');
    if (nameErr) errors.name = nameErr;

    const targetErr = this.positiveNumber(target, 'Monto objetivo');
    if (targetErr) errors.target = targetErr;

    if (saved !== '' && saved !== null && saved !== undefined) {
      const savedErr = this.nonNegativeNumber(saved, 'Monto actual');
      if (savedErr) errors.saved = savedErr;
    }

    return errors;
  },

  metric({ peso, energia, agua, sueno }) {
    const errors = {};
    if (peso) {
      const e = this.range(peso, 20, 300, 'Peso');
      if (e) errors.peso = e;
    }
    if (energia) {
      const e = this.range(energia, 1, 10, 'Energía');
      if (e) errors.energia = e;
    }
    if (agua) {
      const e = this.range(agua, 0.1, 20, 'Agua');
      if (e) errors.agua = e;
    }
    if (sueno) {
      const e = this.range(sueno, 1, 24, 'Sueño');
      if (e) errors.sueno = e;
    }
    return errors;
  },

  // ── Helper: mostrar errores en el DOM ──
  // Limpia errores anteriores y muestra los nuevos
  displayErrors(formEl, errors) {
    // Limpiar errores previos
    formEl.querySelectorAll('.field-error').forEach(el => el.remove());
    formEl.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    Object.entries(errors).forEach(([field, msg]) => {
      const input = formEl.querySelector(`#${field}, [name="${field}"]`);
      if (input) {
        input.classList.add('input-error');
        const errEl = document.createElement('div');
        errEl.className = 'field-error';
        errEl.textContent = msg;
        input.parentNode.insertBefore(errEl, input.nextSibling);
      }
    });

    return Object.keys(errors).length === 0;
  },

  hasErrors(errors) {
    return Object.keys(errors).length > 0;
  }
};
