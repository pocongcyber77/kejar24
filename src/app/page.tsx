import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to Flappy Lobby!</h1>
      <Link href="/lobby">
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition">Go to Lobby</button>
      </Link>
    </div>
  );
}
