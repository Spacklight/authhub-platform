CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  website_url TEXT,
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uris TEXT DEFAULT '[]',
  facebook_enabled INTEGER DEFAULT 0,
  github_enabled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id),
  email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'email',
  provider_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(app_id, email)
);
