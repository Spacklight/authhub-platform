CREATE TABLE IF NOT EXISTS app_users (
 id TEXT PRIMARY KEY,
 app_id TEXT NOT NULL,
 provider TEXT NOT NULL,
 provider_user_id TEXT NOT NULL,
 email TEXT,
 name TEXT,
 avatar_url TEXT,
 created_at TEXT,
 UNIQUE(app_id, provider, provider_user_id)
);
