import React, { useState } from 'react';
import { User } from '../lib/types';
import { supabase } from '../lib/supabase';
import { X, Copy, Check, Palette, Sparkles, Sliders } from 'lucide-react';
import { THEMES, AccentColor, getTheme, DEFAULT_ACCENT } from '../lib/theme';

interface ProfileModalProps {
  currentUser: User;
  onClose: () => void;
}

const COLOR_OPTIONS: { id: AccentColor; name: string; bg: string; dot: string }[] = [
  { id: 'violet', name: 'Violet', bg: 'bg-violet-600', dot: 'bg-violet-400' },
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-600', dot: 'bg-indigo-400' },
  { id: 'sky', name: 'Sky', bg: 'bg-sky-500', dot: 'bg-sky-400' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-600', dot: 'bg-emerald-400' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-500', dot: 'bg-amber-450' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-600', dot: 'bg-rose-450' }
];

export function ProfileModal({ currentUser, onClose }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [accentColor, setAccentColor] = useState<AccentColor>(
    (currentUser.accentColor || DEFAULT_ACCENT) as AccentColor
  );
  const [patternEnabled, setPatternEnabled] = useState(currentUser.patternEnabled ?? true);
  const [patternStyle, setPatternStyle] = useState(currentUser.patternStyle || 'dots');
  
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeTheme = THEMES[accentColor] || THEMES[DEFAULT_ACCENT];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUser.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await supabase.from('users').update({
        display_name: displayName.trim(),
        accent_color: accentColor,
        pattern_enabled: patternEnabled,
        pattern_style: patternStyle
      }).eq('code', currentUser.code);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-100 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl my-8">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className={`w-5 h-5 ${activeTheme.textAccent}`} />
            Settings & Profile
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 max-h-[75vh] overflow-y-auto scrollbar-hide">
          {/* User Code */}
          <div className="text-center mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">YOUR UNIQUE CODE</p>
            <div className="flex items-center justify-center gap-3">
              <span className={`text-4xl font-black tracking-widest ${activeTheme.textAccent}`}>
                {currentUser.code}
              </span>
              <button 
                onClick={handleCopy}
                className={`p-2.5 text-slate-500 ${activeTheme.hoverTextAccent} bg-white shadow-sm border border-slate-150 rounded-xl transition-all hover:scale-105 active:scale-95`}
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-2 text-[10px] font-semibold text-slate-400 max-w-[280px] mx-auto leading-relaxed">
              Share this code to build secure connection channels. Conversations are private.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Display Name Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others will see you..."
                className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-slate-900 focus:outline-none focus:bg-white transition-all placeholder:text-slate-400 ${activeTheme.ringAccent}`}
                maxLength={30}
              />
            </div>

            {/* Accent Color Picker */}
            <div>
              <label className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                <Palette className={`w-4 h-4 ${activeTheme.textAccent}`} />
                Primary Accent Color
              </label>
              <p className="text-xs text-slate-400 mb-3 font-medium">Customize the main accent hue of your chats</p>
              
              <div className="grid grid-cols-6 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                {COLOR_OPTIONS.map((color) => {
                  const isSelected = accentColor === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setAccentColor(color.id)}
                      className={`h-11 rounded-xl flex items-center justify-center relative transition-all cursor-pointer ${color.bg} ${
                        isSelected 
                          ? 'ring-4 ring-slate-900/15 scale-110 shadow-md' 
                          : 'opacity-85 hover:opacity-100 hover:scale-[1.05]'
                      }`}
                      title={color.name}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/15 rounded-xl">
                          <Check className="w-5 h-5 text-white stroke-[3px]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Patterned Background Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1 min-w-0 pr-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Sparkles className={`w-4 h-4 ${activeTheme.textAccent}`} />
                    Patterned Chat Backgrounds
                  </label>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed mt-0.5">Toggle elegant design patterns behind messages</p>
                </div>
                
                {/* Custom Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setPatternEnabled(!patternEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none ${
                    patternEnabled ? activeTheme.bgAccent : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-transform transform ${
                      patternEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Pattern Style Selector (Only shown if patterned background enabled) */}
              {patternEnabled && (
                <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100 space-y-2.5 animate-fade-in">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Select Design Pattern</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dots', label: 'Tech Dots' },
                      { id: 'grid', label: 'Minimal Grid' },
                      { id: 'bubbles', label: 'Bubbles' }
                    ].map((pattern) => {
                      const isSelected = patternStyle === pattern.id;
                      return (
                        <button
                          key={pattern.id}
                          type="button"
                          onClick={() => setPatternStyle(pattern.id)}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? `${activeTheme.bgAccent} text-white ${activeTheme.bgBorder} shadow-sm` 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {pattern.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <button
              type="submit"
              disabled={saving}
              className={`w-full text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 shadow-lg ${activeTheme.bgAccent} ${activeTheme.bgHover} ${activeTheme.shadowLight} active:scale-[0.99]`}
            >
              {saving ? 'Saving preferences...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
