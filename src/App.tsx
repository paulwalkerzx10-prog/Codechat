import React, { useEffect, useState } from 'react';
import { supabase, supabaseValidationError } from './lib/supabase';
import { generateCode } from './lib/utils';
import { MainLayout } from './components/MainLayout';
import { Loader2, MessageSquare, Shield, Lock, User as UserIcon } from 'lucide-react';
import { User } from './lib/types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(supabaseValidationError);
  const [authHint, setAuthHint] = useState<string | null>(null);
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
        let resolvedCode = '';
        
        if (code) {
          const { data: userSnap, error: fetchError } = await supabase.from('users').select('*').eq('code', code).single();
          if (fetchError && fetchError.code !== 'PGRST116') {
             throw fetchError;
          }
          if (userSnap) {
            resolvedCode = code;
          }
        } 
        
        if (!resolvedCode) {
          let newCode = code || generateCode();
          let isTaken = true;
          
          while (isTaken) {
            const { data: checkSnap, error: checkError } = await supabase.from('users').select('code').eq('code', newCode).single();
            if (checkError && checkError.code !== 'PGRST116') {
               throw checkError;
            }
            if (!checkSnap) {
              isTaken = false;
            } else {
              newCode = generateCode();
            }
          }

          const fallbackUid = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              });

          const newUser = {
            uid: fallbackUid,
            code: newCode,
            display_name: `User ${newCode}`,
            accent_color: 'violet',
            pattern_enabled: true,
            pattern_style: 'dots'
          };

          const { error: insertError } = await supabase.from('users').insert([newUser]);
          if (insertError) throw insertError;
          
          resolvedCode = newCode;
          localStorage.setItem('relay_code', newCode);
        }

        // Subscribe to user updates
        const channelId = `public:users:code=eq.${resolvedCode}-${Date.now()}`;
        subscription = supabase.channel(channelId)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `code=eq.${resolvedCode}` }, payload => {
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
        const { data: u, error: initFetchError } = await supabase.from('users').select('*').eq('code', resolvedCode).single();
        if (initFetchError) throw initFetchError;
        
        if (u) {
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

  const handleStart = () => {
    setHasStarted(true);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-violet-50 text-violet-900 font-sans">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full mx-4">
          <p className="text-red-500 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full px-4 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#3b2774] to-[#1a103c] text-white font-sans p-6 text-center">
        <div className="flex-1 flex flex-col justify-center items-center max-w-md w-full">
          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center -rotate-3 mb-8 shadow-2xl relative">
             <MessageSquare className="w-14 h-14 text-violet-600 absolute stroke-[1.5]" />
             <span className="text-violet-600 text-4xl font-black z-10 -ml-1 mt-1">#</span>
          </div>
          
          <h1 className="text-4xl font-bold mb-4 tracking-tight">CodeChat</h1>
          <p className="text-violet-200 text-lg mb-10 max-w-xs">
            Private conversations.<br />No phone number. No email.<br />Just your code.
          </p>

          <div className="space-y-6 text-left w-full mb-12">
            <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-violet-300" />
               </div>
               <div>
                 <h3 className="font-semibold text-white">Connect with User Codes</h3>
                 <p className="text-sm text-violet-200/80">Add people using their unique user code.</p>
               </div>
            </div>
            <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-violet-300" />
               </div>
               <div>
                 <h3 className="font-semibold text-white">Private & Secure</h3>
                 <p className="text-sm text-violet-200/80">End-to-end encrypted conversations.</p>
               </div>
            </div>
            <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-violet-300" />
               </div>
               <div>
                 <h3 className="font-semibold text-white">You're in Control</h3>
                 <p className="text-sm text-violet-200/80">No personal info shared. Ever.</p>
               </div>
            </div>
          </div>

          {authHint && (
            <div className="w-full bg-orange-500/10 border border-orange-500/20 text-orange-200 p-4 rounded-xl mb-6 text-sm text-left flex items-start gap-3">
              <Shield className="w-5 h-5 flex-shrink-0 mt-0.5 text-orange-400" />
              <p>{authHint}</p>
            </div>
          )}

          <button 
            onClick={handleStart} 
            className="w-full py-4 bg-violet-500 hover:bg-violet-400 text-white rounded-2xl font-semibold shadow-lg transition-all"
          >
            Start Connection
          </button>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-violet-50 text-violet-600 font-sans">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="font-medium">Loading your secure environment...</p>
      </div>
    );
  }

  return <MainLayout currentUser={user} />;
}
