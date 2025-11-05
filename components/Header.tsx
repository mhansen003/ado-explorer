'use client';

import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { VERSION } from '@/lib/version';
import ChangelogModal from './ChangelogModal';

export default function Header() {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 border-b border-rh-border bg-rh-dark">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rh-green flex items-center justify-center">
            <Search className="w-6 h-6 text-rh-dark" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-rh-text">ADO Explorer</h1>
            <p className="text-xs text-rh-text-secondary">Next-gen Azure DevOps browser</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-lg bg-rh-card border border-rh-border text-xs text-rh-text-secondary">
            Press <kbd className="px-1.5 py-0.5 bg-rh-dark rounded text-rh-green">/</kbd> for commands
          </div>

          {/* Version Badge */}
          <button
            onClick={() => setShowChangelog(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rh-green/10 border border-rh-green/30 text-xs font-medium text-rh-green hover:bg-rh-green/20 transition-colors group"
          >
            <Sparkles className="w-3.5 h-3.5 group-hover:animate-pulse" />
            {VERSION}
          </button>
        </div>
      </header>

      {/* Changelog Modal */}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </>
  );
}
