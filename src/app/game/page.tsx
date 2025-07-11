"use client";
import { useRouter, useSearchParams } from "next/navigation";
import FlappyGame from "@/components/FlappyGame";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabaseClient";

type Player = {
  id: string;
  user_id: string;
  room_id: string;
  username: string;
  is_owner: boolean;
  joined_at: string;
};

type Room = {
  id: string;
  name: string;
  owner: string;
  created_at: string;
  status: "waiting" | "playing" | "finished";
};

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const room = searchParams.get("room");
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: { user?: { id: string } } | null } }) => {
      const session = data.session;
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  // Join room as player
  const joinRoom = async (roomId: string) => {
    if (!userId) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log("Joining room:", roomId, "User:", userId);

    // Check if already joined
    const { data: existingPlayer, error: checkError } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking existing player:", checkError);
    }

    if (!existingPlayer) {
      // Join as new player
      const { error } = await supabase.from("players").insert([
        {
          room_id: roomId,
          user_id: userId,
          username: user.email?.split("@")[0] || `Player-${Math.floor(Math.random() * 1000)}`,
          is_owner: roomData?.owner === userId,
          joined_at: new Date().toISOString(),
        },
      ]);
      if (error) {
        console.error("Error joining room:", error);
      } else {
        console.log("Successfully joined room");
        // Fetch updated players list after joining
        await fetchPlayers(roomId);
      }
    } else {
      console.log("Already in room:", existingPlayer);
      setCurrentPlayer(existingPlayer);
      // Also fetch all players to ensure we have the complete list
      await fetchPlayers(roomId);
    }
  };

  // Fetch players function
  const fetchPlayers = async (roomId: string) => {
    console.log("Fetching players for room:", roomId, "as user:", userId);
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    
    if (error) {
      console.error("Error fetching players:", error);
      setPlayers([]);
      setCurrentPlayer(null);
      return;
    }
    
    console.log("Fetched players:", data);
    setPlayers(data || []);
    const currentPlayerData = (data || []).find(p => p.user_id === userId);
    setCurrentPlayer(currentPlayerData || null);
  };

  useEffect(() => {
    if (!mode && !room) return;
    if (mode === "solo") {
      setLoading(false);
      return;
    }
    if (room && userId) { // Only run when userId is available
      (async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", room)
          .single();
        if (error || !data) {
          setNotFound(true);
          setTimeout(() => router.replace("/lobby"), 2000);
        } else {
          setRoomData(data);
          // Join room
          await joinRoom(room);
        }
        setLoading(false);
      })();
    }
  }, [mode, room, router, userId]);

  // Subscribe to room and players changes
  useEffect(() => {
    if (!room || !userId) return; // Only run when userId is available

    console.log("Setting up subscriptions for room:", room);

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room-${room}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room}` },
        (payload) => {
          console.log("Room change detected:", payload);
          if (payload.eventType === "UPDATE") {
            setRoomData(payload.new as Room);
            if (payload.new.status === "playing") {
              setGameStarted(true);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to players changes
    const playersChannel = supabase
      .channel(`players-${room}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room}` },
        async (payload) => {
          console.log("Player change detected:", payload);
          // Fetch updated players
          await fetchPlayers(room);
        }
      )
      .subscribe();

    // Initial fetch
    fetchPlayers(room);

    return () => {
      console.log("Cleaning up subscriptions");
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
    };
  }, [room, userId]);

  // Start game (owner only)
  const startGame = async () => {
    if (!roomData || roomData.owner !== userId) return;
    
    const { error } = await supabase
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", room);
    
    if (error) {
      console.error("Error starting game:", error);
    }
  };

  if (!mode && !room) return null;
  if (loading) return <div>Loading...</div>;
  if (mode === "solo" && userId === undefined) return null; // Tunggu session
  if (mode === "solo")
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 to-blue-200 p-6">
        <FlappyGame userId={userId ?? ''} />
        <div className="mt-10 text-gray-400 text-sm">&copy; 2024 Kuyang Cina!!</div>
      </div>
    );
  if (notFound) return <div>Room tidak ditemukan. Mengalihkan ke lobby...</div>;
  
  if (gameStarted && roomData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 to-blue-200 p-6">
        <FlappyGame 
          userId={userId ?? ''} 
          roomId={room}
          players={players}
          currentPlayer={currentPlayer}
          isMultiplayer={true}
        />
        <div className="mt-10 text-gray-400 text-sm">&copy; 2024 Kuyang Cina!!</div>
      </div>
    );
  }

  if (roomData)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 to-blue-200 p-6">
        <div className="bg-white/80 rounded-3xl shadow-xl px-8 py-10 flex flex-col items-center max-w-2xl w-full">
          <h1 className="text-3xl font-extrabold text-yellow-500 mb-2 drop-shadow-lg text-center" style={{letterSpacing: 2}}>
            Kuyang Cina!!
          </h1>
          <div className="mb-4 w-full">
            <h2 className="text-xl font-bold text-red-500 mb-2">Room: {roomData.name}</h2>
            <p className="text-gray-500 mb-4">Room ID: {roomData.id}</p>
            {currentPlayer && (
              <div className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-300">
                <strong>Anda: {currentPlayer.username}</strong>
                {currentPlayer.is_owner && " (Owner)"}
              </div>
            )}
          </div>
          <div className="w-full mb-4">
            <h3 className="text-lg font-bold mb-2 text-yellow-700">Pemain di Room:</h3>
            <ul className="mb-4">
              {players.map((p) => (
                <li key={p.id} className="mb-1 text-base text-gray-700">
                  {p.username} {p.is_owner && <span className="text-yellow-500 font-bold">(Owner)</span>}
                  {p.user_id === userId && <span className="ml-2 text-green-500 font-bold">(Kamu)</span>}
                </li>
              ))}
            </ul>
          </div>
          {roomData.owner === userId && (
            <button onClick={startGame} className="bg-gradient-to-r from-yellow-400 to-red-400 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:scale-105 hover:from-yellow-500 hover:to-red-500 transition-all text-lg mb-4">
              Mulai Game
            </button>
          )}
          <button onClick={() => router.push('/lobby')} className="mt-2 bg-gray-200 text-gray-700 font-bold px-6 py-2 rounded-lg shadow hover:bg-gray-300 transition-all text-base">
            Kembali ke Lobby
          </button>
        </div>
        <div className="mt-10 text-gray-400 text-sm">&copy; 2024 Kuyang Cina!!</div>
      </div>
    );
  return null;
}

export default function GamePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GameContent />
    </Suspense>
  );
} 