-- Clarifi memory database — initial schema (v1)
-- schema_migrations table is created by migrate.ts before migrations run

CREATE TABLE memory_settings (
  id                         INTEGER PRIMARY KEY CHECK (id = 1),
  retention_days             INTEGER NOT NULL DEFAULT 90,
  daily_briefing_enabled     INTEGER NOT NULL DEFAULT 1,
  daily_briefing_time        TEXT NOT NULL DEFAULT '08:00',
  cross_session_context      INTEGER NOT NULL DEFAULT 1,
  relationship_cards         INTEGER NOT NULL DEFAULT 1,
  adaptive_learning          INTEGER NOT NULL DEFAULT 1,
  calendar_sync_enabled      INTEGER NOT NULL DEFAULT 0,
  last_briefing_generated_at INTEGER,
  updated_at                 INTEGER NOT NULL
);

CREATE TABLE user_profile (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  name                TEXT,
  role                TEXT,
  company             TEXT,
  industry            TEXT,
  tools_json          TEXT,
  communication_style TEXT,
  preference_profile  TEXT,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE people (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  normalized_name     TEXT NOT NULL,
  company             TEXT,
  role                TEXT,
  email               TEXT,
  notes               TEXT,
  sentiment_hint      TEXT,
  first_seen_at       INTEGER NOT NULL,
  last_seen_at        INTEGER NOT NULL,
  interaction_count   INTEGER NOT NULL DEFAULT 0,
  metadata_json       TEXT,
  UNIQUE(normalized_name, company)
);

CREATE TABLE memory_sessions (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  title           TEXT,
  platform        TEXT,
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  duration_ms     INTEGER,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata_json   TEXT,
  search_text     TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE knowledge_facts (
  id            TEXT PRIMARY KEY,
  category      TEXT NOT NULL,
  key           TEXT,
  value         TEXT NOT NULL,
  source        TEXT NOT NULL,
  confidence    REAL NOT NULL DEFAULT 1.0,
  session_id    TEXT,
  person_id     TEXT,
  is_deleted    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
);

CREATE TABLE session_summaries (
  session_id         TEXT PRIMARY KEY,
  summary            TEXT NOT NULL,
  topics_json        TEXT,
  decisions_json     TEXT,
  action_items_json  TEXT,
  facts_learned_json TEXT,
  model              TEXT,
  generated_at       INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE CASCADE
);

CREATE TABLE session_transcript_chunks (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  speaker     TEXT,
  text        TEXT NOT NULL,
  at_ms       INTEGER NOT NULL,
  source      TEXT,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE CASCADE
);

CREATE TABLE session_interactions (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  type          TEXT NOT NULL,
  role          TEXT,
  content       TEXT NOT NULL,
  metadata_json TEXT,
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE CASCADE
);

CREATE TABLE session_people (
  session_id  TEXT NOT NULL,
  person_id   TEXT NOT NULL,
  role        TEXT,
  PRIMARY KEY (session_id, person_id),
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE person_interactions (
  id          TEXT PRIMARY KEY,
  person_id   TEXT NOT NULL,
  session_id  TEXT,
  summary     TEXT NOT NULL,
  sentiment   TEXT,
  occurred_at INTEGER NOT NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE SET NULL
);

CREATE TABLE action_items (
  id           TEXT PRIMARY KEY,
  session_id   TEXT,
  person_id    TEXT,
  text         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  due_at       INTEGER,
  completed_at INTEGER,
  source       TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL
);

CREATE TABLE daily_briefings (
  id               TEXT PRIMARY KEY,
  briefing_date    TEXT NOT NULL,
  content_json     TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  calendar_json    TEXT,
  generated_at     INTEGER NOT NULL,
  dismissed_at     INTEGER,
  pinned           INTEGER NOT NULL DEFAULT 0,
  UNIQUE(briefing_date)
);

CREATE TABLE calendar_tokens (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  provider      TEXT NOT NULL DEFAULT 'google',
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    INTEGER,
  scope         TEXT,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE suggestion_feedback (
  id              TEXT PRIMARY KEY,
  session_id      TEXT,
  interaction_id  TEXT,
  suggestion_type TEXT NOT NULL,
  original_text   TEXT NOT NULL,
  outcome         TEXT NOT NULL,
  edited_text     TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE SET NULL
);

CREATE TABLE learning_runs (
  id            TEXT PRIMARY KEY,
  session_count INTEGER NOT NULL,
  insights_json TEXT NOT NULL,
  applied_at    INTEGER NOT NULL
);

CREATE TABLE context_injection_cache (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL,
  context_json   TEXT NOT NULL,
  token_estimate INTEGER,
  created_at     INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES memory_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_knowledge_facts_category ON knowledge_facts(category) WHERE is_deleted = 0;
CREATE INDEX idx_knowledge_facts_person ON knowledge_facts(person_id) WHERE is_deleted = 0;
CREATE INDEX idx_knowledge_facts_updated ON knowledge_facts(updated_at DESC);
CREATE INDEX idx_sessions_started ON memory_sessions(started_at DESC);
CREATE INDEX idx_sessions_search ON memory_sessions(search_text);
CREATE INDEX idx_transcript_session ON session_transcript_chunks(session_id, seq);
CREATE INDEX idx_interactions_session ON session_interactions(session_id, created_at);
CREATE INDEX idx_people_name ON people(normalized_name);
CREATE INDEX idx_people_last_seen ON people(last_seen_at DESC);
CREATE INDEX idx_person_interactions ON person_interactions(person_id, occurred_at DESC);
CREATE INDEX idx_action_items_status ON action_items(status, due_at);
