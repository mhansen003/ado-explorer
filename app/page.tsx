'use client';

import ChatModeWrapper from '@/components/ChatModeWrapper';
import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-rh-dark">
      <Header />
      <ChatModeWrapper />
    </div>
  );
}
