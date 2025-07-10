import React from 'react';

type Room = {
  id: number;
  room_id: string;
  players: string[];
  status: string;
  created_at: string;
};

type Props = {
  rooms: Room[];
  onJoin: (room: Room) => void;
  loading: boolean;
};

const RoomList: React.FC<Props> = ({ rooms, onJoin, loading }) => {
  if (loading) return <div>Loading rooms...</div>;
  if (!rooms.length) return <div>No rooms available. Create one!</div>;
  return (
    <ul>
      {rooms.map((room) => (
        <li key={room.id} style={{ marginBottom: 12 }}>
          <span>Room ID: <b>{room.room_id}</b> | Players: {room.players.length}/2</span>
          <button
            style={{ marginLeft: 12 }}
            disabled={room.players.length >= 2}
            onClick={() => onJoin(room)}
          >
            Join
          </button>
        </li>
      ))}
    </ul>
  );
};

export default RoomList; 