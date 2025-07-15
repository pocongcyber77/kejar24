import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-yellow-100 to-blue-200 p-6">
      <div className="bg-white/80 rounded-3xl shadow-xl px-8 py-10 flex flex-col items-center max-w-md w-full">
        <div className="mb-4">
          {/* Ilustrasi/ikon Kuyang bertema Cina, bisa diganti dengan <img src="/characters/bird.png" ... /> jika ada */}
          <span style={{fontSize: 64, display: 'block'}}>🧟‍♀️</span>
        </div>
        <h1 className="text-4xl font-extrabold text-yellow-500 mb-2 drop-shadow-lg text-center" style={{letterSpacing: 2}}>
          Kuyang Cina!!
        </h1>
        <p className="text-lg text-gray-700 mb-6 text-center max-w-xs">
          Wakomting Tekdus berubah jadi <span className="font-bold text-red-500">KUYANG</span> Cina!!😱 Terbang, hindari pipa pabrik garam cina, dan raih nomor togel. Mainkan sendiri atau bareng ayank (sek durung iso)!
        </p>
        <Link href="/game?mode=solo">
          <button className="bg-gradient-to-r from-yellow-400 to-red-400 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:scale-105 hover:from-yellow-500 hover:to-red-500 transition-all text-xl">
            Mulai Main
          </button>
        </Link>
      </div>
      <div className="mt-10 text-gray-400 text-sm">&copy; 2024 Kuyang Cina!!</div>
    </div>
  );
}
