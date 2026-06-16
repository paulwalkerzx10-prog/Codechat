import React, { useState, useEffect } from 'react';
import { User, Contact, Message } from '../lib/types';
import { supabase } from '../lib/supabase';
import { Search, Plus, Shield, User as UserIcon, X, Copy, MessageCircle, ScanLine, Send, QrCode, Check } from 'lucide-react';
import { getAvatarColor, cn } from '../lib/utils';
import { formatRelative } from 'date-fns';
import { QRModal } from './QRModal';
import { getTheme } from '../lib/theme';

const ContactRow: React.FC<{ 
  contact: Contact; 
  currentUser: User; 
  isSelected: boolean; 
  onSelect: () => void; 
}> = ({ 
  contact, 
  currentUser, 
  isSelected, 
  onSelect 
}) => {
  const [lastMsg, setLastMsg] = useState<Message | null>(null);
  const convId = [currentUser.code, contact.code].sort().join('_');
  const activeTheme = getTheme(currentUser.accentColor);

  useEffect(() => {
    const fetchLatestMsg = async () => {
      const { data } = await supabase.from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLastMsg({
          id: data[0].id,
          senderCode: data[0].sender_code,
          text: data[0].text,
          timestamp: data[0].created_at,
          attachment: data[0].attachment
        });
      }
    };
    fetchLatestMsg();

    const channelId = `public:messages:conversation_id=eq.${convId}-${Date.now()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, () => {
        fetchLatestMsg();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId]);

  const name = contact.displayName || contact.code;
  
  // Decide unread status based on if lastMsg timestamp > lastReadAt
  let unread = false;
  if (lastMsg?.timestamp && contact.lastReadAt && new Date(lastMsg.timestamp) > new Date(contact.lastReadAt)) {
    if (lastMsg.senderCode !== currentUser.code) { // Only unread if they sent it
      unread = true;
    }
  }

  // Formatting date
  let timeStr = '';
  if (lastMsg?.timestamp) {
    const d = new Date(lastMsg.timestamp);
    // Simple today check
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      timeStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "w-full p-4 flex items-center gap-4 transition-colors text-left border-l-4",
          isSelected ? `${activeTheme.bgLight} ${activeTheme.bgBorder}` : "border-transparent hover:bg-slate-50/70"
        )}
      >
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: getAvatarColor(contact.code) }}
        >
          {contact.code.substring(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-1">
            <span className={cn("font-semibold truncate", unread ? activeTheme.textOnLight : "text-slate-900", "text-base")}>
              {name}
            </span>
            {timeStr && <span className={cn("text-xs flex-shrink-0 ml-2", unread ? `${activeTheme.textAccent} font-medium` : "text-slate-500")}>{timeStr}</span>}
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className={cn(
              "text-sm truncate max-w-[200px]", 
              unread ? "text-slate-800 font-medium" : "text-slate-500"
            )}>
              {lastMsg ? (lastMsg.senderCode === currentUser.code ? `You: ${lastMsg.text}` : lastMsg.text) : 
               <span className="text-slate-400">ID: {contact.code}</span>}
            </span>
            {unread && (
               <div className={`w-5 h-5 rounded-full ${activeTheme.bgAccent} text-white text-[10px] flex items-center justify-center flex-shrink-0 font-medium`}>1</div>
            )}
          </div>
        </div>
      </button>
    </li>
  );
};
interface SidebarProps {
  currentUser: User;
  contacts: Contact[];
  activeContact: Contact | null;
  onSelectContact: (c: Contact) => void;
  onOpenProfile: () => void;
}

export function Sidebar({ currentUser, contacts, activeContact, onSelectContact, onOpenProfile }: SidebarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addCode, setAddCode] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrTab, setQrTab] = useState<'mine' | 'scan'>('mine');

  const activeTheme = getTheme(currentUser.accentColor);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentUser.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = addCode.trim().toUpperCase();
    
    if (cleanCode.length !== 6) {
      setAddError('Code must be exactly 6 characters.');
      return;
    }
    if (cleanCode === currentUser.code) {
      setAddError('You cannot add your own code.');
      return;
    }
    if (contacts.some(c => c.code === cleanCode)) {
      setAddError('Contact already in your list.');
      return;
    }

    setIsSubmitting(true);
    setAddError('');

    try {
      const { data: otherUser } = await supabase.from('users').select('*').eq('code', cleanCode).single();

      if (!otherUser) {
        setAddError('No one found with that code.');
      } else {
        // Add to our contacts
        const { data: existingContact } = await supabase.from('contacts').select('*')
          .eq('user_code', currentUser.code).eq('contact_code', cleanCode).single();
          
        if (existingContact) {
           await supabase.from('contacts').update({
             display_name: otherUser.display_name || '',
             is_deleted: false,
             last_message_at: new Date().toISOString(),
             last_read_at: new Date().toISOString()
           }).eq('id', existingContact.id);
        } else {
           await supabase.from('contacts').insert([{
             user_code: currentUser.code,
             contact_code: cleanCode,
             display_name: otherUser.display_name || '',
             last_message_at: new Date().toISOString(),
             last_read_at: new Date().toISOString()
           }]);
        }

        setAddCode('');
        setIsAdding(false);
      }
    } catch (err) {
      console.error(err);
      setAddError('Failed to verify code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {isAdding ? (
        <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-md flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-slate-100">
            <button onClick={() => { setIsAdding(false); setAddError(''); }} className="p-2 text-slate-800 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-slate-900">Add Contact</h2>
            <div className="w-9" /> {/* Spacer */}
          </div>
          
          <div className="p-6 flex-1 flex flex-col items-center justify-start text-center">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Connect using</h3>
            <h3 className={`text-xl font-bold ${activeTheme.textAccent} mb-4`}>User Code</h3>
            <p className="text-slate-500 text-sm mb-8 max-w-[250px]">
              Enter the user code shared by the person you want to connect with.
            </p>

            <form onSubmit={handleAddContact} className="w-full max-w-sm mb-8">
              <div className="relative flex items-center bg-white border-2 border-slate-100 rounded-2xl overflow-hidden shadow-sm shadow-slate-100">
                <div className={`${activeTheme.bgAccent} m-2 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-xl">#</span>
                </div>
                <input
                  type="text"
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                  placeholder="AB12-CD34"
                  className="flex-1 bg-transparent py-4 px-2 text-xl font-bold tracking-widest text-slate-700 focus:outline-none uppercase placeholder:text-slate-300"
                  maxLength={6}
                  autoFocus
                />
              </div>
              {addError && <p className="text-red-500 text-sm mt-3">{addError}</p>}

              <button 
                type="submit" 
                disabled={isSubmitting || addCode.length !== 6}
                className={`w-full ${activeTheme.bgAccent} ${activeTheme.bgHover} text-white font-semibold py-4 rounded-xl mt-8 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg ${activeTheme.shadowAccent}`}
              >
                <Send className="w-5 h-5" />
                Send Connection Request
              </button>
            </form>

            <div className="flex items-center gap-4 w-full max-w-sm my-4">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-slate-400 text-sm">or</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            <button 
              type="button"
              onClick={() => {
                setQrTab('scan');
                setShowQR(true);
              }}
              className={`w-full max-w-sm mt-4 bg-white border-2 border-slate-100 p-4 rounded-2xl flex items-center gap-4 px-6 ${activeTheme.hoverBgLight} transition-all active:scale-[0.98]`}
            >
              <div className={`w-12 h-12 ${activeTheme.bgLight} ${activeTheme.textAccent} rounded-xl flex items-center justify-center`}>
                <ScanLine className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h4 className="font-semibold text-slate-800">Scan Code</h4>
                <p className="text-sm text-slate-500">Scan their QR code to connect instantly.</p>
              </div>
            </button>
            
            <div className="mt-auto pb-4 flex items-center gap-2 text-slate-400 text-xs text-center px-4">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>A connection request will be sent. They can accept or ignore.</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-transparent pt-6">
        <button 
          onClick={onOpenProfile}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-900 border-2 border-transparent ${activeTheme.hoverBorderLight} transition-colors font-bold text-xs shadow-sm ${activeTheme.bgLight}`}
        >
          {currentUser.displayName ? currentUser.displayName.substring(0,2).toUpperCase() : currentUser.code.substring(0,2)}
        </button>
        <div className="flex flex-col items-center">
          <span className="font-black text-xl text-slate-900 tracking-tight">CodeChat</span>
        </div>
        <div className={`w-8 h-8 flex items-center justify-center ${activeTheme.textAccent} ${activeTheme.bgLight} rounded-full`}>
           <Shield className="w-4 h-4" />
        </div>
      </div>

      {/* Your User Code */}
      <div className="px-4 mt-2 mb-4">
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
           <div className="flex-1">
             <div className="text-xs font-semibold text-slate-500 mb-1">Your User Code</div>
             <div className={`text-2xl font-black ${activeTheme.textAccent} tracking-wider`}>
               {currentUser.code.slice(0,4)}-{currentUser.code.slice(4)}
             </div>
             <div className="text-[10px] text-slate-400 mt-1">Share this code to connect with others</div>
           </div>
           <div className="flex items-center gap-2">
             <button 
               onClick={() => {
                 setQrTab('mine');
                 setShowQR(true);
               }}
               className={`w-10 h-10 border border-slate-200 bg-white rounded-xl shadow-sm text-slate-600 flex items-center justify-center ${activeTheme.hoverBgLight} border-transparent ${activeTheme.hoverTextDark} ${activeTheme.hoverBorderLight} transition-colors`}
               title="Show QR Code"
             >
               <QrCode className="w-4 h-4" />
             </button>
             <button 
               onClick={handleCopyCode}
               className={`w-10 h-10 border border-slate-200 bg-white rounded-xl shadow-sm text-slate-600 flex items-center justify-center ${activeTheme.hoverBgLight} transition-colors`}
               title="Copy to Clipboard"
             >
               {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
             </button>
           </div>
        </div>
      </div>

      {/* Search & Add */}
      <div className="px-4 mb-4">
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-slate-200 py-3 px-4 rounded-full text-slate-400 hover:bg-white/80 transition-colors text-sm shadow-sm"
        >
          <Search className="w-4 h-4" />
          <span>Search or Add by User Code</span>
        </button>
      </div>

      <div className="px-4 py-2 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">Chats</h3>
        <span className={`text-xs font-bold ${activeTheme.textAccent} ${activeTheme.bgLight} px-2.5 py-1 rounded-full cursor-pointer hover:opacity-95`}>All ▼</span>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto bg-transparent mb-20 scrollbar-hide">
        {contacts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <p>No connections established.</p>
            <p className="mt-2 text-xs">Tap new chat to add someone.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {contacts.map(contact => (
              <ContactRow
                key={contact.code}
                contact={contact}
                currentUser={currentUser}
                isSelected={activeContact?.code === contact.code}
                onSelect={() => onSelectContact(contact)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 w-full bg-transparent border-t border-slate-100 flex items-center justify-between px-8 py-3 pb-safe z-0 text-slate-400">
         <button className={`flex flex-col items-center gap-1 ${activeTheme.textAccent}`}>
           <MessageCircle className={`w-6 h-6 ${activeTheme.fillAccent} ${activeTheme.textAccent}`} />
           <span className="text-[10px] font-semibold">Chats</span>
         </button>
         
         <div className="relative -top-5">
           <button 
             onClick={() => setIsAdding(true)}
             className={`w-14 h-14 ${activeTheme.bgAccent} text-white flex items-center justify-center rounded-full shadow-lg ${activeTheme.shadowAccent} ${activeTheme.bgHover} transition-all duration-150 hover:scale-105 active:scale-95`}
           >
             <Plus className="w-8 h-8" />
           </button>
           <span className="absolute -bottom-5 w-full text-center text-[10px] font-semibold text-slate-400">New Chat</span>
         </div>

         <button onClick={onOpenProfile} className="flex flex-col items-center gap-1 hover:text-slate-600 transition">
           <UserIcon className="w-6 h-6" />
           <span className="text-[10px] font-semibold">Profile</span>
         </button>
      </div>
      
      {showQR && (
        <QRModal
          currentUser={currentUser}
          contacts={contacts}
          initialTab={qrTab}
          onClose={() => setShowQR(false)}
          onContactAdded={() => {}}
        />
      )}
    </div>
  );
}
