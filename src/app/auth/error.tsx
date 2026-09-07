'use client';

import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

// Shown when a page under /auth throws (e.g. the API returned a 500 / the DB
// dropped a connection). Deliberately distinct from the not-found page — this
// says "try again", not "it's gone".
export default function AuthError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="rsu-card w-full max-w-sm text-center">
        <FaExclamationTriangle className="w-6 h-6 text-amber-500 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-gray-900">Couldn’t load this page</h1>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Something went wrong on our end — this isn’t a missing page. Give it another try.
        </p>
        <button type="button" onClick={reset} className="rsu-btn-primary w-full">
          Try again
        </button>
      </div>
    </div>
  );
}
