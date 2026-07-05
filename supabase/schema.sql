-- FlipBot Supabase Schema
-- Run this in the Supabase SQL editor

-- =====================
-- Table: listings
-- Annonces vues (déduplication + source de données pour médianes)
-- =====================
CREATE TABLE IF NOT EXISTS listings (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  price       NUMERIC(10, 2) NOT NULL,
  brand       TEXT,
  category    TEXT,
  condition   TEXT,
  url         TEXT NOT NULL,
  seen_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_brand_cat_cond
  ON listings (brand, category, condition);

CREATE INDEX IF NOT EXISTS idx_listings_seen_at
  ON listings (seen_at DESC);

-- =====================
-- Table: price_medians
-- Médianes de prix par niche (brand + category + condition)
-- =====================
CREATE TABLE IF NOT EXISTS price_medians (
  brand         TEXT NOT NULL,
  category      TEXT NOT NULL,
  condition     TEXT NOT NULL,
  median_price  NUMERIC(10, 2) NOT NULL,
  sample_size   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (brand, category, condition)
);

-- =====================
-- Table: alerts_log
-- Historique des alertes envoyées
-- =====================
CREATE TABLE IF NOT EXISTS alerts_log (
  id            BIGSERIAL PRIMARY KEY,
  item_id       TEXT NOT NULL REFERENCES listings(id),
  niche_key     TEXT NOT NULL,
  price         NUMERIC(10, 2) NOT NULL,
  median        NUMERIC(10, 2) NOT NULL,
  discount_pct  NUMERIC(5, 4) NOT NULL,  -- ratio price/median, ex: 0.6500
  alerted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_item_id ON alerts_log (item_id);
CREATE INDEX IF NOT EXISTS idx_alerts_alerted_at ON alerts_log (alerted_at DESC);

-- =====================
-- Row Level Security (optionnel mais recommandé)
-- =====================
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_medians ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts_log ENABLE ROW LEVEL SECURITY;

-- Service role a accès complet (utilisé par le bot)
CREATE POLICY "service_role_all" ON listings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON price_medians FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON alerts_log FOR ALL TO service_role USING (true) WITH CHECK (true);
