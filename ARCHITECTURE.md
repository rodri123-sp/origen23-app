# ORIGEN 23 — Arquitectura v2.0
## Plan de refactorización profesional (SaaS-ready)

---

## Estructura de archivos

```
src/
├── main.js                    ← Punto de entrada. Auth + Router. Sin lógica de negocio.
│
├── services/
│   ├── state.js               ← AppState centralizado (setState / subscribe / saveCache)
│   ├── db.js                  ← Supabase: Auth + loadAllData + DB operations
│   ├── trading-calc.js        ← Motor de estadísticas de trading (puro, testeable)
│   ├── finance-calc.js        ← Motor financiero (KPIs, patrimonio, proyección)
│   └── score-calc.js          ← Life Score, hábitos, XP, gamificación
│
├── modules/
│   ├── dashboard/index.js     ← Dashboard principal
│   ├── habits/index.js        ← Tracker, estadísticas, rachas
│   ├── trading/index.js       ← Overview, journal, fondeo, checklist, calendario, errores
│   ├── finance/index.js       ← Resumen, movimientos, presupuesto, patrimonio, proyección
│   ├── goals/                 ← (próximo)
│   ├── planner/               ← (próximo)
│   ├── diary/                 ← (próximo)
│   ├── metrics/               ← (próximo)
│   └── insights/              ← (próximo)
│
├── components/
│   └── dom.js                 ← Creación segura de elementos (sin innerHTML con user data)
│
└── utils/
    ├── formatters.js          ← Fmt: currency, date, pct, escHtml
    ├── validators.js          ← Validators: trade, movement, habit, meta, finCat, finGoal
    └── dates.js               ← Dates: todayISO, monthKey, daysInMonth, etc.
```

---

## Principios de arquitectura

### 1. Estado centralizado (`services/state.js`)
```js
// ANTES (distribuido, imposible de rastrear)
let S = { trades: [], habits: [], ... };
localStorage.setItem('hb', JSON.stringify(S.habits));

// AHORA (único punto de verdad)
State.setState({ trades: [...State.get('trades'), newTrade] });
State.subscribe(['trades'], (state) => renderTrading());
```

### 2. Capa de datos separada (`services/db.js`)
```js
// ANTES (Supabase llamado desde cualquier función)
await supa.from('trades').upsert(...)  // en trading.js, app.js, etc.

// AHORA (todo pasa por DB.*)
await DB.addTrade(trade);   // actualiza State + persiste en Supabase atómicamente
await DB.addMovimiento(m);
```

### 3. Cálculos sin efectos secundarios (`services/*-calc.js`)
```js
// Funciones puras — entrada: State, salida: objeto con métricas
const stats = calcTradeStats();  // Win Rate, Profit Factor, Expectancy, Drawdown...
const patr  = calcPatrimonio();  // neto, ratios, liquidez...
const score = lifeScore();       // 0-100, compuesto de 4 dimensiones
```

### 4. DOM seguro (`components/dom.js`)
```js
// ANTES (riesgo XSS con datos del usuario)
el.innerHTML = `<div>${userData.name}</div>`;

// AHORA (escapado o createElement)
el.textContent = userData.name;
// o
DOM.div({ text: userData.name });
// o en template literals con datos de usuario:
Fmt.escHtml(userData.name)
```

### 5. Validación centralizada (`utils/validators.js`)
```js
// Cada formulario valida antes de tocar el estado
const errors = Validators.trade({ pnl, rr, riesgo, result, date });
if (Validators.hasErrors(errors)) {
  DOM.toast(Object.values(errors)[0], 'error');
  return;
}
```

---

## Bugs corregidos de v1

| Bug | Archivo original | Fix en v2 |
|-----|----------------|-----------|
| `PRE_CHECKLIST` declarado dos veces | `habitos.js` + `trading.js` | Centralizado en `trading/index.js` |
| `action-grid` id inexistente en HTML | `app.js` | Eliminado, reemplazado con render de módulo |
| `hm-months` + `heatmap` inexistentes | `app.js` | `renderFinHeatmapHTML()` autónomo |
| `todayStr()` devuelve `"D/M"` en vez de ISO | `trading.js` | `Dates.todayISO()` siempre devuelve `"YYYY-MM-DD"` |
| Sin límite de 2 trades por día | `trading.js` | `canAddTradeToday()` validado en `addTrade()` |
| Variables globales sin declarar | múltiples | `State.setState()` + módulos propios |
| `applyTheme()` no aplica al `<body>` | `app.js` | `State.subscribe(['theme'], ...)` en `main.js` |
| FAB de Finanzas visible fuera de módulo | `app.js` | `DOM.hide('mov-fab')` en `goTo()` antes de render |
| Sin validación en ningún formulario | todos | `Validators.*` en cada submit handler |

---

## Métricas de trading nivel fondeo

| Métrica | Fórmula | Dónde |
|---------|---------|-------|
| Win Rate | wins / total | `calcTradeStats()` |
| Profit Factor | grossWin / grossLoss | `calcTradeStats()` |
| Expectancy | (WR × AvgWin) − (LR × AvgLoss) | `calcTradeStats()` |
| Max Drawdown | pico - valle | `calcTradeStats()` |
| Consistency Score | 100 − (σ / μ) × 40 | `calcTradeStats()` |
| Análisis por sesión | hora más rentable | `calcSessionAnalysis()` |
| Análisis por día | día más rentable | `calcDayOfWeekAnalysis()` |
| Análisis por setup | setup más rentable | `calcSetupAnalysis()` |
| Equity Curve | P&L acumulado por trade | `calcEquityCurve()` |
| Dashboard fondeo | FTMO / FundedNext / The5ers / FundingPips | `calcFundedProgress()` |

---

## Módulo financiero — nivel banco digital

| Feature | Implementado |
|---------|-------------|
| Patrimonio Neto (Activos − Pasivos) | ✅ `calcPatrimonio()` |
| Ratio de ahorro | ✅ `tasaAhorro` en `calcMonthKPIs()` |
| Ratio de endeudamiento | ✅ `ratioEndeudamiento` |
| Ratio de inversión | ✅ `ratioInversion` |
| Liquidez | ✅ efectivo + MP + banco |
| Presupuesto por categorías | ✅ `renderPresupuesto()` |
| Alertas automáticas | ✅ `calcAlerts()` |
| Heatmap financiero 30 días | ✅ `calcFinHeatmap()` |
| Proyección a 1/3/6/12 meses | ✅ `calcProjection()` con interés compuesto |
| Historial mensual 6 meses | ✅ `calcMonthlyHistory()` |
| Fondo de emergencia | ✅ `calcEmergencia()` |
| Inversiones | ✅ `calcInversionesStats()` |

---

## Próximos pasos

1. **Migrar HTML** — Agregar los nuevos tabs de Trading y Finanzas al `index.html`
2. **Migrar módulos pendientes** — Metas, Semana, Diario, Métricas, Insights
3. **Convertir a `<script type="module">`** — Para usar imports nativos sin bundler
4. **Tests unitarios** — Los `*-calc.js` son funciones puras → fácilmente testeables
5. **Supabase RLS** — Revisar políticas para multi-tenant (SaaS)
6. **Rotar API Key** — La key expuesta en v1 debe rotarse en Supabase Dashboard

---

## Variables de entorno (próximo paso obligatorio)

```js
// NUNCA hardcodear en el código fuente:
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

Crear `.env.local`:
```
VITE_SUPABASE_URL=https://xclmfnfwagrjozsmfrxc.supabase.co
VITE_SUPABASE_ANON_KEY=tu_nueva_key_rotada
```

Agregar `.env.local` al `.gitignore`.
