import React, { useState } from 'react';
import { ChevronDown, Award, Plus, Sparkles, X, Check, Palette, Edit2 } from 'lucide-react';
import { Screen, TransitionType, UserSettings } from '../types';

interface SettingsScreenProps {
  settings: UserSettings;
  onUpdateSettings: (updater: (prev: UserSettings) => UserSettings) => void;
  onNavigate: (screen: Screen, transition?: TransitionType) => void;
  isDark?: boolean;
}

// Curated harmonious color palettes for active themes
export const THEME_COLOR_PALETTES = {
  mindful: [
    { name: 'Warm Terracotta', hex: '#e06d53' },
    { name: 'Golden Ochre', hex: '#d97706' },
    { name: 'Sage Leaf', hex: '#52796f' },
    { name: 'Deep Spruce', hex: '#2d6a4f' },
    { name: 'Oxford Slate', hex: '#3b5a70' },
    { name: 'Plum Velvet', hex: '#7209b7' },
    { name: 'Cedar Red', hex: '#bc4749' },
    { name: 'Dusty Indigo', hex: '#5e60ce' },
  ],
  vibrant: [
    { name: 'Rose Blossom', hex: '#f43f5e' },
    { name: 'Sky Azure', hex: '#0284c7' },
    { name: 'Emerald Forest', hex: '#059669' },
    { name: 'Royal Violet', hex: '#7c3aed' },
    { name: 'Amber Sun', hex: '#d97706' },
    { name: 'Teal Ocean', hex: '#0d9488' },
    { name: 'Crimson Wine', hex: '#be123c' },
    { name: 'Iris Blue', hex: '#4f46e5' },
  ],
  soft: [
    { name: 'Soft Coral', hex: '#f87171' },
    { name: 'Mint Herb', hex: '#4ade80' },
    { name: 'Sky Blue', hex: '#38bdf8' },
    { name: 'Lilac Bloom', hex: '#c084fc' },
    { name: 'Buttercup', hex: '#fbbf24' },
    { name: 'Peach Blush', hex: '#fb923c' },
    { name: 'Seafoam Teal', hex: '#2dd4bf' },
    { name: 'Lavender', hex: '#a78bfa' },
  ]
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onNavigate,
  isDark = false
}) => {
  const [isAddingTheme, setIsAddingTheme] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#52796f');
  const [selectedPaletteTab, setSelectedPaletteTab] = useState<'mindful' | 'vibrant' | 'soft'>('mindful');

  const handleAddTheme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeName.trim()) return;
    onUpdateSettings((prev) => ({
      ...prev,
      activeThemes: [
        ...prev.activeThemes,
        {
          id: Date.now().toString(),
          name: newThemeName.trim(),
          color: newThemeColor
        }
      ]
    }));
    setNewThemeName('');
    setIsAddingTheme(false);
  };

  const handleUpdateThemeColor = (id: string, color: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      activeThemes: prev.activeThemes.map((t) =>
        t.id === id ? { ...t, color } : t
      )
    }));
    setEditingThemeId(null);
  };

  const handleRemoveTheme = (id: string) => {
    onUpdateSettings((prev) => ({
      ...prev,
      activeThemes: prev.activeThemes.filter((t) => t.id !== id)
    }));
    if (editingThemeId === id) setEditingThemeId(null);
  };

  return (
    <main className="flex-1 px-5 py-4 pb-24 md:pb-8 max-w-md md:max-w-2xl mx-auto w-full space-y-6">
      {/* Title */}
      <h2 className="font-serif text-[28px] font-semibold text-stone-900 dark:text-white">
        Settings
      </h2>

      {/* ACCOUNT Section */}
      <section
        id="settings-account-section"
        className={`p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#1b201d] border-stone-800 text-stone-100'
            : 'bg-white border-stone-200/80 text-stone-900 shadow-xs'
        }`}
      >
        <span className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase block mb-4">
          ACCOUNT
        </span>

        {/* User Card */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-xl bg-[#ede7fa] dark:bg-[#52446a] text-purple-800 dark:text-purple-200 flex items-center justify-center font-bold text-[17px] shrink-0">
            EJ
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-stone-900 dark:text-white leading-tight">
              {settings.name}
            </h3>
            <p className="text-[13px] text-stone-500 dark:text-stone-400 truncate">
              {settings.email}
            </p>
          </div>
        </div>

        {/* Subscription */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200 dark:border-stone-700/60">
          <div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 block mb-0.5">Subscription</span>
            <div className="flex items-center gap-1.5 text-stone-800 dark:text-stone-200 font-medium text-[13px]">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>{settings.subscription}</span>
            </div>
          </div>
          <button
            type="button"
            className="text-[13px] font-medium text-[#435c52] dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            Manage
          </button>
        </div>
      </section>

      {/* READING PREFERENCES Section */}
      <section
        id="settings-reading-preferences-section"
        className={`p-5 rounded-2xl border transition-all space-y-5 ${
          isDark
            ? 'bg-[#1b201d] border-stone-800 text-stone-100'
            : 'bg-white border-stone-200/80 text-stone-900 shadow-xs'
        }`}
      >
        <span className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase block">
          READING PREFERENCES
        </span>

        {/* Typography */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-stone-700 dark:text-stone-300">
            Typography
          </label>
          <div className="relative">
            <select
              value={settings.typography}
              onChange={(e) => onUpdateSettings((p) => ({ ...p, typography: e.target.value }))}
              className={`w-full border rounded-xl px-4 py-3 text-[14px] appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                isDark
                  ? 'bg-[#272f2c] border-stone-700/80 text-white'
                  : 'bg-stone-50 border-stone-300/80 text-stone-900'
              }`}
            >
              <option value="Literata (Default)">Literata (Default)</option>
              <option value="Newsreader">Newsreader</option>
              <option value="System Serif">Georgia / Classic Serif</option>
              <option value="Plus Jakarta Sans">Modern Sans-Serif</option>
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-700/50">
          <div className="flex justify-between items-center text-[13px]">
            <span className="text-stone-700 dark:text-stone-300 font-medium">Font Size</span>
            <span className="text-stone-500 dark:text-stone-400">{settings.fontSize}px</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-stone-500 font-serif text-[12px]">TT</span>
            <input
              type="range"
              min={14}
              max={26}
              value={settings.fontSize}
              onChange={(e) => onUpdateSettings((p) => ({ ...p, fontSize: Number(e.target.value) }))}
              className="flex-1 accent-[#435c52] h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-stone-700 dark:text-stone-400 font-serif text-[18px] font-semibold">TT</span>
          </div>
        </div>

        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200 dark:border-stone-700/50">
          <div className="max-w-60">
            <h4 className="text-[13px] font-medium text-stone-900 dark:text-white">Dark Mode</h4>
            <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-snug">
              Switch to a darker theme for low-light environments
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.darkMode}
            onClick={() => onUpdateSettings((p) => ({ ...p, darkMode: !p.darkMode }))}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.darkMode ? 'bg-[#435c52]' : 'bg-stone-300 dark:bg-stone-700'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                settings.darkMode ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Reader Mode Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200 dark:border-stone-700/50">
          <div className="max-w-60">
            <h4 className="text-[13px] font-medium text-stone-900 dark:text-white">Reader Mode</h4>
            <p className="text-[12px] text-stone-500 dark:text-stone-400 leading-snug">
              Emphasize a distraction-free experience
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.readerMode}
            onClick={() => onUpdateSettings((p) => ({ ...p, readerMode: !p.readerMode }))}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.readerMode ? 'bg-[#435c52]' : 'bg-stone-300 dark:bg-stone-700'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white shadow-xs absolute top-0.5 transition-transform ${
                settings.readerMode ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* ACTIVE THEMES Section */}
      <section
        id="settings-active-themes-section"
        className={`p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#1b201d] border-stone-800 text-stone-100'
            : 'bg-white border-stone-200/80 text-stone-900 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-stone-500" />
            <span className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
              ACTIVE THEMES
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingTheme(true)}
            className="text-[12px] font-semibold text-[#435c52] dark:text-stone-300 hover:text-stone-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Theme Pills / List */}
        <div className="space-y-2.5">
          {settings.activeThemes.map((theme) => {
            const isEditingThis = editingThemeId === theme.id;
            return (
              <div
                key={theme.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  isEditingThis
                    ? isDark
                      ? 'bg-[#232a26] border-[#52796f]'
                      : 'bg-[#f7f6f2] border-[#52796f]'
                    : isDark
                      ? 'bg-[#151917] border-stone-800/80 hover:border-stone-700'
                      : 'bg-stone-50 border-stone-200/80 hover:bg-stone-100/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Clickable color dot to change color */}
                    <button
                      type="button"
                      onClick={() => setEditingThemeId(isEditingThis ? null : theme.id)}
                      className="group relative cursor-pointer"
                      title="Click to choose a new color"
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 block border border-black/10 transition-transform group-hover:scale-125 shadow-xs"
                        style={{ backgroundColor: theme.color }}
                      />
                    </button>
                    <div>
                      <span className="text-[14px] text-stone-800 dark:text-stone-200 font-medium block">
                        {theme.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingThemeId(isEditingThis ? null : theme.id)}
                      className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      title="Change theme color"
                    >
                      <Palette className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveTheme(theme.id)}
                      className="p-1 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${theme.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Color Palette Picker for existing theme */}
                {isEditingThis && (
                  <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-700/60 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span className="font-semibold uppercase tracking-wider">Choose Theme Color</span>
                      <button
                        type="button"
                        onClick={() => setEditingThemeId(null)}
                        className="text-stone-400 hover:text-stone-700 dark:hover:text-white"
                      >
                        Done
                      </button>
                    </div>

                    {/* Palette category tabs */}
                    <div className="flex items-center gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-lg text-[11px]">
                      {(['mindful', 'vibrant', 'soft'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSelectedPaletteTab(tab)}
                          className={`flex-1 py-1 rounded-md capitalize font-medium transition-all ${
                            selectedPaletteTab === tab
                              ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs font-semibold'
                              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Swatches grid */}
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {THEME_COLOR_PALETTES[selectedPaletteTab].map((c) => {
                        const isCurrent = theme.color.toLowerCase() === c.hex.toLowerCase();
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => handleUpdateThemeColor(theme.id, c.hex)}
                            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isCurrent
                                ? 'border-[#435c52] bg-[#435c52]/10 ring-1 ring-[#435c52]'
                                : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full shadow-xs flex items-center justify-center border border-black/10"
                              style={{ backgroundColor: c.hex }}
                            >
                              {isCurrent && <Check className="w-3 h-3 text-white drop-shadow-xs" />}
                            </span>
                            <span className="text-[9px] text-stone-600 dark:text-stone-300 truncate max-w-full font-medium">
                              {c.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Theme Form with Palette Selection */}
        {isAddingTheme && (
          <form onSubmit={handleAddTheme} className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700/60 space-y-3.5 animate-in fade-in duration-150">
            <div>
              <label className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase block mb-1">
                New Theme Name
              </label>
              <input
                type="text"
                placeholder="e.g., Epistemological Models, Ethics..."
                value={newThemeName}
                onChange={(e) => setNewThemeName(e.target.value)}
                className={`w-full border rounded-xl px-3.5 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#435c52] ${
                  isDark
                    ? 'bg-[#272f2c] border-stone-700 text-white placeholder-stone-500'
                    : 'bg-stone-50 border-stone-300 text-stone-900 placeholder-stone-400'
                }`}
                autoFocus
                required
              />
            </div>

            {/* Choose from Color Palettes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
                  Select Theme Palette Color
                </label>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: newThemeColor }}
                  />
                  <input
                    type="color"
                    value={newThemeColor}
                    onChange={(e) => setNewThemeColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                    title="Custom color picker"
                  />
                </div>
              </div>

              {/* Palette category tabs */}
              <div className="flex items-center gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-lg text-[11px]">
                {(['mindful', 'vibrant', 'soft'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedPaletteTab(tab)}
                    className={`flex-1 py-1 rounded-md capitalize font-medium transition-all ${
                      selectedPaletteTab === tab
                        ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-2xs font-semibold'
                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Color Swatches Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {THEME_COLOR_PALETTES[selectedPaletteTab].map((c) => {
                  const isSelected = newThemeColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewThemeColor(c.hex)}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#435c52] bg-[#435c52]/10 ring-1 ring-[#435c52]'
                          : 'border-stone-200/60 dark:border-stone-800 bg-white/60 dark:bg-stone-800/40 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shadow-xs flex items-center justify-center border border-black/10"
                        style={{ backgroundColor: c.hex }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white drop-shadow-xs" />}
                      </span>
                      <span className="text-[9px] text-stone-700 dark:text-stone-300 truncate max-w-full font-medium">
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-700/60">
              <button
                type="button"
                onClick={() => setIsAddingTheme(false)}
                className="px-3 py-1.5 text-[12px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#435c52] hover:bg-[#374c43] text-white font-semibold text-[12px] rounded-xl shadow-xs transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Theme</span>
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
};
