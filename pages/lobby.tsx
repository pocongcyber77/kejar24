import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import RoomList from '../components/RoomList';

const Lobby = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  // Fetch rooms from Supabase
  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'waiting');
    if (!error) setRooms(data || []);
    setLoading(false);
  };

  // Subscribe to rooms changes
  useEffect(() => {
    fetchRooms();
    const subscription = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          fetchRooms();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Create a new room
  const handleCreateRoom = async () => {
    setCreating(true);
    const roomId = Math.random().toString(36).substr(2, 8);
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from('rooms')
      .insert([
        {
          room_id: roomId,
          players: [user?.id],
          status: 'waiting',
        },
      ])
      .select()
      .single();
    setCreating(false);
    if (!error && data) {
      router.push(`/game?room_id=${data.room_id}`);
    }
  };

  // Join an existing room
  const handleJoinRoom = async (room: any) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (room.players.length >= 2) return;
    const updatedPlayers = [...room.players, user.id];
    const { data, error } = await supabase
      .from('rooms')
      .update({ players: updatedPlayers, status: updatedPlayers.length === 2 ? 'playing' : 'waiting' })
      .eq('id', room.id)
      .select()
      .single();
    if (!error && data) {
      router.push(`/game?room_id=${data.room_id}`);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 24 }}>
      <h1>Lobby</h1>
      <button onClick={handleCreateRoom} disabled={creating} style={{ marginBottom: 16 }}>
        {creating ? 'Creating...' : 'Create Room'}
      </button>
      <RoomList rooms={rooms} onJoin={handleJoinRoom} loading={loading} />
    </div>
  );
};

export default Lobby; 