import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { usePathname } from "next/navigation";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kuyang Cina!!",
  description: "Game Flappy bertema Kuyang dan nuansa Cina!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>Kuyang Cina!!</title>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav style={{
          width: '100%',
          background: '#2563eb',
          color: '#fff',
          padding: '16px 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 32,
          fontWeight: 600,
          fontSize: 18,
          boxShadow: '0 2px 8px #0001',
          marginBottom: 24,
        }}>
          <a href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</a>
          <a href="/game?mode=solo" style={{ color: '#fff', textDecoration: 'none' }}>Game</a>
        </nav>
        {children}
        <footer style={{
          width: '100%',
          background: '#f3f4f6',
          color: '#222',
          padding: '18px 0',
          textAlign: 'center',
          fontSize: 16,
          marginTop: 48,
          borderTop: '1px solid #e5e7eb',
        }}>
          © {new Date().getFullYear()} Flappy Lobby &middot; <a href="https://github.com/benjaminflappy/flappy" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', marginLeft: 8 }}>GitHub</a>
        </footer>
      </body>
    </html>
  );
}
