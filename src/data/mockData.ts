import { UserSettings } from '../types';

/**
 * Default settings for a brand-new user.
 * Persisted to localStorage after first load.
 */
export const initialSettings: UserSettings = {
  name: 'User',
  email: '',
  subscription: 'Free',
  typography: 'Literata (Default)',
  fontSize: 18,
  darkMode: false,
  readerMode: false,
  activeThemes: [
    { id: '1', name: 'Key Concepts', color: '#52796f' },
    { id: '2', name: 'Questions', color: '#5e60ce' },
    { id: '3', name: 'Metaphors', color: '#d97706' }
  ]
};
