import React, { useState } from 'react';
import { signInWithGoogle } from '../firebase';
import { AlertTriangle, LogIn, Loader2 } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorHost, setErrorHost] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    setErrorHost(null);

    const result = await signInWithGoogle();

    if (!result.ok) {
      setErrorMessage(result.message || 'Failed to sign in with Google.');
      setErrorHost(result.host || null);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg text-center">
        <div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Welcome to CHUNKS
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Dynamic Audio Lesson Engine
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-amber-900">Google sign-in could not start</p>
                <p className="text-sm text-amber-800">{errorMessage}</p>
                {errorHost && (
                  <div className="rounded bg-white/70 border border-amber-200 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide font-bold text-amber-700">Current host</p>
                    <p className="text-sm font-mono text-amber-900 break-all">{errorHost}</p>
                  </div>
                )}
                <p className="text-xs text-amber-700">
                  Fix in Firebase Console → Authentication → Settings → Authorized domains.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed"
        >
          <span className="absolute left-0 inset-y-0 flex items-center pl-3">
            {loading ? (
              <Loader2 className="h-5 w-5 text-red-200 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="h-5 w-5 text-red-500 group-hover:text-red-400" aria-hidden="true" />
            )}
          </span>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}
