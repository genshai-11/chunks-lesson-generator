import React from 'react';
import { signInWithGoogle } from '../firebase';
import { LogIn } from 'lucide-react';

export default function Auth() {
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
        <button
          onClick={signInWithGoogle}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
        >
          <span className="absolute left-0 inset-y-0 flex items-center pl-3">
            <LogIn className="h-5 w-5 text-red-500 group-hover:text-red-400" aria-hidden="true" />
          </span>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
