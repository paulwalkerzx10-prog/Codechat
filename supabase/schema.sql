-- Supabase schema for CodeChat

CREATE TABLE users (
  code TEXT PRIMARY KEY,
  uid UUID UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accent_color TEXT DEFAULT 'violet',
  pattern_enabled BOOLEAN DEFAULT true,
  pattern_style TEXT DEFAULT 'dots'
);

CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_code TEXT REFERENCES users(code) ON DELETE CASCADE,
  contact_code TEXT REFERENCES users(code) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  cleared_at TIMESTAMPTZ,
  is_blocked BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  UNIQUE(user_code, contact_code)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  uids UUID[] NOT NULL,
  codes TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_code TEXT REFERENCES users(code) ON DELETE CASCADE,
  text TEXT NOT NULL,
  attachment JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
