'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, User, LogOut } from 'lucide-react';
import { VERSION } from '@/lib/version';
import ChangelogModal from './ChangelogModal';

export default function Header() {
  const [showChangelog, setShowChangelog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user session
  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUserEmail(data.user.email);
        }
      })
      .catch(err => console.error('Failed to fetch session:', err));
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Get user initials for avatar
  const getUserInitials = (email: string) => {
    const name = email.split('@')[0];
    const parts = name.split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

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

          {/* User Profile Menu */}
          {userEmail && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-10 h-10 rounded-full bg-rh-green flex items-center justify-center text-rh-dark font-semibold text-sm hover:bg-rh-green/90 transition-colors"
                title={userEmail}
              >
                {getUserInitials(userEmail)}
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-rh-card border border-rh-border rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-rh-border">
                    <p className="text-sm font-medium text-rh-text">Signed in as</p>
                    <p className="text-sm text-rh-green truncate">{userEmail}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-rh-dark transition-colors text-rh-text"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Changelog Modal */}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </>
  );
}
