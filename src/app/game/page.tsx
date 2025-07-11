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
    console.log("Fetching players for room:", roomId);
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    
    if (error) {
      console.error("Error fetching players:", error);
      return;
    }
    
    console.log("Fetched players:", data);
    if (data) {
      setPlayers(data);
      const currentPlayerData = data.find(p => p.user_id === userId);
      if (currentPlayerData) setCurrentPlayer(currentPlayerData);
    }
  };

  useEffect(() => {
    if (!mode && !room) return;
    if (mode === "solo") {
      setLoading(false);
      return;
    }
    if (room) {
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
    if (!room) return;

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
  if (mode === "solo") return <FlappyGame userId={userId ?? ''} />;
  if (notFound) return <div>Room tidak ditemukan. Mengalihkan ke lobby...</div>;
  
  if (gameStarted && roomData) {
    return (
      <FlappyGame 
        userId={userId ?? ''} 
        roomId={room}
        players={players}
        currentPlayer={currentPlayer}
        isMultiplayer={true}
      />
    );
  }

  if (roomData)
    return (
      <div style={{ 
        maxWidth: 800, 
        margin: "0 auto", 
        padding: 24,
        minHeight: "100vh",
        background: "#f8f9fa"
      }}>
        <div style={{ 
          background: "white", 
          borderRadius: 12, 
          padding: 24, 
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          marginBottom: 24
        }}>
          <h1 style={{ marginBottom: 8, color: "#2563eb" }}>Room: {roomData.name}</h1>
          <p style={{ color: "#666", marginBottom: 16 }}>
            Room ID: {roomData.id}
          </p>
          
          {currentPlayer && (
            <div style={{ 
              background: "#e3f2fd", 
              padding: 12, 
              borderRadius: 8, 
              marginBottom: 16,
              border: "1px solid #2196f3"
            }}>
              <strong>Anda: {currentPlayer.username}</strong>
              {currentPlayer.is_owner && " (Owner)"}
            </div>
          )}
        </div>

        <div style={{ 
          background: "white", 
          borderRadius: 12, 
          padding: 24, 
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          marginBottom: 24
        }}>
          <h2 style={{ marginBottom: 16, color: "#333" }}>Pemain dalam Room</h2>
          {players.length === 0 ? (
            <p style={{ color: "#666", fontStyle: "italic" }}>Belum ada pemain lain...</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {players.map((player, index) => {
                const isCurrentUser = player.user_id === userId;
                return (
                  <div key={player.id} style={{
                    display: "flex",
                    alignItems: "center",
                    padding: 12,
                    background: player.is_owner ? "#fff3cd" : "#f8f9fa",
                    borderRadius: 8,
                    border: player.is_owner ? "2px solid #ffc107" : "1px solid #dee2e6"
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: player.is_owner ? "#ffc107" : "#6c757d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      marginRight: 12
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold" }}>
                        {player.username}
                        {isCurrentUser && " (Anda)"}
                        {player.is_owner && " (Owner)"}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        Bergabung: {new Date(player.joined_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Jika hanya ada satu pemain (diri sendiri), tampilkan pesan */}
          {players.length === 1 && players[0].user_id === userId && (
            <p style={{ color: "#666", fontStyle: "italic", marginTop: 12 }}>
              Belum ada pemain lain...
            </p>
          )}
        </div>

        {roomData.owner === userId && players.length >= 1 && (
          <div style={{ 
            background: "white", 
            borderRadius: 12, 
            padding: 24, 
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            marginBottom: 24
          }}>
            <h3 style={{ marginBottom: 16, color: "#333" }}>Kontrol Owner</h3>
            <button
              onClick={startGame}
              style={{
                padding: "16px 32px",
                fontSize: 18,
                borderRadius: 8,
                background: "#28a745",
                color: "#fff",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer",
                width: "100%"
              }}
            >
              Mulai Game ({players.length} pemain)
            </button>
          </div>
        )}

        <button
          onClick={() => router.push("/lobby")}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            borderRadius: 8,
            background: "#6c757d",
            color: "#fff",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer"
          }}
        >
          Kembali ke Lobby
        </button>
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