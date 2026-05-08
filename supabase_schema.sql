-- Supabase Schema for FraudSense SA

-- Organisations Table
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('BANK', 'FINTECH', 'PAYMENT_PROCESSOR')) NOT NULL,
  plan TEXT CHECK (plan IN ('STARTER', 'GROWTH', 'ENTERPRISE')) NOT NULL,
  owner_id TEXT NOT NULL,
  stats_total INTEGER DEFAULT 0,
  stats_flagged INTEGER DEFAULT 0,
  stats_critical INTEGER DEFAULT 0,
  stats_volume NUMERIC DEFAULT 0,
  stats_today_total INTEGER DEFAULT 0,
  stats_today_volume NUMERIC DEFAULT 0,
  stats_last_reset BIGINT,
  stats_low INTEGER DEFAULT 0,
  stats_medium INTEGER DEFAULT 0,
  stats_high INTEGER DEFAULT 0,
  stats_critical_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys Table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  last_used BIGINT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  external_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  type TEXT CHECK (type IN ('DEBIT', 'CREDIT', 'TRANSFER', 'PAYMENT')) NOT NULL,
  channel TEXT CHECK (channel IN ('ATM', 'ONLINE', 'POS', 'MOBILE', 'EFT')) NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  merchant_name TEXT,
  merchant_city TEXT,
  merchant_country TEXT NOT NULL,
  ip_address TEXT,
  device_id TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  risk_score INTEGER NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
  fraud_flags TEXT[],
  is_reviewed BOOLEAN DEFAULT FALSE,
  is_fraud BOOLEAN,
  case_id UUID,
  is_demo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts Table
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cases Table
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('OPEN', 'INVESTIGATING', 'ESCALATED', 'RESOLVED', 'CLOSED')) NOT NULL,
  priority TEXT CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  assigned_to_id TEXT,
  notes TEXT,
  total_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rules Table
CREATE TABLE rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value NUMERIC NOT NULL,
  action TEXT CHECK (action IN ('ALERT', 'BLOCK', 'FLAG', 'REVIEW')) NOT NULL,
  severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
  score_boost INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Demo State Table
CREATE TABLE demo_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  is_running BOOLEAN DEFAULT FALSE,
  scenario_index INTEGER DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE transactions, alerts, cases;
