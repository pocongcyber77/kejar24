"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    let result;
    if (isLogin) {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }
    setLoading(false);
    if (result.error) setError(result.error.message);
    else router.push('/lobby');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>{isLogin ? 'Login' : 'Register'}</h1>
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button type="submit" disabled={loading} style={{ padding: 10, borderRadius: 4, background: '#2563eb', color: 'white', fontWeight: 'bold' }}>
          {loading ? (isLogin ? 'Logging in...' : 'Registering...') : (isLogin ? 'Login' : 'Register')}
        </button>
        <button type="button" onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', color: '#2563eb', border: 'none', marginTop: 8 }}>
          {isLogin ? 'Belum punya akun? Register' : 'Sudah punya akun? Login'}
        </button>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </form>
    </div>
  );
};

export default AuthPage; 