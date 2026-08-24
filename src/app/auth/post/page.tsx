import React from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { getCurrentUser } from '@/lib/session';
import PostTripForm from './PostTripForm';

export default async function PostTripPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header active="post" />
      <main className="app-desktop w-full pt-2 md:pt-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Post a Trip</h1>
          <p className="text-sm text-gray-500 mt-0.5">Share your ride with the university community</p>
        </div>
        {user ? <PostTripForm hostId={user.id} /> : <p className="text-sm text-gray-500">Sign in to post a trip.</p>}
      </main>
      <BottomNav active="post" />
    </div>
  );
}
