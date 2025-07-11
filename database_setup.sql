-- Add status column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished'));

-- Create players table for multiplayer
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  is_owner BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Create RLS policies for players table
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Allow users to insert themselves into rooms
CREATE POLICY "Users can join rooms" ON players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to view players in rooms they're in
CREATE POLICY "Users can view players in their rooms" ON players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM players p2 
      WHERE p2.room_id = players.room_id 
      AND p2.user_id = auth.uid()
    )
  );

-- Allow users to update their own player data
CREATE POLICY "Users can update their own player data" ON players
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own player data
CREATE POLICY "Users can delete their own player data" ON players
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status); 