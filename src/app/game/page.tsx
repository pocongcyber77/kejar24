"use client";
import { useRouter, useSearchParams } from "next/navigation";
import FlappyGame from "@/components/FlappyGame";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function GamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const room = searchParams.get("room");
  const [roomData, setRoomData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: { user?: { id: string } } | null } }) => {
      const session = data.session;
      setUserId(session?.user?.id ?? null);
    });
  }, []);

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
        }
        setLoading(false);
      })();
    }
  }, [mode, room, router]);

  if (!mode && !room) return null;
  if (loading) return <div>Loading...</div>;
  if (mode === "solo" && userId === undefined) return null; // Tunggu session
  if (mode === "solo") return <FlappyGame userId={userId ?? ''} />;
  if (notFound) return <div>Room tidak ditemukan. Mengalihkan ke lobby...</div>;
  if (roomData)
    return (
      <div>
        <h1>Room ID: {roomData.id}</h1>
        <h2>Room Name: {roomData.name}</h2>
        <p>Menunggu pemain lain bergabung...</p>
        {/* Multiplayer game logic/komponen di sini */}
      </div>
    );
  return null;
} 