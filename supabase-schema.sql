-- Run this entire script in your Supabase SQL Editor to reset and configure your tables
-- To update an existing database, run:
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text UNIQUE;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password text;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
-- ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
-- ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
-- ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS cleared_at timestamp with time zone;
-- ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS avatar_url text;

-- 1. Create the Users table
CREATE TABLE IF NOT EXISTS public.users (
  uid uuid DEFAULT gen_random_uuid(),
  code text PRIMARY KEY,
  username text UNIQUE,
  password text,
  display_name text,
  avatar_url text,
  accent_color text,
  pattern_enabled boolean,
  pattern_style text,
  created_at timestamp with time zone DEFAULT now(),
  last_seen timestamp with time zone DEFAULT now()
);

-- 2. Create the Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id text PRIMARY KEY,
  uids text[],
  codes text[],
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Create the Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id text PRIMARY KEY,
  conversation_id text REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_code text REFERENCES public.users(code) ON DELETE CASCADE,
  text text,
  attachment jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Create the Contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_code text REFERENCES public.users(code) ON DELETE CASCADE,
  contact_code text REFERENCES public.users(code) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  last_message_at timestamp with time zone,
  last_read_at timestamp with time zone,
  cleared_at timestamp with time zone,
  is_blocked boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_code, contact_code)
);

-- 5. Disable Row Level Security (RLS) since we are using custom code-based authentication
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;

-- 6. Enable real-time for all tables
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.users, public.conversations, public.messages, public.contacts;
COMMIT;
