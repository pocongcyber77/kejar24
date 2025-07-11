"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";

type Room = {
  id: string;
  name: string;
  owner: string;
  created_at: string;
};

export default function Lobby() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"" | "solo" | "multiplayer">("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();

  // Get current user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  // Fetch rooms from Supabase
  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRooms(data as Room[]);
  };

  // Subscribe to rooms changes (Supabase Realtime)
  useEffect(() => {
    if (mode !== "multiplayer") return;
    fetchRooms();
    const channel = supabase
      .channel("rooms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => {
          fetchRooms();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode]);

  // Create Room
  const handleCreateRoom = async () => {
    setLoading(true);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      alert("User not logged in!");
      setLoading(false);
      return;
    }
    const id = uuidv4();
    const name = `Room-${Math.floor(1000 + Math.random() * 9000)}`;
    const owner = session.user.id;
    const { error } = await supabase.from("rooms").insert([
      {
        id,
        name,
        owner,
        created_at: new Date().toISOString(),
      },
    ]);
    setLoading(false);
    if (error) {
      alert("Error creating room: " + JSON.stringify(error));
    } else {
      router.push(`/game?room=${id}`);
    }
  };

  // Handle mode selection
  const handleSelectMode = (selected: "solo" | "multiplayer") => {
    if (selected === "solo") {
      router.push("/game?mode=solo");
    } else {
      setMode("multiplayer");
    }
  };

  // Join Room
  const handleJoinRoom = (roomId: string, ownerId: string) => {
    // Dapatkan user session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        alert("User not logged in!");
        return;
      }
      // Owner bisa bergabung ke roomnya sendiri
      router.push(`/game?room=${roomId}`);
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <h1>Lobby</h1>
      <div style={{ display: "flex", gap: 16, marginBottom: 32, justifyContent: "center" }}>
        <button
          style={{ flex: 1, padding: 24, fontSize: 20, borderRadius: 12, border: "2px solid #2563eb", background: mode === "solo" ? "#2563eb" : "#fff", color: mode === "solo" ? "#fff" : "#2563eb", fontWeight: "bold", cursor: "pointer" }}
          onClick={() => handleSelectMode("solo")}
        >
          Main Solo
        </button>
        <button
          style={{ flex: 1, padding: 24, fontSize: 20, borderRadius: 12, border: "2px solid #2563eb", background: mode === "multiplayer" ? "#2563eb" : "#fff", color: mode === "multiplayer" ? "#fff" : "#2563eb", fontWeight: "bold", cursor: "pointer" }}
          onClick={() => handleSelectMode("multiplayer")}
        >
          Main Bareng (Multiplayer)
        </button>
      </div>
      {mode === "multiplayer" && (
        <>
          <button onClick={handleCreateRoom} disabled={loading} style={{ marginBottom: 16, width: "100%", padding: 16, fontSize: 18, borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: "bold", border: "none", cursor: "pointer" }}>
            {loading ? "Creating..." : "Create Room"}
          </button>
          <h2>Available Rooms</h2>
          <ul>
            {rooms.map((room) => {
              const isOwner = currentUserId === room.owner;
              return (
                <li key={room.id} style={{ 
                  marginBottom: 8, 
                  padding: 8, 
                  border: isOwner ? "2px solid #f59e0b" : "1px solid #eee", 
                  borderRadius: 6, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  background: isOwner ? "#fef3c7" : "#fff"
                }}>
                  <div>
                    <b>{room.name}</b> 
                    {isOwner ? (
                      <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: "bold" }}>
                        (Room Anda)
                      </span>
                    ) : (
                      <span style={{ marginLeft: 8, color: "#666" }}>
                        (Owner: {room.owner})
                      </span>
                    )}
                    <span style={{ marginLeft: 12, color: "#888" }}>
                      {new Date(room.created_at).toLocaleString()}
                    </span>
                  </div>
                  <button
                    style={{ 
                      marginLeft: 16, 
                      padding: "8px 16px", 
                      borderRadius: 6, 
                      background: isOwner ? "#f59e0b" : "#10b981", 
                      color: "#fff", 
                      border: "none", 
                      fontWeight: "bold", 
                      cursor: "pointer" 
                    }}
                    onClick={() => handleJoinRoom(room.id, room.owner)}
                  >
                    {isOwner ? "Masuk" : "Join"}
                  </button>
                </li>
              );
            })}
          </ul>
          {rooms.length === 0 && <div>No rooms available.</div>}
        </>
      )}
    </div>
  );
} 