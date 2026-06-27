// ═══════════════════════════════════════
// DATES.JS — Utilidades de fecha
// ═══════════════════════════════════════

export const Dates = {
  now() { return new Date(); },
  today() { return this.now().getDate(); },
  currentMonth() { return this.now().getMonth(); },
  currentYear() { return this.now().getFullYear(); },

  daysInMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  },

  monthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  },

  todayISO() {
    return this.now().toISOString().split('T')[0];
  },

  weekdayIndex() {
    // Lunes=0 ... Domingo=6
    return (this.now().getDay() + 6) % 7;
  },

  daysAgo(n) {
    const d = this.now();
    d.setDate(d.getDate() - n);
    return d;
  },

  isoToDate(isoStr) {
    if (!isoStr) return null;
    return new Date(isoStr + 'T00:00:00');
  },

  diffDays(isoA, isoB) {
    const a = this.isoToDate(isoA);
    const b = this.isoToDate(isoB);
    if (!a || !b) return null;
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  },
};
