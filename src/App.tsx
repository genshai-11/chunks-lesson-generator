/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { AlertCircle, X } from 'lucide-react';

function QuotaErrorBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleQuotaError = () => setShow(true);
    window.addEventListener('firestore-quota-exceeded', handleQuotaError);
    return () => window.removeEventListener('firestore-quota-exceeded', handleQuotaError);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-2xl animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-amber-600 text-white p-4 rounded-xl shadow-2xl flex items-start gap-4 border border-white/20">
        <div className="shrink-0 p-2 bg-white/20 rounded-lg">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg mb-1">Firestore Quota Reached</h3>
          <p className="text-amber-50 text-sm leading-relaxed">
            The app's search/read limit has been reached for today. New items may not show up until tomorrow.
            <br />
            <span className="opacity-70 text-xs italic">Usually resets at midnight US Pacific Time.</span>
          </p>
        </div>
        <button 
          onClick={() => setShow(false)}
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <QuotaErrorBanner />
      {user ? <Dashboard /> : <Auth />}
    </>
  );
}
