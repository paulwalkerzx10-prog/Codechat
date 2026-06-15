import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { generateCode } from './lib/utils';
import { MainLayout } from './components/MainLayout';
import { Loader2, MessageSquare, Shield, Lock, User as UserIcon } from 'lucide-react';
import { User } from './lib/types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // If we have a code, we can auto-start
    const existingCode = localStorage.getItem('relay_code');
    if (existingCode) {
      setHasStarted(false); // Wait for auth state
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;

    const initAuth = async (fbUser: FirebaseUser) => {
      try {
        let code = localStorage.getItem('relay_code');
        let resolvedCode = '';
        
        if (code) {
          const userSnap = await getDoc(doc(db, 'users', code));
          if (userSnap.exists() && userSnap.data().uid === fbUser.uid) {
            resolvedCode = code;
          }
        } 
        
        if (!resolvedCode) {
          const q = query(collection(db, 'users'), where('uid', '==', fbUser.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            resolvedCode = querySnapshot.docs[0].id;
            localStorage.setItem('relay_code', resolvedCode);
          }
        }

        if (!resolvedCode) {
          let newCode = code || generateCode();
          let isTaken = true;
          
          while (isTaken) {
            const checkSnap = await getDoc(doc(db, 'users', newCode));
            if (!checkSnap.exists()) {
              isTaken = false;
            } else {
              newCode = generateCode();
            }
          }

          const newUser: User = {
            uid: fbUser.uid,
            code: newCode,
            displayName: fbUser.displayName || '',
            createdAt: serverTimestamp(),
            accentColor: 'violet',
            patternEnabled: true,
            patternStyle: 'dots'
          };

          await setDoc(doc(db, 'users', newCode), newUser);
          resolvedCode = newCode;
          localStorage.setItem('relay_code', newCode);
        }

        if (unsubUserDoc) {
          unsubUserDoc();
        }

        unsubUserDoc = onSnapshot(doc(db, 'users', resolvedCode), (snapshot) => {
          if (snapshot.exists()) {
            setUser(snapshot.data() as User);
          }
          setLoading(false);
          setHasStarted(true);
        }, (error) => {
          console.error("User doc subscription error:", error);
          setError("Failed to subscribe to user updates.");
          setLoading(false);
        });

      } catch (err: any) {
        console.error("Auth init error", err);
        setError("Failed to initialize user session.");
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        initAuth(fbUser);
      } else {
        if (unsubUserDoc) {
          unsubUserDoc();
          unsubUserDoc = null;
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthHint(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Sign in failed", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthHint("Sign in was cancelled. You may need to click 'Sign in with Google' again or open the app in a new tab if popups are blocked.");
        setError(null);
      } else if (err.code === 'auth/popup-blocked') {
        setAuthHint("Your browser blocked the sign-in popup. Please open the app in a new tab or allow popups.");
        setError(null);
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
      setLoading(false);
    }
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
            onClick={handleGoogleSignIn} 
            className="w-full py-4 bg-violet-500 hover:bg-violet-400 text-white rounded-2xl font-semibold shadow-lg transition-all"
          >
            Sign in with Google
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
