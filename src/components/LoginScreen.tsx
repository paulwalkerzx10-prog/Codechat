import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateCode } from '../lib/utils';
import { Shield, Lock, User as UserIcon, Loader2, MessageSquare } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (code: string) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loginCode, setLoginCode] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin && (!loginCode.trim() || !password.trim())) {
      setError("Please enter your connection code and password.");
      return;
    }
    
    if (!isLogin && (!displayName.trim() || !password.trim())) {
      setError("Please enter a display name and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Login Flow
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('code', loginCode.trim().toUpperCase())
          .eq('password', password)
          .single();
          
        if (fetchError) {
           if (fetchError.code === 'PGRST116') {
             setError("Invalid connection code or password.");
           } else if (fetchError.message?.toLowerCase().includes('schema cache') || fetchError.message?.includes('column "password" does not exist')) {
             setError("Database requires an update. Please run: ALTER TABLE public.users ADD COLUMN password text;");
           } else {
             setError(fetchError.message);
           }
           setLoading(false);
           return;
        }
        
        if (data) {
           onLoginSuccess(data.code);
        }
      } else {
        // Sign Up Flow
        // Generate unused connection code
        let newCode = generateCode();
        let isTaken = true;
        while (isTaken) {
          const { data: checkCodeSnap, error: codeCheckError } = await supabase.from('users').select('code').eq('code', newCode).single();
          if (codeCheckError && codeCheckError.code !== 'PGRST116') {
             throw codeCheckError;
          }
          if (!checkCodeSnap) {
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
          display_name: displayName.trim(),
          password: password,
          accent_color: 'violet',
          pattern_enabled: true,
          pattern_style: 'dots'
        };

        const { error: insertError } = await supabase.from('users').insert([newUser]);
        if (insertError) {
           if (insertError.message?.toLowerCase().includes('schema cache') || insertError.message?.includes('column "password" does not exist')) {
             setError("Database requires an update. Please run: ALTER TABLE public.users ADD COLUMN password text;");
           } else {
             setError(insertError.message);
           }
           setLoading(false);
           return;
        }

        onLoginSuccess(newCode);
      }
    } catch (err: any) {
       console.error("Auth error", err);
       setError(err.message || "An error occurred.");
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#3b2774] to-[#1a103c] text-white font-sans p-6 text-center">
      <div className="flex-1 flex flex-col justify-center items-center max-w-md w-full">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center -rotate-3 mb-6 shadow-2xl relative">
           <MessageSquare className="w-10 h-10 text-violet-600 absolute stroke-[1.5]" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2 tracking-tight">CodeChat</h1>
        <p className="text-violet-200 text-sm mb-8 max-w-xs px-4">
          Private conversations. Log in or create an account to get your connection code.
        </p>

        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex w-full mb-6 relative bg-black/20 p-1 rounded-xl">
            <button 
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors z-10 ${isLogin ? 'bg-violet-600 shadow-md text-white' : 'text-violet-200 hover:text-white'}`}
              onClick={() => { setIsLogin(true); setError(null); }}
            >
              Sign In
            </button>
            <button 
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors z-10 ${!isLogin ? 'bg-violet-600 shadow-md text-white' : 'text-violet-200 hover:text-white'}`}
              onClick={() => { setIsLogin(false); setError(null); }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            {isLogin ? (
              <div>
                <label className="block text-sm font-medium text-violet-200 mb-1 ml-1" htmlFor="loginCode">Connection Code</label>
                <div className="relative">
                   <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400" />
                   <input 
                     id="loginCode"
                     type="text" 
                     value={loginCode}
                     onChange={e => setLoginCode(e.target.value)}
                     maxLength={6}
                     className="w-full bg-black/20 border border-white/10 text-white placeholder-violet-300/50 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all uppercase"
                     placeholder="e.g. ABCDEF"
                   />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-violet-200 mb-1 ml-1" htmlFor="displayName">Display Name</label>
                <div className="relative">
                   <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400" />
                   <input 
                     id="displayName"
                     type="text" 
                     value={displayName}
                     onChange={e => setDisplayName(e.target.value)}
                     className="w-full bg-black/20 border border-white/10 text-white placeholder-violet-300/50 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                     placeholder="What should we call you?"
                   />
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-violet-200 mb-1 ml-1" htmlFor="password">Password</label>
              <div className="relative">
                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-400" />
                 <input 
                   id="password"
                   type="password" 
                   value={password}
                   onChange={e => setPassword(e.target.value)}
                   className="w-full bg-black/20 border border-white/10 text-white placeholder-violet-300/50 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                   placeholder="Your secret key"
                 />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-sm mt-2 flex items-start gap-2">
                <Shield className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                <span className="break-words w-full">{error}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold shadow-lg transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isLogin ? "Sign In" : "Sign Up & Get Code"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
