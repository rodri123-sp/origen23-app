-- ═══════════════════════════════════════
-- ORIGEN 23 v2.0 — Supabase SQL Schema
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════

-- ── Habilitar extensión UUID ──────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ─────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name    TEXT DEFAULT 'Usuario',
  color   TEXT DEFAULT '#00E87A',
  email   TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (auth.uid() = id);

-- ── Habits ───────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id       TEXT PRIMARY KEY,
  user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  icon     TEXT, name TEXT, color TEXT, section TEXT DEFAULT 'diario',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_habits" ON habits FOR ALL USING (auth.uid() = user_id);

-- ── Habit Logs ────────────────────────────
CREATE TABLE IF NOT EXISTS habit_logs (
  id        TEXT PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id  TEXT REFERENCES habits(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  day       INTEGER NOT NULL
);
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_habit_logs" ON habit_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_month ON habit_logs(user_id, month_key);

-- ── Trades ───────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id               TEXT PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  result           TEXT CHECK (result IN ('Win','Loss','Break Even')),
  pnl              NUMERIC(12,2) DEFAULT 0,
  rr               NUMERIC(8,2),
  riesgo           NUMERIC(6,2),
  setup            TEXT,
  hour             TEXT,
  notes            TEXT,
  date             DATE,
  error_emocional  BOOLEAN DEFAULT FALSE,
  error_tecnico    BOOLEAN DEFAULT FALSE,
  cumplio_plan     BOOLEAN,
  consecuencia     TEXT,
  pre_checklist    JSONB DEFAULT '{}',
  post_checklist   JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_trades" ON trades FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades(user_id, date);

-- ── Trade Errors ─────────────────────────
CREATE TABLE IF NOT EXISTS trade_errors (
  id         TEXT PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,
  count      INTEGER DEFAULT 0
);
ALTER TABLE trade_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_trade_errors" ON trade_errors FOR ALL USING (auth.uid() = user_id);

-- ── Goals / Metas ─────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id             TEXT PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo           TEXT DEFAULT 'personal' CHECK (tipo IN ('financiero','trading','habito','personal')),
  name           TEXT NOT NULL,
  desc           TEXT,
  icon           TEXT,
  meta           TEXT,
  fecha_limite   DATE,
  meta_valor     NUMERIC(12,2),
  avance_valor   NUMERIC(12,2) DEFAULT 0,
  pct            INTEGER DEFAULT 0 CHECK (pct BETWEEN 0 AND 100),
  status         TEXT DEFAULT 'progreso' CHECK (status IN ('progreso','completado','vencido')),
  auto_calc      BOOLEAN DEFAULT FALSE,
  auto_calc_type TEXT,
  auto_target    NUMERIC(12,4),
  linked_id      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_goals" ON goals FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, status);

-- ── Fin Categories ────────────────────────
CREATE TABLE IF NOT EXISTS fin_cats (
  id       TEXT PRIMARY KEY,
  user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  icon     TEXT, name TEXT, budget NUMERIC(12,2) DEFAULT 0, color TEXT
);
ALTER TABLE fin_cats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_fin_cats" ON fin_cats FOR ALL USING (auth.uid() = user_id);

-- ── Fin Goals ─────────────────────────────
CREATE TABLE IF NOT EXISTS fin_goals (
  id      TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name    TEXT, icon TEXT, target NUMERIC(12,2), saved NUMERIC(12,2) DEFAULT 0,
  fecha   DATE, color TEXT
);
ALTER TABLE fin_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_fin_goals" ON fin_goals FOR ALL USING (auth.uid() = user_id);

-- ── Movimientos ───────────────────────────
CREATE TABLE IF NOT EXISTS movimientos (
  id      TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo    TEXT CHECK (tipo IN ('ingreso','gasto','inversion')),
  cat_id  TEXT REFERENCES fin_cats(id) ON DELETE SET NULL,
  desc    TEXT NOT NULL,
  monto   NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  fecha   DATE NOT NULL
);
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_movimientos" ON movimientos FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_user_fecha ON movimientos(user_id, fecha DESC);

-- ── Patrimonio ────────────────────────────
CREATE TABLE IF NOT EXISTS fin_patrimonio (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  activos     JSONB DEFAULT '{}',
  pasivos     JSONB DEFAULT '{}',
  emergencia  JSONB DEFAULT '{"gastos":0,"meses":6,"actual":0}',
  proyeccion  JSONB DEFAULT '{"ahorro":0,"rentabilidad":8}',
  inversiones JSONB DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fin_patrimonio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_patrimonio" ON fin_patrimonio FOR ALL USING (auth.uid() = user_id);

-- ── Ingresos ─────────────────────────────
CREATE TABLE IF NOT EXISTS ingresos (
  id        TEXT PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  amount    NUMERIC(12,2) DEFAULT 0,
  UNIQUE(user_id, month_key)
);
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_ingresos" ON ingresos FOR ALL USING (auth.uid() = user_id);

-- ── Diario ───────────────────────────────
CREATE TABLE IF NOT EXISTS diario (
  id         TEXT PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT,
  mood       INTEGER CHECK (mood BETWEEN 1 AND 5),
  date_str   TEXT,
  day_num    INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE diario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_diario" ON diario FOR ALL USING (auth.uid() = user_id);

-- ── Notas ────────────────────────────────
CREATE TABLE IF NOT EXISTS notas (
  id         TEXT PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT,
  time       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_notas" ON notas FOR ALL USING (auth.uid() = user_id);

-- ── Métricas ─────────────────────────────
CREATE TABLE IF NOT EXISTS metrics (
  id      TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  peso    NUMERIC(6,2),
  energia INTEGER CHECK (energia BETWEEN 1 AND 10),
  agua    NUMERIC(5,2),
  sueno   NUMERIC(5,2),
  date    DATE DEFAULT CURRENT_DATE
);
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_metrics" ON metrics FOR ALL USING (auth.uid() = user_id);

-- ── Plan Tasks ────────────────────────────
CREATE TABLE IF NOT EXISTS plan_tasks (
  id           TEXT PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dia          TEXT NOT NULL,
  slot         TEXT NOT NULL,
  name         TEXT,
  time         TEXT,
  prio         TEXT DEFAULT 'normal',
  done         BOOLEAN DEFAULT FALSE,
  rescheduled  BOOLEAN DEFAULT FALSE,
  original_day TEXT
);
ALTER TABLE plan_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_plan" ON plan_tasks FOR ALL USING (auth.uid() = user_id);

-- ── Score History ─────────────────────────
CREATE TABLE IF NOT EXISTS score_history (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date    DATE NOT NULL,
  score   INTEGER CHECK (score BETWEEN 0 AND 100),
  PRIMARY KEY (user_id, date)
);
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_scores" ON score_history FOR ALL USING (auth.uid() = user_id);

-- ── Trigger: auto-update profiles ────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Trigger: update updated_at en goals ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS goals_updated_at ON goals;
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
