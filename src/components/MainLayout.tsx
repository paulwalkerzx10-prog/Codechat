import React, { useState, useEffect } from 'react';
import { User, Contact, Conversation } from '../lib/types';
import { supabase } from '../lib/supabase';
import { Sidebar } from './Sidebar';
import { ChatScreen } from './ChatScreen';
import { ProfileModal } from './ProfileModal';
import { getTheme } from '../lib/theme';

interface MainLayoutProps {
  currentUser: User;
  onLogout?: () => void;
}

export function MainLayout({ currentUser, onLogout }: MainLayoutProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  const activeTheme = getTheme(currentUser.accentColor);

  const getPatternStyle = () => {
    if (!currentUser.patternEnabled) {
      return {};
    }
    
    const color = currentUser.accentColor || 'violet';
    const pat = currentUser.patternStyle || 'dots';
    
    const colorMap: Record<string, string> = {
      violet: 'rgba(124, 58, 237, 0.12)',
      indigo: 'rgba(79, 70, 229, 0.12)',
      sky: 'rgba(14, 165, 233, 0.14)',
      emerald: 'rgba(5, 150, 105, 0.12)',
      amber: 'rgba(217, 119, 6, 0.12)',
      rose: 'rgba(225, 29, 72, 0.12)'
    };
    
    const rgbaColor = colorMap[color] || colorMap['violet'];
    
    if (pat === 'dots') {
      return {
        backgroundImage: `radial-gradient(${rgbaColor} 1.5px, transparent 1.5px)`,
        backgroundSize: '20px 20px'
      };
    }
    if (pat === 'grid') {
      return {
        backgroundImage: `
          linear-gradient(to right, ${rgbaColor} 1px, transparent 1px),
          linear-gradient(to bottom, ${rgbaColor} 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px'
      };
    }
    if (pat === 'bubbles') {
      return {
        backgroundImage: `
          radial-gradient(circle, transparent 20%, ${rgbaColor} 20%, ${rgbaColor} 25%, transparent 25%),
          radial-gradient(circle, transparent 20%, ${rgbaColor} 20%, ${rgbaColor} 25%, transparent 25%)
        `,
        backgroundPosition: '0 0, 20px 20px',
        backgroundSize: '40px 40px'
      };
    }
    return {};
  };

  // Auto-sync contacts from active conversations we're in
  useEffect(() => {
    const fetchAndListenConversations = async () => {
      // Listen for conversations where our uid is in the array
      // Supabase realtime array contains filtering is tricky, so we just listen to all changes
      // and filter locally
      const channelId = `public:conversations:auto-sync-${currentUser.uid}-${Date.now()}`;
      const channel = supabase.channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, async (payload) => {
          const conv = (payload.new || payload.old) as Conversation;
          if (conv && conv.uids && conv.uids.includes(currentUser.uid)) {
            const otherCode = conv.codes.find(c => c !== currentUser.code);
            if (otherCode) {
              const { data: existingContact } = await supabase.from('contacts')
                .select('*')
                .eq('user_code', currentUser.code)
                .eq('contact_code', otherCode)
                .single();
                
              if (!existingContact) {
                let displayName = otherCode;
                let avatarUrl = '';
                const { data: otherUser } = await supabase.from('users').select('display_name, avatar_url').eq('code', otherCode).single();
                if (otherUser) {
                  displayName = otherUser.display_name || otherCode;
                  avatarUrl = otherUser.avatar_url || '';
                }
                
                await supabase.from('contacts').insert([{
                  user_code: currentUser.code,
                  contact_code: otherCode,
                  display_name: displayName,
                  avatar_url: avatarUrl,
                  last_message_at: conv.createdAt || new Date().toISOString()
                }]);
              } else if (existingContact.is_deleted) {
                await supabase.from('contacts').update({
                  is_deleted: false,
                  last_message_at: conv.createdAt || new Date().toISOString()
                }).eq('id', existingContact.id);
              }
            }
          }
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    };
    
    const cleanup = fetchAndListenConversations();
    return () => {
      cleanup.then(unsub => unsub && unsub());
    };
  }, [currentUser.code, currentUser.uid]);

  useEffect(() => {
    const fetchContacts = async () => {
      const { data } = await supabase.from('contacts')
        .select('*')
        .eq('user_code', currentUser.code)
        .order('last_message_at', { ascending: false });
        
      if (data) {
        const parsedContacts = data.map(d => ({
          id: d.id,
          code: d.contact_code,
          displayName: d.display_name,
          avatarUrl: d.avatar_url,
          createdAt: d.created_at,
          lastMessageAt: d.last_message_at,
          lastReadAt: d.last_read_at,
          clearedAt: d.cleared_at,
          isBlocked: d.is_blocked,
          isDeleted: d.is_deleted
        })).filter(c => !c.isDeleted);
        setContacts(parsedContacts);
      }
    };
    
    fetchContacts();

    const channelId = `public:contacts:user_code=eq.${currentUser.code}-${Date.now()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `user_code=eq.${currentUser.code}` }, () => {
        fetchContacts(); // Refetch on change to simplify sorting
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.code]);

  const derivedActiveContact = activeContact 
    ? contacts.find(c => c.id === activeContact.id) || activeContact 
    : null;

  // Optional: auto-close if the active contact was deleted from the server
  useEffect(() => {
    if (activeContact) {
       const stillExists = contacts.some(c => c.id === activeContact.id);
       // We only want to close it if it was actually deleted AND we know contacts has been loaded
       if (!stillExists && contacts.length > 0) {
          // Actually, let's keep it simple: rely on ChatScreen's handleRemove to close it.
       }
    }
  }, [contacts, activeContact]);

  const handleSelectContact = (contact: Contact) => {
    setActiveContact(contact);
    setIsMobileChatOpen(true);
  };

  const handleBackToContacts = () => {
    setIsMobileChatOpen(false);
  };

  return (
    <div 
      className={`flex h-screen ${activeTheme.bgLight} text-slate-900 font-sans overflow-hidden transition-colors duration-300`}
      style={getPatternStyle()}
    >
      {/* Sidebar - Contacts */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 bg-white/70 backdrop-blur-md border-r border-slate-200 ${isMobileChatOpen ? 'hidden md:block' : 'block'}`}>
        <Sidebar 
          currentUser={currentUser} 
          contacts={contacts} 
          activeContact={activeContact}
          onSelectContact={handleSelectContact}
          onOpenProfile={() => setShowProfile(true)}
        />
      </div>

      {/* Chat Pane */}
      <div className={`flex-1 flex flex-col min-w-0 bg-transparent ${isMobileChatOpen ? 'block' : 'hidden md:flex'}`}>
        {activeContact && derivedActiveContact ? (
          <ChatScreen 
            currentUser={currentUser} 
            contact={derivedActiveContact} 
            onBack={handleBackToContacts}
            onRemoveContact={() => {
              setActiveContact(null);
              setIsMobileChatOpen(false);
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white/20 backdrop-blur-sm">
            <div className="text-center text-slate-400 font-medium">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className={`${activeTheme.textMuted} text-3xl font-black`}>#</span>
              </div>
              <p>Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {showProfile && (
        <ProfileModal 
          currentUser={currentUser} 
          onClose={() => setShowProfile(false)} 
          onLogout={onLogout}
        />
      )}
    </div>
  );
}
