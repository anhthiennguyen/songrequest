# Supabase Database Setup

This document outlines the database tables you need to create in your Supabase project for the "Your Sessions" feature.

## Required Tables

### 1. `sessions` Table

This table stores DJ sessions created by users.

```sql
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own sessions
CREATE POLICY "Users can view their own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can create their own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Anyone can read sessions (for public access via session_id)
CREATE POLICY "Anyone can view sessions by session_id"
  ON sessions FOR SELECT
  USING (true);

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. `songs` Table

This table stores song requests within sessions.

```sql
CREATE TABLE songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  artist TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for faster lookups
CREATE INDEX idx_songs_session_id ON songs(session_id);
CREATE INDEX idx_songs_created_at ON songs(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read songs in a session
CREATE POLICY "Anyone can view songs in sessions"
  ON songs FOR SELECT
  USING (true);

-- Policy: Authenticated users can insert songs
CREATE POLICY "Authenticated users can create songs"
  ON songs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can delete their own songs
CREATE POLICY "Users can delete their own songs"
  ON songs FOR DELETE
  USING (auth.uid() = created_by);

-- Policy: Session owners can delete any song in their session
CREATE POLICY "Session owners can delete songs in their sessions"
  ON songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = songs.session_id
      AND sessions.user_id = auth.uid()
    )
  );
```

### 3. `votes` Table

This table tracks votes on songs to prevent duplicate voting and calculate vote counts.

```sql
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(song_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_votes_song_id ON votes(song_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read votes
CREATE POLICY "Anyone can view votes"
  ON votes FOR SELECT
  USING (true);

-- Policy: Authenticated users can create votes
CREATE POLICY "Authenticated users can create votes"
  ON votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON votes FOR DELETE
  USING (auth.uid() = user_id);
```

## Setup Instructions

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run each CREATE TABLE statement above in order (sessions first, then songs, then votes)
4. The RLS policies will ensure data security while allowing public read access to sessions and songs

## Notes

- The `session_id` field in the `sessions` table is the short random ID (e.g., "ABC123") used in URLs
- The `songs` table references `sessions` by `session_id` (not the UUID `id`) for easier lookups
- The `votes` table has a unique constraint on `(song_id, user_id)` to prevent duplicate votes
- RLS policies allow public read access to sessions and songs (for sharing), but only authenticated users can create/update

