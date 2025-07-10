# Flappy Lobby

Aplikasi lobby multiplayer sederhana berbasis Next.js dan Supabase.

## Fitur
- Lobby realtime: buat/join room
- Integrasi Supabase Auth & Database
- Siap deploy ke Vercel

## Environment Variables
Buat file `.env.local` di root dengan:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Menjalankan Lokal
```
npm install
npm run dev
```

## Deploy
- Deploy mudah ke [Vercel](https://vercel.com/)
- Pastikan environment variable diatur di dashboard Vercel

## Struktur
- `src/app/` — halaman utama
- `pages/` — lobby & game
- `components/` — komponen UI
- `lib/` — utilitas Supabase
