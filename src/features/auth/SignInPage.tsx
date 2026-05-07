import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../app/firebase';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="max-w-md space-y-8">
        <h1 className="font-serif text-6xl tracking-tight text-text sm:text-7xl">
          Listen <br /> Together
        </h1>
        <p className="font-mono text-sm uppercase tracking-widest text-text-3">
          Synchronized music for friend circles
        </p>
        
        <div className="pt-8">
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="group relative flex w-full items-center justify-center gap-3 border border-rule bg-bg-2 px-8 py-4 transition-all hover:bg-bg-3 disabled:opacity-50"
          >
            {loading ? (
              <span className="font-mono text-xs uppercase animate-pulse">Connecting...</span>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                  />
                </svg>
                <span className="font-sans font-medium">Continue with Google</span>
              </>
            )}
            <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>
      </div>
      
      <footer className="absolute bottom-8 font-mono text-[10px] uppercase tracking-tighter text-text-3">
        Permanently Free · No Backend · Open Source
      </footer>
    </div>
  );
}
