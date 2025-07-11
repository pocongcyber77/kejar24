import React, { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const WIDTH = 400;
const HEIGHT = 600;
const GROUND_HEIGHT = 90;
const BIRD_SIZE = 45;
const PIPE_WIDTH = 60;
const PIPE_GAP = 145;
const GRAVITY = 0.6;
const FLAP_POWER = -9;
const PIPE_INTERVAL = 1200; // ms
const PIPE_SPEED = 3.0; 

type Pipe = {
  x: number;
  gapY: number;
};

type Player = {
  id: string;
  user_id: string;
  room_id: string;
  username: string;
  is_owner: boolean;
  joined_at: string;
};

enum GameState {
  Ready = "ready",
  Playing = "playing",
  GameOver = "gameover",
}

const COLORS = {
  bg: "#70c5ce",
  ground: "#ded895",
  bird: "#ffdf00",
  pipe: "#228b22",
  pipeDark: "#196619",
  text: "#222",
};

interface FlappyGameProps {
  userId: string;
  roomId?: string | null;
  players?: Player[];
  currentPlayer?: Player | null;
  isMultiplayer?: boolean;
}

export default function FlappyGame({ 
  userId, 
  roomId, 
  players = [], 
  currentPlayer, 
  isMultiplayer = false 
}: FlappyGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.Ready);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  // Game state refs (for animation loop)
  const birdY = useRef(HEIGHT / 2);
  const velocity = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const frame = useRef(0);
  const nextPipeId = useRef(0);
  const pipeSpeed = useRef(2.5);
  const startTime = useRef(Date.now());

  // For collision/game over
  const [showScore, setShowScore] = useState(0);

  // Deteksi mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 700 || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent));
  }, []);

  // Fetch high score & history
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("scores")
        .select("score")
        .eq("user_id", userId)
        .order("score", { ascending: false });
      if (data && data.length > 0) {
        setHighScore(data[0].score);
        setScoreHistory(data.map((d: any) => d.score));
      } else {
        setHighScore(0);
        setScoreHistory([]);
      }
    })();
  }, [userId]);

  // Setelah game over, simpan skor
  useEffect(() => {
    if (gameState === GameState.GameOver && userId) {
      (async () => {
        await supabase.from("scores").insert([
          { user_id: userId, score: showScore },
        ]);
        // Update high score/history
        const { data } = await supabase
          .from("scores")
          .select("score")
          .eq("user_id", userId)
          .order("score", { ascending: false });
        if (data && data.length > 0) {
          setHighScore(data[0].score);
          setScoreHistory(data.map((d: any) => d.score));
        }
      })();
    }
    // eslint-disable-next-line
  }, [gameState, showScore, userId]);

  // Start or restart game
  const startGame = () => {
    // Stop end.ogg jika sedang main ulang
    if (endRef.current) {
      endRef.current.pause();
      endRef.current.currentTime = 0;
    }
    setGameState(GameState.Playing);
    setScore(0);
    setShowScore(0);
    birdY.current = HEIGHT / 2;
    velocity.current = 0;
    pipes.current = [];
    frame.current = 0;
    nextPipeId.current = 0;
    pipeSpeed.current = 2.5;
    startTime.current = Date.now();
  };

  // Audio refs
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const flapRef = useRef<HTMLAudioElement | null>(null); // ganti dari passRef
  const passRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLAudioElement | null>(null);

  // Play BGM on game start, stop on game over
  useEffect(() => {
    if (!bgmRef.current) return;
    if (gameState === GameState.Playing) {
      bgmRef.current.currentTime = 0;
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.5;
      bgmRef.current.play().catch(() => {});
    } else {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  }, [gameState]);

  // Play end SFX on game over
  useEffect(() => {
    if (gameState === GameState.GameOver && endRef.current) {
      endRef.current.currentTime = 0;
      endRef.current.play().catch(() => {});
    }
  }, [gameState]);

  // Play flap SFX on flap
  const playFlap = () => {
    if (flapRef.current) {
      flapRef.current.currentTime = 0;
      flapRef.current.play().catch(() => {});
    }
  };

  // Play pass SFX when passing a pipe
  const playPass = () => {
    if (passRef.current) {
      passRef.current.currentTime = 0;
      passRef.current.play().catch(() => {});
    }
  };

  // Modify flap handler to play flap SFX
  const flap = () => {
    if (gameState === GameState.Playing) {
      velocity.current = FLAP_POWER;
      playFlap();
    }
  };

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState === GameState.Ready && (e.code === "Space" || e.code === "ArrowUp")) {
        startGame();
      } else if (gameState === GameState.Playing && (e.code === "Space" || e.code === "ArrowUp")) {
        flap();
      } else if (gameState === GameState.GameOver && (e.code === "Space" || e.code === "ArrowUp")) {
        startGame();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameState]);

  // Touch controls
  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      if (typeof window === "undefined") return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (document.activeElement !== canvas) canvas.focus();
      const event = { code: "Space" } as KeyboardEvent;
      if (gameState === "ready") startGame();
      else if (gameState === "playing") flap();
      else if (gameState === "gameover") startGame();
    };
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("touchstart", handleTouch, { passive: false });
    }
    return () => {
      if (canvas) canvas.removeEventListener("touchstart", handleTouch);
    };
    // eslint-disable-next-line
  }, [gameState]);

  // Tambah ref untuk gambar burung
  const birdImgRef = useRef<HTMLImageElement | null>(null);

  // Load gambar burung saat mount
  useEffect(() => {
    const img = new window.Image();
    img.src = '/characters/bird.png';
    birdImgRef.current = img;
  }, []);

  // Tambah ref untuk gambar background
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  // Load gambar background saat mount
  useEffect(() => {
    const img = new window.Image();
    img.src = '/backgrounds/bg.png';
    bgImgRef.current = img;
  }, []);

  // Main game loop
  useEffect(() => {
    let animationId: number;
    let lastPipeTime = Date.now();

    const draw = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      if (bgImgRef.current && bgImgRef.current.complete) {
        // Draw background with 'contain' fit (no crop, no distorsi)
        const img = bgImgRef.current;
        const imgRatio = img.width / img.height;
        const canvasRatio = WIDTH / HEIGHT;
        let drawWidth = WIDTH;
        let drawHeight = HEIGHT;
        let offsetX = 0;
        let offsetY = 0;
        if (imgRatio > canvasRatio) {
          // Gambar lebih lebar dari canvas, fit lebar
          drawWidth = WIDTH;
          drawHeight = WIDTH / imgRatio;
          offsetY = (HEIGHT - drawHeight) / 2;
        } else {
          // Gambar lebih tinggi dari canvas, fit tinggi
          drawHeight = HEIGHT;
          drawWidth = HEIGHT * imgRatio;
          offsetX = (WIDTH - drawWidth) / 2;
        }
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      } else {
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      // Draw ground
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);

      // Draw pipes
      ctx.save();
      pipes.current.forEach((pipe) => {
        // Top pipe
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapY);
        ctx.fillStyle = COLORS.pipeDark;
        ctx.fillRect(pipe.x, pipe.gapY - 20, PIPE_WIDTH, 20);

        // Bottom pipe
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(pipe.x, pipe.gapY + PIPE_GAP, PIPE_WIDTH, HEIGHT - GROUND_HEIGHT - (pipe.gapY + PIPE_GAP));
        ctx.fillStyle = COLORS.pipeDark;
        ctx.fillRect(pipe.x, pipe.gapY + PIPE_GAP, PIPE_WIDTH, 20);
      });
      ctx.restore();

      // Draw bird
      if (birdImgRef.current && birdImgRef.current.complete) {
        ctx.drawImage(
          birdImgRef.current,
          WIDTH / 4 - BIRD_SIZE / 2,
          birdY.current - BIRD_SIZE / 2,
          BIRD_SIZE,
          BIRD_SIZE
        );
      } else {
        // fallback jika gambar belum siap
        ctx.save();
        ctx.beginPath();
        ctx.arc(WIDTH / 4, birdY.current, BIRD_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.bird;
        ctx.fill();
        ctx.strokeStyle = "#e6b800";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // Draw score
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${score}`, WIDTH / 2, 80);

      // Draw start/game over UI
      if (gameState === GameState.Ready) {
        ctx.fillStyle = COLORS.text;
        ctx.font = "bold 28px sans-serif";
        ctx.fillText("Flappy Bird", WIDTH / 2, HEIGHT / 2 - 40);
        ctx.font = "20px sans-serif";
        // Outline hitam untuk petunjuk kontrol
        ctx.save();
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 8; // lebih tebal
        ctx.strokeStyle = "#000";
        ctx.strokeText("Tekan [Space] atau [↑] untuk mulai", WIDTH / 2, HEIGHT / 2);
        ctx.fillStyle = "#fff";
        ctx.fillText("Tekan [Space] atau [↑] untuk mulai", WIDTH / 2, HEIGHT / 2);
        ctx.restore();
      } else if (gameState === GameState.GameOver) {
        // Game Over text: kuning extra bold dengan outline hitam
        ctx.save();
        ctx.font = "900 44px sans-serif"; // extra bold, lebih besar
        ctx.textAlign = "center";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#000";
        ctx.strokeText("Cina Skibidi!", WIDTH / 2, HEIGHT / 2 - 50);
        ctx.fillStyle = "#ffe600"; // kuning cerah
        ctx.fillText("Cina SKibidi!", WIDTH / 2, HEIGHT / 2 - 50);
        ctx.restore();
        // Skor dan petunjuk kontrol: putih bold + outline hitam
        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#000";
        ctx.strokeText(`Nomor Togel: ${showScore}`, WIDTH / 2, HEIGHT / 2);
        ctx.fillText(`Nomor Togel: ${showScore}`, WIDTH / 2, HEIGHT / 2);
        ctx.font = "bold 18px sans-serif";
        ctx.lineWidth = 4;
        ctx.strokeText("Tekan [Space] atau [↑] untuk main lagi", WIDTH / 2, HEIGHT / 2 + 40);
        ctx.fillText("Tekan [Space] atau [↑] untuk main lagi", WIDTH / 2, HEIGHT / 2 + 40);
        ctx.restore();
      }
    };

    // Game logic update
    const update = () => {
      if (gameState !== GameState.Playing) {
        draw();
        return;
      }

      // Bird physics
      velocity.current += GRAVITY;
      birdY.current += velocity.current;

      // Pipes logic
      const elapsedSec = (Date.now() - startTime.current) / 1000;
      pipeSpeed.current = 3.0 + 0.02 * elapsedSec;

      pipes.current.forEach((pipe) => {
        pipe.x -= pipeSpeed.current;
      });
      // Remove pipes out of screen
      pipes.current = pipes.current.filter((pipe) => pipe.x + PIPE_WIDTH > 0);

      // Add new pipe
      if (Date.now() - lastPipeTime > PIPE_INTERVAL) {
        const minGapY = 80;
        const maxGapY = HEIGHT - GROUND_HEIGHT - PIPE_GAP - 80;
        const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
        pipes.current.push({ x: WIDTH, gapY });
        lastPipeTime = Date.now();
      }

      // Collision detection
      // Ground
      if (birdY.current + BIRD_SIZE / 2 >= HEIGHT - GROUND_HEIGHT) {
        setGameState(GameState.GameOver);
        setShowScore(score);
        return;
      }
      // Ceiling
      if (birdY.current - BIRD_SIZE / 2 <= 0) {
        birdY.current = BIRD_SIZE / 2;
        velocity.current = 0;
      }
      // Pipes
      for (const pipe of pipes.current) {
        const birdX = WIDTH / 4;
        // Check horizontal collision
        if (
          birdX + BIRD_SIZE / 2 > pipe.x &&
          birdX - BIRD_SIZE / 2 < pipe.x + PIPE_WIDTH
        ) {
          // Check vertical collision
          if (
            birdY.current - BIRD_SIZE / 2 < pipe.gapY ||
            birdY.current + BIRD_SIZE / 2 > pipe.gapY + PIPE_GAP
          ) {
            setGameState(GameState.GameOver);
            setShowScore(score);
            return;
          }
        }
      }

      // Score: add when bird passes a pipe
      pipes.current.forEach((pipe) => {
        const birdX = WIDTH / 4;
        if (
          !("scored" in pipe) &&
          pipe.x + PIPE_WIDTH / 2 < birdX - pipeSpeed.current &&
          pipe.x + PIPE_WIDTH / 2 >= birdX - pipeSpeed.current - pipeSpeed.current
        ) {
          setScore((s) => s + 1);
          (pipe as any).scored = true;
          playPass();
        }
      });

      draw();
      frame.current++;
    };

    // Animation loop
    const loop = () => {
      update();
      animationId = requestAnimationFrame(loop);
    };

    if (gameState !== GameState.Ready) {
      animationId = requestAnimationFrame(loop);
    } else {
      draw();
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
    // eslint-disable-next-line
  }, [gameState, score]);

  // Draw once on mount
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }, []);

  const router = useRouter();

  if (!userId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#70c5ce",
        }}
      >
        <button
          style={{
            marginTop: 24,
            padding: "16px 32px",
            fontSize: 20,
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => router.push("/auth")}
        >
          Login untuk Main
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#70c5ce",
      }}
    >
      <div style={{ marginBottom: 16, fontWeight: "bold", color: "#2563eb", fontSize: 22 }}>
        Nomor Togel Barokah: {highScore ?? "-"}
      </div>
      {isMultiplayer && (
        <div style={{ 
          marginBottom: 16, 
          padding: "8px 16px", 
          background: "#e3f2fd", 
          borderRadius: 8,
          border: "1px solid #2196f3"
        }}>
          <strong>Multiplayer Mode</strong> - {players.length} pemain
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{
          width: WIDTH,
          height: HEIGHT,
          borderRadius: 24,
          background: "#fff", // putih flat
          boxShadow: "0 4px 32px #0002",
          display: "block",
          margin: "0 auto",
          touchAction: "manipulation",
        }}
        tabIndex={0}
      />
      {isMobile && (
        <div style={{ marginTop: 10, color: "#2563eb", fontWeight: 500, fontSize: 16 }}>
          Ketuk layar untuk {gameState === "ready" ? "mulai" : gameState === "gameover" ? "main lagi" : "terbang"}
        </div>
      )}
      {gameState === GameState.Ready && (
        <button
          style={{
            marginTop: 24,
            padding: "16px 32px",
            fontSize: 20,
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            fontWeight: "bold",
            border: "none",
            cursor: "pointer",
          }}
          onClick={startGame}
        >
          Start
        </button>
      )}
      {scoreHistory.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 16, color: "#555" }}>
          Riwayat Skor: {scoreHistory.slice(0, 5).join(", ")}
        </div>
      )}
      <button
        style={{
          marginTop: 32,
          padding: "12px 32px",
          fontSize: 18,
          borderRadius: 8,
          background: "#2563eb",
          color: "#fff",
          fontWeight: "bold",
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => router.push("/lobby")}
      >
        Kembali ke Lobby
      </button>
      <audio ref={bgmRef} src="/audio/bgmusic.ogg" preload="auto" />
      <audio ref={flapRef} src="/audio/flap.ogg" preload="auto" />
      <audio ref={passRef} src="/audio/pass.ogg" preload="auto" />
      <audio ref={endRef} src="/audio/end.ogg" preload="auto" />
    </div>
  );
} 