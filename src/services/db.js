// ═══════════════════════════════════════
// SUPABASE.JS — Capa de base de datos
// Toda operación de red pasa por acá.
// Nunca llames a `supa` desde otro módulo.
// ═══════════════════════════════════════
import State from '../services/state.js';
import { Dates } from '../utils/dates.js';

const SUPA_URL = 'https://xclmfnfwagrjozsmfrxc.supabase.co';
const SUPA_KEY = 'sb_publishable_DOc0_cegIMxnA-hW0hjyqQ_R_dPEGie';

// ⚠️  ROTAR ESTA KEY — fue expuesta accidentalmente.
// Generá una nueva en Supabase Dashboard → Settings → API
const _supa = supabase.createClient(SUPA_URL, SUPA_KEY);

// ── Auth ────────────────────────────────
export const Auth = {
  onAuthStateChange(cb) { return _supa.auth.onAuthStateChange(cb); },
  getSession() { return _supa.auth.getSession(); },
  async signIn(email, password) {
    const { data, error } = await _supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signUp(email, password) {
    const { data, error } = await _supa.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },
  async signOut() { return _supa.auth.signOut(); },
};

// ── Utilidad ────────────────────────────
function uid() { return '_' + Math.random().toString(36).slice(2, 9); }

// ── Carga completa desde Supabase ───────
export async function loadAllData(userId) {
  const uid = userId;
  const [
    { data: profile },
    { data: habits },
    { data: habitLogs },
    { data: trades },
    { data: tradeErrors },
    { data: metas },
    { data: finCats },
    { data: finGoals },
    { data: movimientos },
    { data: patrimonio },
    { data: ingresos },
    { data: diario },
    { data: notas },
    { data: metrics },
    { data: planTasks },
    { data: goals },
    { data: scoreHistory },
  ] = await Promise.all([
    _supa.from('profiles').select('*').eq('id', uid).single(),
    _supa.from('habits').select('*').eq('user_id', uid),
    _supa.from('habit_logs').select('*').eq('user_id', uid),
    _supa.from('trades').select('*').eq('user_id', uid).order('date', { ascending: true }),
    _supa.from('trade_errors').select('*').eq('user_id', uid),
    _supa.from('metas').select('*').eq('user_id', uid),
    _supa.from('fin_cats').select('*').eq('user_id', uid),
    _supa.from('fin_goals').select('*').eq('user_id', uid),
    _supa.from('movimientos').select('*').eq('user_id', uid).order('fecha', { ascending: false }),
    _supa.from('fin_patrimonio').select('*').eq('user_id', uid).single(),
    _supa.from('ingresos').select('*').eq('user_id', uid),
    _supa.from('diario').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    _supa.from('notas').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    _supa.from('metrics').select('*').eq('user_id', uid).order('date', { ascending: false }),
    _supa.from('plan_tasks').select('*').eq('user_id', uid),
    _supa.from('goals').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    _supa.from('score_history').select('*').eq('user_id', uid).order('date', { ascending: false }).limit(200),
  ]);

  // Mapear y normalizar datos
  const habitLogs_ = {};
  (habitLogs || []).forEach(l => {
    habitLogs_[`${uid}:${l.month_key}:${l.habit_id}:${l.day}`] = true;
  });

  const tradeErrors_ = { [uid]: {} };
  (tradeErrors || []).forEach(e => { tradeErrors_[uid][e.error_type] = e.count; });

  const ingresos_ = {};
  (ingresos || []).forEach(i => { ingresos_[`${uid}_${i.month_key}`] = i.amount; });

  const plan_ = {};
  (planTasks || []).forEach(t => {
    plan_[`${uid}:${t.dia}:${t.slot}`] = {
      name: t.name, time: t.time, prio: t.prio,
      done: t.done, rescheduled: t.rescheduled, originalDay: t.original_day,
    };
  });

  const fd = {
    movimientos: (movimientos || []).map(m => ({
      id: m.id, tipo: m.tipo, catId: m.cat_id, desc: m.desc,
      monto: m.monto, fecha: m.fecha,
    })),
    activos:   patrimonio?.activos   || {},
    pasivos:   patrimonio?.pasivos   || {},
    emergencia: patrimonio?.emergencia || { gastos: 0, meses: 6, actual: 0 },
    proyeccion: patrimonio?.proyeccion || { ahorro: 0, rentabilidad: 8 },
    inversiones: patrimonio?.inversiones || [],
  };

  State.setState({
    profile:  profile || { name: 'Usuario', color: '#00E87A' },
    habits:   (habits || []).map(h => ({ id: h.id, icon: h.icon, name: h.name, color: h.color, section: h.section })),
    habitLogs: habitLogs_,
    trades:   (trades || []).map(t => ({
      id: t.id, userId: uid, result: t.result, pnl: t.pnl,
      rr: t.rr, riesgo: t.riesgo, setup: t.setup, hour: t.hour,
      notes: t.notes, date: t.date, errorEmocional: t.error_emocional,
      errorTecnico: t.error_tecnico, cumplioPlan: t.cumplio_plan,
      consecuencia: t.consecuencia,
      preChecklist: t.pre_checklist || {}, postChecklist: t.post_checklist || {},
    })),
    tradeErrors: tradeErrors_,
    metas:    (metas || []).map(m => ({ id: m.id, icon: m.icon, name: m.name, quarter: m.quarter, pct: m.pct, color: m.color, status: m.status })),
    finCats:  (finCats || []).map(f => ({ id: f.id, icon: f.icon, name: f.name, budget: f.budget, color: f.color })),
    finGoals: (finGoals || []).map(g => ({ id: g.id, name: g.name, icon: g.icon, target: g.target, saved: g.saved, fecha: g.fecha, color: g.color })),
    ingresos: ingresos_,
    diario:   (diario || []).map(d => ({ id: d.id, userId: uid, text: d.text, mood: d.mood, dateStr: d.date_str, dayNum: d.day_num })),
    notas:    (notas || []).map(n => ({ id: n.id, userId: uid, text: n.text, time: n.time })),
    metrics:  (metrics || []).map(m => ({ id: m.id, userId: uid, peso: m.peso, energia: m.energia, agua: m.agua, sueno: m.sueno, date: m.date })),
    plan:     plan_,
    finData:  { [uid]: fd },
    goals: (goals || []).map(g => ({
      id: g.id, userId: uid, tipo: g.tipo, name: g.name, desc: g.desc, icon: g.icon,
      meta: g.meta, fechaLimite: g.fecha_limite, metaValor: g.meta_valor,
      avanceValor: g.avance_valor || 0, pct: g.pct || 0, status: g.status || 'progreso',
      autoCalc: g.auto_calc || false, autoCalcType: g.auto_calc_type || null,
      autoTarget: g.auto_target || null, createdAt: g.created_at,
    })),
    scoreHistory: (scoreHistory || []).map(s => ({ userId: uid, date: s.date, score: s.score })),
    lastSync: new Date().toISOString(),
  });
}

// ── Datos default para usuarios nuevos ──
export async function insertDefaultData(userId) {
  const defaultHabits = [
    { id: 'hm1', icon: '⏰', name: 'Despertar 7:00 AM', color: '#F59E0B', section: 'matutino' },
    { id: 'hm2', icon: '🛏️', name: 'Arreglar la cama',  color: '#06B6D4', section: 'matutino' },
    { id: 'hm3', icon: '🚿', name: 'Bañarse',           color: '#4F8EF7', section: 'matutino' },
    { id: 'hm4', icon: '🥣', name: 'Desayunar',         color: '#EC4899', section: 'matutino' },
    { id: 'hm5', icon: '🧘', name: 'Meditación',        color: '#8B5CF6', section: 'matutino' },
    { id: 'hd1', icon: '🏋️', name: 'Gym',              color: '#00E87A', section: 'diario' },
    { id: 'hd2', icon: '📚', name: 'Lectura',            color: '#4F8EF7', section: 'diario' },
    { id: 'hd3', icon: '📉', name: 'Trading',            color: '#F59E0B', section: 'diario' },
    { id: 'hd4', icon: '💧', name: 'Agua',               color: '#06B6D4', section: 'diario' },
    { id: 'hd5', icon: '📖', name: 'Estudio',            color: '#8B5CF6', section: 'diario' },
    { id: 'hn1', icon: '📓', name: 'Journaling',          color: '#8B5CF6', section: 'nocturno' },
    { id: 'hn2', icon: '📵', name: 'Sin pantallas 10 PM', color: '#F59E0B', section: 'nocturno' },
    { id: 'hn3', icon: '😴', name: 'Dormir antes 11 PM',  color: '#4F8EF7', section: 'nocturno' },
  ];
  const defaultFinCats = [
    { id: 'f1', icon: '🍔', name: 'Comida',        budget: 300, color: '#EC4899' },
    { id: 'f2', icon: '⚡', name: 'Servicios',     budget: 200, color: '#F59E0B' },
    { id: 'f3', icon: '🏠', name: 'Alquiler',      budget: 500, color: '#00E87A' },
    { id: 'f4', icon: '📱', name: 'Suscripciones', budget:  80, color: '#4F8EF7' },
    { id: 'f5', icon: '🎯', name: 'Otros',         budget: 100, color: '#06B6D4' },
  ];
  const defaultMetas = [
    { id: 'm1', icon: '🏆', name: 'Trader fondeado', quarter: 'Q4', pct: 0, color: '#F59E0B', status: 'progreso' },
    { id: 'm2', icon: '📚', name: 'Leer 12 libros',  quarter: 'Q4', pct: 0, color: '#4F8EF7', status: 'progreso' },
    { id: 'm3', icon: '💰', name: 'Ahorrar $6000',   quarter: 'Q4', pct: 0, color: '#00E87A', status: 'progreso' },
  ];

  await _supa.from('habits').upsert(defaultHabits.map(h => ({ ...h, user_id: userId })));
  await _supa.from('fin_cats').upsert(defaultFinCats.map(f => ({ ...f, user_id: userId })));
  await _supa.from('metas').upsert(defaultMetas.map(m => ({ ...m, user_id: userId })));
  await _supa.from('fin_patrimonio').upsert({
    user_id: userId, activos: {}, pasivos: {},
    emergencia: { gastos: 0, meses: 6, actual: 0 },
    proyeccion: { ahorro: 0, rentabilidad: 8 }, inversiones: [],
  });
  await _supa.from('profiles').upsert({ id: userId, name: 'Usuario', color: '#00E87A' });
}

// ── DB Operations ────────────────────────
// Cada función: actualiza estado local + persiste en Supabase

export const DB = {
  // ── Hábitos ──
  async toggleHabit(hid, day) {
    const uid = State.get('user')?.id;
    const monthKey = Dates.monthKey();
    const key = `${uid}:${monthKey}:${hid}:${day}`;
    const logs = { ...State.get('habitLogs') };
    const was = !!logs[key];

    if (was) {
      delete logs[key];
      await _supa.from('habit_logs').delete()
        .eq('user_id', uid).eq('habit_id', hid).eq('month_key', monthKey).eq('day', day);
    } else {
      logs[key] = true;
      await _supa.from('habit_logs').upsert({
        id: `${uid}_${monthKey}_${hid}_${day}`,
        user_id: uid, habit_id: hid, month_key: monthKey, day,
      });
    }
    State.setState({ habitLogs: logs });
    return !was;
  },

  async addHabit(habit) {
    const uid = State.get('user')?.id;
    const habits = [...State.get('habits'), habit];
    State.setState({ habits });
    await _supa.from('habits').upsert({ ...habit, user_id: uid });
  },

  async deleteHabit(hid) {
    const uid = State.get('user')?.id;
    State.setState({ habits: State.get('habits').filter(h => h.id !== hid) });
    await _supa.from('habits').delete().eq('id', hid).eq('user_id', uid);
  },

  // ── Trading ──
  async addTrade(trade) {
    const uid = State.get('user')?.id;
    State.setState({ trades: [...State.get('trades'), trade] });
    await _supa.from('trades').upsert({
      id: trade.id, user_id: uid, result: trade.result,
      pnl: trade.pnl, rr: trade.rr, riesgo: trade.riesgo,
      setup: trade.setup, hour: trade.hour, notes: trade.notes,
      date: trade.date, error_emocional: trade.errorEmocional,
      error_tecnico: trade.errorTecnico, cumplio_plan: trade.cumplioPlan,
      consecuencia: trade.consecuencia,
      pre_checklist: trade.preChecklist, post_checklist: trade.postChecklist,
    });
  },

  async deleteTrade(tid) {
    const uid = State.get('user')?.id;
    State.setState({ trades: State.get('trades').filter(t => t.id !== tid) });
    await _supa.from('trades').delete().eq('id', tid).eq('user_id', uid);
  },

  async addTradeError(type) {
    const uid = State.get('user')?.id;
    const errs = { ...(State.get('tradeErrors') || {}) };
    if (!errs[uid]) errs[uid] = {};
    errs[uid][type] = (errs[uid][type] || 0) + 1;
    State.setState({ tradeErrors: errs });
    await _supa.from('trade_errors').upsert({
      id: `${uid}_${type}`, user_id: uid, error_type: type, count: errs[uid][type],
    });
  },

  // ── Metas ──
  async addMeta(meta) {
    const uid = State.get('user')?.id;
    State.setState({ metas: [...State.get('metas'), meta] });
    await _supa.from('metas').upsert({ ...meta, user_id: uid });
  },

  async updateMeta(mid, pct, status) {
    const uid = State.get('user')?.id;
    const metas = State.get('metas').map(m => m.id === mid ? { ...m, pct, status } : m);
    State.setState({ metas });
    await _supa.from('metas').update({ pct, status }).eq('id', mid).eq('user_id', uid);
  },

  async deleteMeta(mid) {
    const uid = State.get('user')?.id;
    State.setState({ metas: State.get('metas').filter(m => m.id !== mid) });
    await _supa.from('metas').delete().eq('id', mid).eq('user_id', uid);
  },

  // ── Finanzas — Movimientos ──
  async addMovimiento(mov) {
    const uid = State.get('user')?.id;
    const fd = { ...(State.get('finData') || {}) };
    if (!fd[uid]) fd[uid] = { movimientos: [] };
    fd[uid] = { ...fd[uid], movimientos: [mov, ...fd[uid].movimientos] };
    State.setState({ finData: fd });
    await _supa.from('movimientos').upsert({
      id: mov.id, user_id: uid, tipo: mov.tipo, cat_id: mov.catId,
      desc: mov.desc, monto: mov.monto, fecha: mov.fecha,
    });
  },

  async deleteMovimiento(mid) {
    const uid = State.get('user')?.id;
    const fd = { ...State.get('finData') };
    fd[uid] = { ...fd[uid], movimientos: fd[uid].movimientos.filter(m => m.id !== mid) };
    State.setState({ finData: fd });
    await _supa.from('movimientos').delete().eq('id', mid).eq('user_id', uid);
  },

  // ── Finanzas — Patrimonio ──
  async savePatrimonio(activos, pasivos) {
    const uid = State.get('user')?.id;
    const fd = { ...State.get('finData') };
    fd[uid] = { ...fd[uid], activos, pasivos };
    State.setState({ finData: fd });
    const cur = fd[uid];
    await _supa.from('fin_patrimonio').upsert({
      user_id: uid, activos, pasivos,
      emergencia: cur.emergencia, proyeccion: cur.proyeccion, inversiones: cur.inversiones,
    });
  },

  async saveEmergencia(em) {
    const uid = State.get('user')?.id;
    const fd = { ...State.get('finData') };
    fd[uid] = { ...fd[uid], emergencia: em };
    State.setState({ finData: fd });
    const cur = fd[uid];
    await _supa.from('fin_patrimonio').upsert({
      user_id: uid, activos: cur.activos, pasivos: cur.pasivos,
      emergencia: em, proyeccion: cur.proyeccion, inversiones: cur.inversiones,
    });
  },

  async saveProyeccion(proy) {
    const uid = State.get('user')?.id;
    const fd = { ...State.get('finData') };
    fd[uid] = { ...fd[uid], proyeccion: proy };
    State.setState({ finData: fd });
    const cur = fd[uid];
    await _supa.from('fin_patrimonio').upsert({
      user_id: uid, activos: cur.activos, pasivos: cur.pasivos,
      emergencia: cur.emergencia, proyeccion: proy, inversiones: cur.inversiones,
    });
  },

  async addInversion(inv) {
    const uid = State.get('user')?.id;
    const fd = { ...State.get('finData') };
    fd[uid] = { ...fd[uid], inversiones: [...(fd[uid].inversiones || []), inv] };
    State.setState({ finData: fd });
    const cur = fd[uid];
    await _supa.from('fin_patrimonio').upsert({
      user_id: uid, activos: cur.activos, pasivos: cur.pasivos,
      emergencia: cur.emergencia, proyeccion: cur.proyeccion, inversiones: cur.inversiones,
    });
  },

  async addFinCat(cat) {
    const uid = State.get('user')?.id;
    State.setState({ finCats: [...State.get('finCats'), cat] });
    await _supa.from('fin_cats').upsert({ ...cat, user_id: uid });
  },

  async deleteFinCat(fid) {
    const uid = State.get('user')?.id;
    State.setState({ finCats: State.get('finCats').filter(f => f.id !== fid) });
    await _supa.from('fin_cats').delete().eq('id', fid).eq('user_id', uid);
  },

  async addFinGoal(goal) {
    const uid = State.get('user')?.id;
    State.setState({ finGoals: [...State.get('finGoals'), goal] });
    await _supa.from('fin_goals').upsert({ ...goal, user_id: uid });
  },

  async saveIngreso(amount) {
    const uid = State.get('user')?.id;
    const monthKey = Dates.monthKey();
    const ingresos = { ...State.get('ingresos'), [`${uid}_${monthKey}`]: amount };
    State.setState({ ingresos });
    await _supa.from('ingresos').upsert({ id: `${uid}_${monthKey}`, user_id: uid, month_key: monthKey, amount });
  },

  // ── Diario ──
  async addDiario(entry) {
    const uid = State.get('user')?.id;
    State.setState({ diario: [entry, ...State.get('diario')] });
    await _supa.from('diario').upsert({
      id: entry.id, user_id: uid, text: entry.text, mood: entry.mood,
      date_str: entry.dateStr, day_num: entry.dayNum,
    });
  },

  // ── Notas ──
  async addNota(nota) {
    const uid = State.get('user')?.id;
    State.setState({ notas: [nota, ...State.get('notas')] });
    await _supa.from('notas').upsert({ id: nota.id, user_id: uid, text: nota.text, time: nota.time });
  },

  async deleteNota(nid) {
    const uid = State.get('user')?.id;
    State.setState({ notas: State.get('notas').filter(n => n.id !== nid) });
    await _supa.from('notas').delete().eq('id', nid).eq('user_id', uid);
  },

  // ── Métricas ──
  async addMetric(entry) {
    const uid = State.get('user')?.id;
    State.setState({ metrics: [entry, ...State.get('metrics')] });
    await _supa.from('metrics').upsert({
      id: entry.id, user_id: uid, peso: entry.peso, energia: entry.energia,
      agua: entry.agua, sueno: entry.sueno, date: entry.date,
    });
  },

  // ── Plan ──
  async savePlanTask(day, slot, taskData) {
    const uid = State.get('user')?.id;
    const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const plan = { ...State.get('plan') };
    const key = `${uid}:${DIAS[day]}:${slot}`;

    if (taskData === null) {
      delete plan[key];
      await _supa.from('plan_tasks').delete().eq('user_id', uid).eq('dia', DIAS[day]).eq('slot', slot);
    } else {
      plan[key] = taskData;
      await _supa.from('plan_tasks').upsert({
        id: `${uid}_${DIAS[day]}_${slot}`, user_id: uid,
        dia: DIAS[day], slot, name: taskData.name, time: taskData.time,
        prio: taskData.prio, done: taskData.done || false,
        rescheduled: taskData.rescheduled || false, original_day: taskData.originalDay || null,
      });
    }
    State.setState({ plan });
  },

  // ── Score History ──
  async saveScoreSnapshot(date, score) {
    const uid = State.get('user')?.id;
    const hist = [...(State.get('scoreHistory') || [])];
    const exists = hist.find(h => h.userId === uid && h.date === date);
    if (!exists) {
      hist.unshift({ userId: uid, date, score });
      State.setState({ scoreHistory: hist.slice(0, 200) });
    }
    await _supa.from('score_history').upsert(
      { user_id: uid, date, score },
      { onConflict: 'user_id,date' }
    );
  },

  // ── Goals ──
  async addGoal(goal) {
    const uid = State.get('user')?.id;
    const goals = [...(State.get('goals') || []), goal];
    State.setState({ goals });
    await _supa.from('goals').upsert({
      id: goal.id, user_id: uid, tipo: goal.tipo, name: goal.name,
      desc: goal.desc, icon: goal.icon, meta: goal.meta,
      fecha_limite: goal.fechaLimite, meta_valor: goal.metaValor,
      avance_valor: goal.avanceValor || 0, pct: goal.pct || 0,
      status: goal.status || 'progreso',
      auto_calc: goal.autoCalc || false,
      auto_calc_type: goal.autoCalcType || null,
      auto_target: goal.autoTarget || null,
      created_at: goal.createdAt,
    });
  },

  async updateGoal(gid, updates) {
    const uid = State.get('user')?.id;
    const goals = (State.get('goals') || []).map(g =>
      g.id === gid ? { ...g, ...updates, _tempPct: undefined } : g
    );
    State.setState({ goals });
    await _supa.from('goals').update({
      pct: updates.pct, status: updates.status,
    }).eq('id', gid).eq('user_id', uid);
  },

  async deleteGoal(gid) {
    const uid = State.get('user')?.id;
    State.setState({ goals: (State.get('goals') || []).filter(g => g.id !== gid) });
    await _supa.from('goals').delete().eq('id', gid).eq('user_id', uid);
  },
};

// ── ID generator ─────────────────────────
export function genId() {
  return '_' + Math.random().toString(36).slice(2, 9);
}

// ── Goals (agregado en Fase 6) ──────────
// Estas funciones van dentro del objeto DB exportado.
// Por compatibilidad se agregan como métodos del objeto DB global.
