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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 to-blue-200 p-6">
      <div className="bg-white/80 rounded-3xl shadow-xl px-8 py-10 flex flex-col items-center max-w-2xl w-full">
        <h1 className="text-3xl font-extrabold text-yellow-500 mb-2 drop-shadow-lg text-center" style={{letterSpacing: 2}}>
          Kuyang Cina!!
        </h1>
        <p className="text-base text-gray-700 mb-6 text-center max-w-md">
          Pilih mode permainan: Introvert atau Bipolar!
        </p>
        <div className="flex gap-6 mb-8 w-full justify-center flex-wrap">
          <button
            className={`bg-gradient-to-r from-yellow-400 to-red-400 text-white font-bold px-8 py-5 rounded-xl shadow-lg hover:scale-105 hover:from-yellow-500 hover:to-red-500 transition-all text-lg ${mode === "solo" ? "ring-4 ring-yellow-400" : ""}`}
            onClick={() => handleSelectMode("solo")}
          >
            Main Solo
          </button>
          <button
            className={`bg-gradient-to-r from-yellow-400 to-red-400 text-white font-bold px-8 py-5 rounded-xl shadow-lg hover:scale-105 hover:from-yellow-500 hover:to-red-500 transition-all text-lg ${mode === "multiplayer" ? "ring-4 ring-yellow-400" : ""}`}
            onClick={() => handleSelectMode("multiplayer")}
          >
            Main Bareng (Multiplayer)
          </button>
        </div>
        {mode === "multiplayer" && (
          <>
            <button onClick={handleCreateRoom} disabled={loading} className="mb-6 w-full px-6 py-4 rounded-xl bg-yellow-400 text-white font-bold shadow-lg hover:bg-yellow-500 transition-all text-lg">
              {loading ? "Membuat Room..." : "Buat Room Baru"}
            </button>
            <h2 className="text-xl font-bold text-red-500 mb-4">Room Tersedia</h2>
            <ul className="w-full">
              {rooms.map((room) => {
                const isOwner = currentUserId === room.owner;
                return (
                  <li key={room.id} className={`mb-3 p-4 rounded-xl flex items-center justify-between shadow ${isOwner ? "bg-yellow-100 border-2 border-yellow-400" : "bg-white border border-gray-200"}`}>
                    <div>
                      <b className="text-lg text-yellow-700">{room.name}</b>
                      {isOwner ? (
                        <span className="ml-2 text-yellow-500 font-bold">(Room Anda)</span>
                      ) : (
                        <span className="ml-2 text-gray-500">(Owner: {room.owner})</span>
                      )}
                      <span className="ml-4 text-gray-400 text-xs">{new Date(room.created_at).toLocaleString()}</span>
                    </div>
                    <button
                      className={`ml-4 px-5 py-2 rounded-lg font-bold shadow ${isOwner ? "bg-yellow-400 text-white" : "bg-green-500 text-white"} hover:scale-105 transition-all`}
                      onClick={() => handleJoinRoom(room.id, room.owner)}
                    >
                      {isOwner ? "Masuk" : "Join"}
                    </button>
                  </li>
                );
              })}
            </ul>
            {rooms.length === 0 && <div className="text-gray-400 mt-4">Belum ada room.</div>}
          </>
        )}
      </div>
      <div className="mt-10 text-gray-400 text-sm">&copy; 2024 Kuyang Cina!!</div>
    </div>
  );
} 