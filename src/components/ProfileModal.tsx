import React, { useState, useRef, useEffect } from 'react';
import { User } from '../lib/types';
import { supabase } from '../lib/supabase';
import { X, Copy, Check, Palette, Sparkles, Sliders, LogOut, Camera, Bell, Volume2 } from 'lucide-react';
import { THEMES, AccentColor, getTheme, DEFAULT_ACCENT } from '../lib/theme';
import { getAvatarColor } from '../lib/utils';
import { playSound } from '../lib/sounds';

// Helper to compress avatar image
const compressAvatar = (dataUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      
      const MAX_SIZE = 300; // Small size for avatars
      let width = img.width;
      let height = img.height;

      // Crop to square before scaling down
      const minDimension = Math.min(width, height);
      const startX = (width - minDimension) / 2;
      const startY = (height - minDimension) / 2;

      canvas.width = MAX_SIZE;
      canvas.height = MAX_SIZE;

      ctx.drawImage(img, startX, startY, minDimension, minDimension, 0, 0, MAX_SIZE, MAX_SIZE);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  });
};

interface ProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onLogout?: () => void;
}

const COLOR_OPTIONS: { id: AccentColor; name: string; bg: string; dot: string }[] = [
  { id: 'violet', name: 'Violet', bg: 'bg-violet-600', dot: 'bg-violet-400' },
  { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-600', dot: 'bg-indigo-400' },
  { id: 'sky', name: 'Sky', bg: 'bg-sky-500', dot: 'bg-sky-400' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-600', dot: 'bg-emerald-400' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-500', dot: 'bg-amber-450' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-600', dot: 'bg-rose-450' }
];

export function ProfileModal({ currentUser, onClose, onLogout }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [accentColor, setAccentColor] = useState<AccentColor>(
    (currentUser.accentColor || DEFAULT_ACCENT) as AccentColor
  );
  const [patternEnabled, setPatternEnabled] = useState(currentUser.patternEnabled ?? true);
  const [patternStyle, setPatternStyle] = useState(currentUser.patternStyle || 'dots');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem(`notifications_${currentUser.code}`) === 'true';
  });
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    return localStorage.getItem(`sounds_${currentUser.code}`) !== 'false';
  });
  
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [deletingConfirm, setDeletingConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTheme = THEMES[accentColor] || THEMES[DEFAULT_ACCENT];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUser.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteAccount = async () => {
    if (deleteInput.toLowerCase() !== 'delete') return;
    setIsDeletingUser(true);
    try {
      // First delete contacts to clean up, then messages, or just let DB cascade if applicable
      // But we will just delete the user, and relying on the app to handle any loose ends.
      // Easiest is to delete user account
      const { error } = await supabase.from('users').delete().eq('code', currentUser.code);
      if (error) throw error;
      
      // We can also try to delete their contacts
      await supabase.from('contacts').delete().or(`owner_code.eq.${currentUser.code},contact_code.eq.${currentUser.code}`);
      
      onClose();
      if (onLogout) onLogout();
    } catch (err: any) {
      console.error(err);
      alert("Error deleting account: " + err.message);
      setIsDeletingUser(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { 
      alert("Image is too large. Please select an image under 2MB.");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        let base64Url = event.target?.result as string;
        if (file.type.startsWith('image/')) {
          base64Url = await compressAvatar(base64Url);
          setAvatarUrl(base64Url);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to read image:", err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound('tap', currentUser.code);
    setSaving(true);
    
    // Save notifications to browser storage locally
    localStorage.setItem(`notifications_${currentUser.code}`, notificationsEnabled ? 'true' : 'false');
    
    try {
      const { error } = await supabase.from('users').update({
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
        accent_color: accentColor,
        pattern_enabled: patternEnabled,
        pattern_style: patternStyle
      }).eq('code', currentUser.code);

      if (error) {
         if (error.message?.includes('column')) {
            alert("Database schema error. Please run in Supabase SQL editor:\nALTER TABLE public.users ADD COLUMN avatar_url text;\nALTER TABLE public.contacts ADD COLUMN avatar_url text;");
            return;
         }
         throw error;
      }

      // Sync updated profile to everyone who has added this user as a contact
      await supabase.from('contacts').update({
        display_name: displayName.trim() || currentUser.code,
        avatar_url: avatarUrl
      }).eq('contact_code', currentUser.code);

      onClose();
    } catch (err: any) {
      console.error(err);
      alert("Error saving: " + err.message);
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
            
            {/* Avatar Upload */}
            <div className="flex flex-col items-center mb-6">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarSelect} 
                accept="image/*" 
                className="hidden" 
              />
              <div 
                className="relative w-24 h-24 rounded-full bg-slate-100 flex justify-center items-center overflow-hidden border-2 border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => fileInputRef.current?.click()}
                style={!avatarUrl ? { backgroundColor: getAvatarColor(currentUser.code) } : {}}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-3xl font-bold">
                    {displayName ? displayName.substring(0, 2).toUpperCase() : currentUser.code.substring(0, 2)}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3 font-semibold">Tap to set profile picture</p>
            </div>

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

            {/* Browser Notifications Toggle */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1 min-w-0 pr-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Bell className={`w-4 h-4 ${activeTheme.textAccent}`} />
                    Browser Notifications
                  </label>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed mt-0.5">Alerts for new messages (Open in new tab to enable)</p>
                </div>
                
                <button
                  type="button"
                  onClick={async () => {
                    playSound('tap', currentUser.code);
                    const newState = !notificationsEnabled;
                    if (newState) {
                      if (!('Notification' in window)) {
                        alert("This browser does not support desktop notification");
                        return;
                      }
                      try {
                        let permission = Notification.permission;
                        if (permission !== 'granted') {
                          permission = await Notification.requestPermission();
                        }
                        
                        if (permission !== 'granted') {
                          alert("You need to allow notifications in your browser settings. If you're currently in an iframe, try opening the app in a new tab first.");
                          return;
                        }
                      } catch (err) {
                        console.error("Permission request error:", err);
                        alert("Error requesting notification permission. Please try opening the app in a new tab.");
                        return;
                      }
                    }
                    
                    setNotificationsEnabled(newState);
                    localStorage.setItem(`notifications_${currentUser.code}`, newState ? 'true' : 'false');
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none ${
                    notificationsEnabled ? activeTheme.bgAccent : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-transform transform ${
                      notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* In-App Sounds Toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1 min-w-0 pr-3">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Volume2 className={`w-4 h-4 ${activeTheme.textAccent}`} />
                    In-App Sounds
                  </label>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed mt-0.5">Play crisp sound effects on messages, typing and interactions</p>
                </div>
                
                <button
                  type="button"
                  onClick={async () => {
                    const newState = !soundsEnabled;
                    setSoundsEnabled(newState);
                    localStorage.setItem(`sounds_${currentUser.code}`, newState ? 'true' : 'false');
                    if (newState) {
                      playSound('receive', currentUser.code);
                    }
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none ${
                    soundsEnabled ? activeTheme.bgAccent : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow-md transition-transform transform ${
                      soundsEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || deletingConfirm}
                className={`w-full text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 shadow-lg ${activeTheme.bgAccent} ${activeTheme.bgHover} ${activeTheme.shadowLight} active:scale-[0.99]`}
              >
                {saving ? 'Saving preferences...' : 'Save Settings'}
              </button>
              
              {onLogout && !deletingConfirm && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center justify-center gap-2 w-full text-red-500 font-bold py-4 rounded-2xl bg-red-50 hover:bg-red-100 transition-colors border border-red-100 active:scale-[0.99]"
                >
                  <LogOut className="w-5 h-5" />
                  Log Out
                </button>
              )}

              {!deletingConfirm ? (
                <button
                  type="button"
                  onClick={() => setDeletingConfirm(true)}
                  className="w-full text-slate-400 font-bold py-3 text-sm rounded-2xl hover:bg-slate-100 transition-colors active:scale-[0.99]"
                >
                  Delete Account
                </button>
              ) : (
                <div className="bg-red-50 p-4 rounded-2xl border border-red-200 mt-4 space-y-3">
                  <p className="text-sm font-bold text-red-600">Delete Account</p>
                  <p className="text-xs text-red-500/80">This action is irreversible. Type "delete" to confirm.</p>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="delete"
                    className="w-full bg-white border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteInput.toLowerCase() !== 'delete' || isDeletingUser}
                      className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl disabled:opacity-50 transition-all hover:bg-red-600"
                    >
                      {isDeletingUser ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingConfirm(false);
                        setDeleteInput('');
                      }}
                      className="flex-1 bg-neutral-200 text-neutral-600 font-bold py-2.5 rounded-xl hover:bg-neutral-300 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
