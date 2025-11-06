'use client';

import ConversationalChat from '@/components/ConversationalChat';
import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-rh-dark">
      <Header />
      <ConversationalChat />
    </div>
  );
}
