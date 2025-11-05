'use client';

import { X, Sparkles, TrendingUp, Wrench } from 'lucide-react';
import { CHANGELOG, ChangelogEntry } from '@/lib/version';

interface ChangelogModalProps {
  onClose: () => void;
}

export default function ChangelogModal({ onClose }: ChangelogModalProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Feature':
        return <Sparkles className="w-4 h-4 text-rh-green" />;
      case 'Enhancement':
        return <TrendingUp className="w-4 h-4 text-blue-400" />;
      case 'Fix':
        return <Wrench className="w-4 h-4 text-orange-400" />;
      default:
        return null;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Feature':
        return 'bg-rh-green/10 text-rh-green border-rh-green/30';
      case 'Enhancement':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Fix':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      default:
        return 'bg-rh-card text-rh-text border-rh-border';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-rh-card border border-rh-border rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rh-border bg-gradient-to-r from-rh-dark to-rh-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rh-green/20 border border-rh-green/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-rh-green" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-rh-text">Changelog</h2>
              <p className="text-xs text-rh-text-secondary">What&apos;s new in ADO Explorer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-rh-border rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-rh-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6">
          <div className="space-y-8">
            {CHANGELOG.map((entry: ChangelogEntry) => (
              <div key={entry.version} className="relative">
                {/* Version Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-rh-green">{entry.version}</span>
                    <span className="text-sm text-rh-text-secondary">{entry.date}</span>
                  </div>
                  {entry.version === CHANGELOG[0].version && (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-rh-green/20 text-rh-green border border-rh-green/30">
                      Latest
                    </span>
                  )}
                </div>

                {/* Changes */}
                <div className="space-y-3 ml-4">
                  {entry.changes.map((change, index) => (
                    <div key={index} className="flex gap-3 group">
                      {/* Category Badge */}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${getCategoryColor(change.category)} flex-shrink-0`}>
                        {getCategoryIcon(change.category)}
                        {change.category}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-rh-text-secondary leading-relaxed pt-1">
                        {change.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Divider (except for last entry) */}
                {entry.version !== CHANGELOG[CHANGELOG.length - 1].version && (
                  <div className="mt-6 border-t border-rh-border/50"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-rh-border bg-rh-dark/50">
          <p className="text-xs text-rh-text-secondary text-center">
            Built with ❤️ for Azure DevOps teams
          </p>
        </div>
      </div>
    </div>
  );
}
