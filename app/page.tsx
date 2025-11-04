'use client';

import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-rh-dark">
      <Header />
      <ChatInterface />
    </div>
  );
}
