import React, { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const WIDTH = 400;
const HEIGHT = 600;
const GROUND_HEIGHT = 100;
const BIRD_SIZE = 32;
const PIPE_WIDTH = 60;
const PIPE_GAP = 140;
const GRAVITY = 0.5;
const FLAP_POWER = -8;
const PIPE_INTERVAL = 1500; // ms
const PIPE_SPEED = 2.5;

type Pipe = {
  x: number;
  gapY: number;
  scored?: boolean;
};

type Player = {
  id: string;
  user_id: string;
  room_id: string;
  username: string;
  is_owner: boolean;
  joined_at: string;
};

type Bird = {
  y: number;
  velocity: number;
  color: string;
  isAlive: boolean;
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
  bird2: "#ff6b6b",
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
  const birds = useRef<Bird[]>([]);
  const pipes = useRef<Pipe[]>([]);
  const frame = useRef(0);
  const lastPipeTime = useRef(Date.now());
  const animationId = useRef<number | null>(null);

  // For collision/game over
  const [showScore, setShowScore] = useState(0);

  // Deteksi mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 700 || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent));
  }, []);

  // Initialize birds based on multiplayer or solo
  useEffect(() => {
    if (isMultiplayer && players.length >= 2) {
      // Two birds for multiplayer
      birds.current = [
        { y: HEIGHT / 2, velocity: 0, color: COLORS.bird, isAlive: true },
        { y: HEIGHT / 2, velocity: 0, color: COLORS.bird2, isAlive: true }
      ];
    } else {
      // Single bird for solo
      birds.current = [
        { y: HEIGHT / 2, velocity: 0, color: COLORS.bird, isAlive: true }
      ];
    }
  }, [isMultiplayer, players]);

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
  const startGame = useCallback(() => {
    setGameState(GameState.Playing);
    setScore(0);
    setShowScore(0);
    birds.current.forEach(bird => {
      bird.y = HEIGHT / 2;
      bird.velocity = 0;
      bird.isAlive = true;
    });
    pipes.current = [];
    frame.current = 0;
    lastPipeTime.current = Date.now();
  }, []);

  // Flap handler
  const flap = useCallback((birdIndex: number = 0) => {
    if (gameState === GameState.Playing && birds.current[birdIndex]?.isAlive) {
      birds.current[birdIndex].velocity = FLAP_POWER;
    }
  }, [gameState]);

  // Improved collision detection
  const checkCollision = useCallback((bird: Bird, birdX: number, pipe: Pipe): boolean => {
    const birdLeft = birdX - BIRD_SIZE / 2;
    const birdRight = birdX + BIRD_SIZE / 2;
    const birdTop = bird.y - BIRD_SIZE / 2;
    const birdBottom = bird.y + BIRD_SIZE / 2;
    
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + PIPE_WIDTH;
    const pipeGapTop = pipe.gapY;
    const pipeGapBottom = pipe.gapY + PIPE_GAP;
    
    // Check horizontal collision
    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      // Check vertical collision with top pipe
      if (birdTop < pipeGapTop) {
        return true;
      }
      // Check vertical collision with bottom pipe
      if (birdBottom > pipeGapBottom) {
        return true;
      }
    }
    
    return false;
  }, []);

  // Improved score detection
  const checkScore = useCallback((bird: Bird, birdX: number, pipe: Pipe): boolean => {
    if (pipe.scored) return false;
    
    // Check if bird has passed the pipe
    const birdCenterX = birdX;
    const pipeCenterX = pipe.x + PIPE_WIDTH / 2;
    
    // Bird has passed the pipe if it's slightly past the pipe center
    return birdCenterX > pipeCenterX + 5;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState === GameState.Ready && (e.code === "Space" || e.code === "ArrowUp")) {
        startGame();
      } else if (gameState === GameState.Playing) {
        if (e.code === "Space" || e.code === "ArrowUp") {
          flap(0); // First bird
        } else if (e.code === "KeyW" || e.code === "ArrowLeft") {
          flap(1); // Second bird (if multiplayer)
        }
      } else if (gameState === GameState.GameOver && (e.code === "Space" || e.code === "ArrowUp")) {
        startGame();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameState, startGame, flap]);

  // Touch controls
  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      if (typeof window === "undefined") return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (document.activeElement !== canvas) canvas.focus();
      
      if (gameState === "ready") startGame();
      else if (gameState === "playing") {
        // Touch left side for first bird, right side for second bird
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        if (x < canvas.width / 2) {
          flap(0);
        } else {
          flap(1);
        }
      }
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
  }, [gameState, startGame, flap]);

  // Main game loop
  useEffect(() => {
    const draw = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      // Clear
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

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

      // Draw birds
      ctx.save();
      birds.current.forEach((bird, index) => {
        if (!bird.isAlive) return;
        
        ctx.beginPath();
        const x = WIDTH / 4 + (index * 50); // Offset second bird
        ctx.arc(x, bird.y, BIRD_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = bird.color;
        ctx.fill();
        ctx.strokeStyle = "#e6b800";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw player name above bird
        if (isMultiplayer && players[index]) {
          ctx.fillStyle = COLORS.text;
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(players[index].username, x, bird.y - BIRD_SIZE / 2 - 10);
        }
      });
      ctx.restore();

      // Draw score
      ctx.fillStyle = COLORS.text;
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${score}`, WIDTH / 2, 80);

      // Draw controls info for multiplayer
      if (isMultiplayer && gameState === GameState.Ready) {
        ctx.fillStyle = COLORS.text;
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Player 1: Space/↑ | Player 2: W/←", WIDTH / 2, HEIGHT - 60);
      }

      // Draw start/game over UI
      if (gameState === GameState.Ready) {
        ctx.fillStyle = COLORS.text;
        ctx.font = "bold 28px sans-serif";
        ctx.fillText("Flappy Bird", WIDTH / 2, HEIGHT / 2 - 40);
        ctx.font = "20px sans-serif";
        ctx.fillText("Tekan [Space] atau [↑] untuk mulai", WIDTH / 2, HEIGHT / 2);
      } else if (gameState === GameState.GameOver) {
        ctx.fillStyle = COLORS.text;
        ctx.font = "bold 32px sans-serif";
        ctx.fillText("Game Over", WIDTH / 2, HEIGHT / 2 - 40);
        ctx.font = "20px sans-serif";
        ctx.fillText(`Skor: ${showScore}`, WIDTH / 2, HEIGHT / 2);
        ctx.font = "18px sans-serif";
        ctx.fillText("Tekan [Space] atau [↑] untuk main lagi", WIDTH / 2, HEIGHT / 2 + 40);
      }
    };

    // Game logic update
    const update = () => {
      if (gameState !== GameState.Playing) {
        draw();
        return;
      }

      // Birds physics
      birds.current.forEach(bird => {
        if (!bird.isAlive) return;
        bird.velocity += GRAVITY;
        bird.y += bird.velocity;
      });

      // Pipes logic
      pipes.current.forEach((pipe) => {
        pipe.x -= PIPE_SPEED;
      });
      // Remove pipes out of screen
      pipes.current = pipes.current.filter((pipe) => pipe.x + PIPE_WIDTH > -50);

      // Add new pipe
      if (Date.now() - lastPipeTime.current > PIPE_INTERVAL) {
        const minGapY = 80;
        const maxGapY = HEIGHT - GROUND_HEIGHT - PIPE_GAP - 80;
        const gapY = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
        pipes.current.push({ x: WIDTH, gapY });
        lastPipeTime.current = Date.now();
      }

      // Collision detection and scoring
      let allBirdsDead = true;
      let scoreIncrement = 0;
      
      birds.current.forEach((bird, index) => {
        if (!bird.isAlive) return;
        
        const birdX = WIDTH / 4 + (index * 50);
        
        // Ground collision
        if (bird.y + BIRD_SIZE / 2 >= HEIGHT - GROUND_HEIGHT) {
          bird.isAlive = false;
          return;
        }
        
        // Ceiling collision
        if (bird.y - BIRD_SIZE / 2 <= 0) {
          bird.y = BIRD_SIZE / 2;
          bird.velocity = 0;
        }
        
        // Pipe collision and scoring
        for (const pipe of pipes.current) {
          // Check collision
          if (checkCollision(bird, birdX, pipe)) {
            bird.isAlive = false;
            return;
          }
          
          // Check scoring
          if (checkScore(bird, birdX, pipe)) {
            pipe.scored = true;
            scoreIncrement++;
          }
        }
        
        if (bird.isAlive) allBirdsDead = false;
      });

      // Update score
      if (scoreIncrement > 0) {
        setScore(prev => prev + scoreIncrement);
      }

      // Game over if all birds are dead
      if (allBirdsDead) {
        setGameState(GameState.GameOver);
        setShowScore(score);
        return;
      }

      draw();
      frame.current++;
    };

    // Animation loop
    const loop = () => {
      update();
      animationId.current = requestAnimationFrame(loop);
    };

    if (gameState !== GameState.Ready) {
      animationId.current = requestAnimationFrame(loop);
    } else {
      draw();
    }

    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
    };
    // eslint-disable-next-line
  }, [gameState, score, isMultiplayer, players, checkCollision, checkScore]);

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
        Skor Tertinggi: {highScore ?? "-"}
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
          border: "3px solid #2563eb",
          background: "#70c5ce",
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
    </div>
  );
} 