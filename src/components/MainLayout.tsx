import React, { useState, useEffect } from 'react';
import { User, Contact, Conversation } from '../lib/types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, where, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Sidebar } from './Sidebar';
import { ChatScreen } from './ChatScreen';
import { ProfileModal } from './ProfileModal';
import { getTheme } from '../lib/theme';

interface MainLayoutProps {
  currentUser: User;
}

export function MainLayout({ currentUser }: MainLayoutProps) {
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
    const qConv = query(
      collection(db, 'conversations'),
      where('uids', 'array-contains', currentUser.uid)
    );

    const unsubscribeConv = onSnapshot(qConv, async (snapshot) => {
      for (const d of snapshot.docs) {
        const conv = d.data() as Conversation;
        const otherCode = conv.codes.find(c => c !== currentUser.code);
        if (otherCode) {
          const contactRef = doc(db, 'users', currentUser.code, 'contacts', otherCode);
          const contactSnap = await getDoc(contactRef);
          if (!contactSnap.exists()) {
            let displayName = otherCode;
            try {
              const otherUserSnap = await getDoc(doc(db, 'users', otherCode));
              if (otherUserSnap.exists()) {
                displayName = otherUserSnap.data().displayName || otherCode;
              }
            } catch (err) {
              console.error("Failed to get other user name:", err);
            }

            try {
              await setDoc(contactRef, {
                code: otherCode,
                displayName: displayName,
                createdAt: serverTimestamp(),
                lastMessageAt: conv.createdAt || serverTimestamp(),
                lastReadAt: serverTimestamp(),
              });
            } catch (err) {
              console.error("Failed to auto-add contact:", err);
            }
          }
        }
      }
    }, (error) => {
      console.error("Error listening to conversations:", error);
    });

    return () => unsubscribeConv();
  }, [currentUser.code, currentUser.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'users', currentUser.code, 'contacts'),
      orderBy('lastMessageAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newContacts: Contact[] = [];
      snapshot.forEach((doc) => {
        const contactData = doc.data() as Contact;
        if (!contactData.isDeleted) {
          newContacts.push(contactData);
        }
      });
      setContacts(newContacts);
      
      // Update active contact if its data changed using callback form to avoid stale closure
      setActiveContact(prev => {
        if (!prev) return null;
        const foundDoc = snapshot.docs.find(d => d.id === prev.code);
        if (!foundDoc) return null;
        const contactData = foundDoc.data() as Contact;
        if (contactData.isDeleted) return null;
        return contactData;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${currentUser.code}/contacts`);
    });

    return () => unsubscribe();
  }, [currentUser.code]);

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
        {activeContact ? (
          <ChatScreen 
            currentUser={currentUser} 
            contact={activeContact} 
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
        />
      )}
    </div>
  );
}
