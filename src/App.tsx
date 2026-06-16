import React, { useEffect, useState } from 'react';
import { supabase, supabaseValidationError } from './lib/supabase';
import { MainLayout } from './components/MainLayout';
import { Loader2 } from 'lucide-react';
import { User } from './lib/types';
import { LoginScreen } from './components/LoginScreen';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(supabaseValidationError);
  const [hasStarted, setHasStarted] = useState(false);
  const isSupabaseConfigured = Boolean(!supabaseValidationError);

  useEffect(() => {
    const existingCode = localStorage.getItem('relay_code');
    if (existingCode && isSupabaseConfigured) {
      setHasStarted(true);
    } else {
      setLoading(false);
    }
  }, [isSupabaseConfigured]);

  useEffect(() => {
    let subscription: any = null;

    const initAuth = async () => {
      if (!hasStarted) return;
      if (supabaseValidationError) {
        setError(supabaseValidationError);
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        let code = localStorage.getItem('relay_code');
        
        if (!code) {
           setHasStarted(false);
           setLoading(false);
           return;
        }

        // Subscribe to user updates
        const channelId = `public:users:code=eq.${code}-${Date.now()}`;
        subscription = supabase.channel(channelId)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `code=eq.${code}` }, payload => {
            if (payload.new) {
              const u = payload.new as any;
              setUser({
                uid: u.uid,
                code: u.code,
                displayName: u.display_name,
                createdAt: u.created_at,
                accentColor: u.accent_color,
                patternEnabled: u.pattern_enabled,
                patternStyle: u.pattern_style
              });
            }
          })
          .subscribe();

        // Initial fetch
        const { data: u, error: initFetchError } = await supabase.from('users').select('*').eq('code', code).single();
        if (initFetchError) {
          if (initFetchError.code === 'PGRST116') {
             // Not found
             localStorage.removeItem('relay_code');
             setHasStarted(false);
             setLoading(false);
             return;
          }
          throw initFetchError;
        }
        
        if (u) {
          setUser({
            uid: u.uid,
            code: u.code,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            createdAt: u.created_at,
            accentColor: u.accent_color,
            patternEnabled: u.pattern_enabled,
            patternStyle: u.pattern_style
          });
        } else {
           localStorage.removeItem('relay_code');
           setHasStarted(false);
        }

        setLoading(false);

      } catch (err: any) {
        console.error("Auth init error", err);
        setError(err.message || "Failed to initialize user session.");
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [hasStarted]);

  const handleLoginSuccess = (newCode: string) => {
    localStorage.setItem('relay_code', newCode);
    setHasStarted(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('relay_code');
    setUser(null);
    setHasStarted(false);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#3b2774] to-[#1a103c] text-white font-sans p-6">
        <div className="text-center bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-md w-full border border-white/20">
          <p className="text-red-400 font-medium mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-colors font-medium">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-violet-50 text-violet-600 font-sans">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="font-medium">Loading your secure environment...</p>
      </div>
    );
  }

  return <MainLayout currentUser={user} onLogout={handleLogout} />;
}
