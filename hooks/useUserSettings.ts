/**
 * useUserSettings Hook
 * Manage user filter preferences with Redis persistence
 */

import { useState, useEffect } from 'react';

interface UserSettings {
  defaultState?: string;
  defaultAssignee?: string;
  defaultType?: string;
  recentSearches?: string[];
  [key: string]: any;
}

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user-settings', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json();
      setSettings(data.settings || {});
    } catch (err: any) {
      console.error('Failed to load user settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: UserSettings) => {
    try {
      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: newSettings }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSettings(newSettings);
      return true;
    } catch (err: any) {
      console.error('Failed to save user settings:', err);
      setError(err.message);
      return false;
    }
  };

  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    return await saveSettings(newSettings);
  };

  return {
    settings,
    loading,
    error,
    saveSettings,
    updateSetting,
    reload: loadSettings,
  };
}
