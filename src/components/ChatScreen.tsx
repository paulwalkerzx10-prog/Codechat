import React, { useState, useEffect, useRef } from 'react';
import { User, Contact, Message } from '../lib/types';
import { supabase } from '../lib/supabase';
import { Send, ArrowLeft, Trash2, Shield, Lock, Plus, Smile, Mic, Paperclip, FileText, X, Download, MoreVertical, Ban, Eraser } from 'lucide-react';
import { getAvatarColor, cn } from '../lib/utils';
import { getTheme } from '../lib/theme';
import { ConfirmDialog } from './ConfirmDialog';

// Helper to compress images so they fit safely under Firestore document boundaries and size limits
const compressImage = (dataUrl: string): Promise<string> => {
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
      
      const MAX_WIDTH = 500;
      const MAX_HEIGHT = 500;
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6)); // compressed to 60% quality jpeg
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
};

const EMOJIS = [
  '😀', '😂', '😍', '😊', '😎', '🤔', '😭', '👍', '🙌', '🔥',
  '❤️', '✨', '💯', '🎉', '👏', '🥳', '💡', '🚀', '💬', '📍',
  '👀', '🌟', '🧸', '🎁', '📅', '🔒', '🎵', '📸', '📎', '💻',
  '😜', '🤩', '🍕', '☕', '🐱', '🌈', '⚡', '🛸', '🎈', '🤝'
];

interface ChatScreenProps {
  currentUser: User;
  contact: Contact;
  onBack: () => void;
  onRemoveContact: () => void;
}

export function ChatScreen({ currentUser, contact, onBack, onRemoveContact }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConvReady, setIsConvReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeTheme = getTheme(currentUser.accentColor);

  // States for Emojis & Attachments
  const [selectedFile, setSelectedFile] = useState<{name: string, type: string, size: number, url: string} | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFileLoading, setSelectedFileLoading] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [localClearedTime, setLocalClearedTime] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; type: 'clear' | 'block' | 'remove' | null }>({ isOpen: false, type: null });

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getConversationId = (code1: string, code2: string) => {
    return [code1, code2].sort().join('_');
  };

  const conversationId = getConversationId(currentUser.code, contact.code);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsConvReady(false);
    setSelectedFile(null);
    setShowEmojiPicker(false);
    setLocalClearedTime(null);
    
    const ensureConversation = async () => {
      const { data: convSnap } = await supabase.from('conversations').select('*').eq('id', conversationId).single();

      if (!convSnap) {
        try {
          const { data: contactSnap } = await supabase.from('users').select('uid').eq('code', contact.code).single();
          const contactUid = contactSnap ? contactSnap.uid : '';
          
          if (!contactUid) {
            setIsConvReady(true);
            return;
          }

          await supabase.from('conversations').insert([{
            id: conversationId,
            uids: [currentUser.uid, contactUid],
            codes: [currentUser.code, contact.code]
          }]);
        } catch (err) {
          console.error("Could not ensure conversation", err);
        }
      }
      setIsConvReady(true);
    };
    ensureConversation();
  }, [conversationId, currentUser.uid, contact.code]);

  useEffect(() => {
    if (!isConvReady) return;

    const fetchMessages = async () => {
       const { data } = await supabase.from('messages')
         .select('*')
         .eq('conversation_id', conversationId)
         .order('created_at', { ascending: true });
       if (data) {
         setMessages(data.map(d => ({
           id: d.id,
           senderCode: d.sender_code,
           text: d.text,
           timestamp: d.created_at,
           attachment: d.attachment
         })));
       }
    };
    fetchMessages();

    const channelId = `public:messages:conversation_id=eq.${conversationId}-${Date.now()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, () => {
        fetchMessages();
      })
      .subscribe();
      
    // Update lastReadAt using Supabase
    if (contact.id) {
       supabase.from('contacts').update({ last_read_at: new Date().toISOString() }).eq('id', contact.id).then(() => {});
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, isConvReady, currentUser.code, contact.code]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileLoading(true);

    if (file.size > 500000) { 
      alert("Attachment size exceeds limits. Please select a file smaller than 500KB.");
      setSelectedFileLoading(false);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        let base64Url = event.target?.result as string;
        
        // If it is an image, let's auto-compress to prevent exceeding Firestore sizes
        if (file.type.startsWith('image/')) {
          base64Url = await compressImage(base64Url);
        }

        setSelectedFile({
          name: file.name,
          type: file.type,
          size: Math.round(base64Url.length * 0.75),
          url: base64Url
        });
        setSelectedFileLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error loading file attachment:", err);
      setSelectedFileLoading(false);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Url = reader.result as string;
          setSelectedFile({
            name: `AudioRecording-${Date.now()}.webm`,
            type: 'audio/webm',
            size: audioBlob.size,
            url: base64Url
          });
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Error starting microphone recording:", err);
      // It is often blocked by the browser if the user has not granted permission.
      alert(`Could not start audio notes. Please allow microphone permissions in your browser. Error details: ${err.message || 'Permission denied'}`);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text && !selectedFile) return;

    setIsSending(true);
    setInputText('');
    const fileToSend = selectedFile;
    setSelectedFile(null);
    setShowEmojiPicker(false);

    try {
      const messageId = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
      
      const payload: any = {
        id: messageId,
        conversation_id: conversationId,
        sender_code: currentUser.code,
        text: text || `[Sent attachment: ${fileToSend?.name || 'file'}]`,
      };

      if (fileToSend) {
        payload.attachment = fileToSend;
      }

      const { error } = await supabase.from('messages').insert([payload]);
      if (error) throw error;

      // Update lastMessageAt on our contact
      if (contact.id) {
         await supabase.from('contacts').update({
           last_message_at: new Date().toISOString()
         }).eq('id', contact.id);
      }

    } catch (err) {
      console.error("Failed to deliver message:", err);
      // Restore states if failed
      if (text) setInputText(text);
      if (fileToSend) setSelectedFile(fileToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleRemove = async () => {
    try {
      setShowOptionsMenu(false);
      setConfirmDialog({ isOpen: false, type: null });
      if (contact.id) {
        const { error } = await supabase.from('contacts').update({
          is_deleted: true
        }).eq('id', contact.id);
        
        if (error) {
           console.error("Supabase remove error", error);
           if (error.message?.includes('column')) {
              alert("Database schema error limit. Please run in Supabase SQL editor: ALTER TABLE public.contacts ADD COLUMN is_deleted boolean DEFAULT false, ADD COLUMN is_blocked boolean DEFAULT false;");
              return;
           } else {
              alert("Error removing contact: " + error.message);
              return;
           }
        }
      }
      onRemoveContact();
    } catch(err: any) {
      console.error("Error removing contact", err);
      if (err.message && err.message.includes('column')) {
         alert("Database schema error. Please run: ALTER TABLE public.contacts ADD COLUMN is_deleted boolean DEFAULT false, ADD COLUMN is_blocked boolean DEFAULT false;");
      } else {
         alert("Error removing contact: " + err.message);
      }
    }
  };

  const handleClearChat = async () => {
    try {
      setShowOptionsMenu(false);
      setConfirmDialog({ isOpen: false, type: null });
      const now = Date.now();
      setLocalClearedTime(now);

      let clearTime = new Date().toISOString();
      if (contact.id) {
         // Fix clock drift: Get the exact timestamp of the newest message from the server
         const convId = [currentUser.code, contact.code].sort().join('_');
         const { data: latestMsgs } = await supabase.from('messages')
           .select('created_at')
           .eq('conversation_id', convId)
           .order('created_at', { ascending: false })
           .limit(1);
           
         if (latestMsgs && latestMsgs.length > 0) {
            clearTime = latestMsgs[0].created_at;
         }

        const { error } = await supabase.from('contacts').update({
          cleared_at: clearTime
        }).eq('id', contact.id);
        
        if (error) {
           console.error("Supabase clear chat error", error);
           if (error.message?.includes('column')) {
              alert("Database schema error limit. Please run in Supabase SQL editor: ALTER TABLE public.contacts ADD COLUMN cleared_at timestamp with time zone;");
           } else {
              alert("Error clearing chat: " + error.message);
           }
        }
      }
    } catch(err) {
      setLocalClearedTime(null);
      console.error("Error clearing chat", err);
    }
  };

  const handleToggleBlock = async () => {
    const isBlocking = !contact.isBlocked;
    try {
      setShowOptionsMenu(false);
      setConfirmDialog({ isOpen: false, type: null });
      if (contact.id) {
        const { error } = await supabase.from('contacts').update({
          is_blocked: isBlocking
        }).eq('id', contact.id);
        if (error) {
           console.error("Supabase toggle block error", error);
           if (error.message?.includes('column')) {
              alert("Database schema error limit. Please run in Supabase SQL editor: ALTER TABLE public.contacts ADD COLUMN is_deleted boolean DEFAULT false, ADD COLUMN is_blocked boolean DEFAULT false;");
           } else {
              alert("Error toggling block: " + error.message);
           }
        }
      }
    } catch(err) {
      console.error("Error toggling block", err);
    }
  };

  const name = contact.displayName || contact.code;

  const getTimestampMs = (ts: any): number => {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') return new Date(ts).getTime();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts.getTime === 'function') return ts.getTime();
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (ts.seconds !== undefined) return ts.seconds * 1000;
    return Date.now();
  };

  const dbClearedTime = contact.clearedAt ? getTimestampMs(contact.clearedAt) : 0;
  const clearedTime = localClearedTime !== null ? Math.max(localClearedTime, dbClearedTime) : dbClearedTime;

  const visibleMessages = messages.filter(msg => {
    const msgTime = msg.timestamp ? getTimestampMs(msg.timestamp) : Date.now();
    return msgTime >= clearedTime;
  });

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={
          confirmDialog.type === 'clear' ? "Clear Chat" :
          confirmDialog.type === 'block' ? "Block Contact" :
          "Delete Contact"
        }
        message={
          confirmDialog.type === 'clear' ? "Are you sure you want to clear all messages? This cannot be undone." :
          confirmDialog.type === 'block' ? "Are you sure you want to block this contact? They will not be able to message you." :
          "Are you sure you want to delete this contact? You won't be able to chat with them unless you add them again."
        }
        confirmText={
          confirmDialog.type === 'clear' ? "Clear" :
          confirmDialog.type === 'block' ? "Block" :
          "Delete"
        }
        onConfirm={() => {
          if (confirmDialog.type === 'clear') handleClearChat();
          else if (confirmDialog.type === 'block') handleToggleBlock();
          else if (confirmDialog.type === 'remove') handleRemove();
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, type: null })}
      />
      {/* Hidden File Picker Input */}
      <input 
        type="file" 
        onChange={handleFileChange} 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,audio/*,application/pdf,text/*"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white/70 backdrop-blur-md pt-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="md:hidden p-2 -ml-2 text-slate-800 hover:bg-slate-50 transition-colors rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {contact.avatarUrl ? (
            <img src={contact.avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: getAvatarColor(contact.code) }}
            >
              {contact.code.substring(0, 2)}
            </div>
          )}
          <div>
            <h2 className="font-bold text-slate-900">{name}</h2>
            <div className="text-[10px] font-semibold text-emerald-500">Online</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 relative">
          <div className={`w-8 h-8 flex items-center justify-center ${activeTheme.textAccent} ${activeTheme.bgLight} rounded-full`} title="End-to-end encrypted">
            <Shield className="w-4 h-4" />
          </div>
          <button 
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-50"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showOptionsMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOptionsMenu(false)} />
              <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden py-2 animate-in fade-in zoom-in duration-150">
                <button 
                  onClick={() => { setShowOptionsMenu(false); setConfirmDialog({ isOpen: true, type: 'clear' }); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                >
                  <Eraser className="w-4 h-4 text-slate-400" />
                  Clear chat
                </button>
                <button 
                  onClick={() => {
                    setShowOptionsMenu(false);
                    if (!contact.isBlocked) {
                      setConfirmDialog({ isOpen: true, type: 'block' });
                    } else {
                      handleToggleBlock(); // Unblocking doesn't need confirm
                    }
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <Ban className="w-4 h-4 text-red-500" />
                  {contact.isBlocked ? "Unblock contact" : "Block contact"}
                </button>
                <button 
                  onClick={() => { setShowOptionsMenu(false); setConfirmDialog({ isOpen: true, type: 'remove' }); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                  Delete contact
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-6 pb-32 scrollbar-hide transition-all duration-300 bg-transparent"
      >
        <div className={`bg-white/80 backdrop-blur-sm border border-black/[0.03] rounded-2xl p-4 flex gap-3 mx-auto max-w-[300px]`}>
          <Lock className={`w-5 h-5 ${activeTheme.textAccent} flex-shrink-0 mt-0.5`} />
          <div>
            <p className={`text-sm font-semibold ${activeTheme.textDark}`}>End-to-end encrypted</p>
            <p className={`text-xs ${activeTheme.textAccent} mt-1 leading-relaxed`}>
              No one outside this chat can read or listen to messages.
            </p>
          </div>
        </div>

        {visibleMessages.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-4">
            Today
          </div>
        ) : (
          <>
            <div className="text-center text-slate-400 text-xs font-medium py-2">Today</div>
            {visibleMessages.map((msg, i) => {
              const isMe = msg.senderCode === currentUser.code;
              const timeStr = msg.timestamp ? new Date(getTimestampMs(msg.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
              
              return (
                <div key={msg.id || i} className={cn("flex flex-col max-w-[80%] mb-2", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                  
                  {/* Attached File Visualizer */}
                  {msg.attachment && (
                    <div className="mb-1.5 max-w-sm">
                      {msg.attachment.type.startsWith('image/') ? (
                        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm max-w-[260px] bg-slate-50">
                          <img 
                            src={msg.attachment.url} 
                            alt={msg.attachment.name} 
                            ref={(el) => {
                              if (el) el.referrerPolicy = "no-referrer";
                            }}
                            className="max-h-60 max-w-full object-cover cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
                            onClick={() => setZoomImageUrl(msg.attachment!.url)}
                          />
                        </div>
                      ) : msg.attachment.type.startsWith('audio/') ? (
                        <div className={cn(
                          "p-3 rounded-2xl flex flex-col gap-2 shadow-sm border",
                          isMe ? cn(activeTheme.bgLight, "bg-opacity-90 border-opacity-70", activeTheme.bgLightBorder) : "bg-slate-100/90 border-slate-200"
                        )}>
                          <div className="flex items-center gap-2">
                            <Mic className={cn("w-4 h-4 animate-pulse", activeTheme.textAccent)} />
                            <span className="text-xs font-semibold text-slate-700">Voice clip</span>
                          </div>
                          <audio src={msg.attachment.url} controls className="max-w-[240px] focus:outline-none" />
                        </div>
                      ) : (
                        <div className={cn(
                          "p-3 rounded-2xl flex items-center gap-3 border shadow-sm",
                          isMe 
                            ? cn(activeTheme.bgAccent, "bg-opacity-95 border-opacity-100 border", activeTheme.bgBorder, "text-white") 
                            : "bg-slate-50 border-slate-200 text-slate-800"
                        )}>
                          <div className={cn("p-2 rounded-xl flex-shrink-0", isMe ? "bg-white/15" : cn(activeTheme.bgLight, activeTheme.textAccent))}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate max-w-[140px]">{msg.attachment.name}</p>
                            <p className="text-[10px] opacity-75">{(msg.attachment.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <a 
                            href={msg.attachment.url} 
                            download={msg.attachment.name}
                            className={cn(
                              "p-2 rounded-full flex-shrink-0 hover:bg-black/10 transition-colors",
                              isMe ? "text-white" : activeTheme.textAccent
                            )}
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div 
                    className={cn(
                      "px-4 py-3 text-[15px] shadow-sm",
                      isMe 
                        ? cn(activeTheme.bgAccent, "text-white rounded-2xl rounded-tr-sm") 
                        : "bg-slate-100 text-slate-900 rounded-2xl rounded-tl-sm"
                    )}
                  >
                    {msg.text}
                  </div>
                  <span className={cn("text-[10px] mt-1 px-1", isMe ? cn(activeTheme.textLight, "mr-1") : "text-slate-400 ml-1")}>
                    {timeStr} {isMe && <span className="ml-1 inline-block">✓✓</span>}
                  </span>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Floating Emojis Menu popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-[85px] left-4 right-4 z-40 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-4 max-h-[220px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Emoji</span>
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(false)}
              className="text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-50 p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setInputText(prev => prev + emoji);
                }}
                className="text-2xl p-2 hover:bg-slate-50 hover:scale-110 active:scale-95 rounded-xl transition-all text-center flex items-center justify-center cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected/Active File Attachment Preview Header */}
      {selectedFile && (
        <div className="absolute bottom-[72px] left-0 w-full px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 animate-fade-in z-30 shadow-inner">
          <div className="flex items-center gap-3 overflow-hidden">
            {selectedFile.type.startsWith('image/') ? (
              <img 
                src={selectedFile.url} 
                alt="Preview" 
                ref={(el) => {
                  if (el) el.referrerPolicy = "no-referrer";
                }}
                className="w-10 h-10 object-cover rounded-lg border border-slate-200"
              />
            ) : selectedFile.type.startsWith('audio/') ? (
              <div className={`w-10 h-10 flex items-center justify-center ${activeTheme.bgLight} ${activeTheme.textAccent} rounded-lg`}>
                <Mic className="w-5 h-5 animate-pulse" />
              </div>
            ) : (
              <div className={`w-10 h-10 flex items-center justify-center ${activeTheme.bgLight} ${activeTheme.textAccent} rounded-lg`}>
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate max-w-[200px]">{selectedFile.name}</p>
              <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          
          <button 
            type="button" 
            onClick={() => setSelectedFile(null)}
            className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {selectedFileLoading && (
        <div className="absolute bottom-[72px] left-0 w-full px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 animate-pulse z-30">
          Generating file preview details...
        </div>
      )}

      {/* Input Action Form */}
      <div className="absolute bottom-0 w-full p-4 bg-white/70 backdrop-blur-md border-t border-slate-100 pb-safe">
        {contact.isBlocked ? (
          <div className="flex flex-col sm:flex-row items-center justify-center p-3 bg-red-50 rounded-2xl border border-red-100 gap-2 sm:gap-4">
            <p className="text-sm text-red-600 font-medium flex items-center gap-2">
              <Ban className="w-4 h-4" /> You blocked this contact
            </p>
            <button
              type="button"
              onClick={() => {
                handleToggleBlock();
              }}
              className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-full transition-colors"
            >
              Unblock
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-3">
          
          {/* File attachment toggle */}
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className={`w-10 h-10 flex items-center justify-center text-slate-500 ${activeTheme.hoverTextAccent} hover:bg-slate-50 transition-colors rounded-full flex-shrink-0`}
            title="Attach a file"
          >
            <Paperclip className="w-5.5 h-5.5" />
          </button>
          
          {isRecording ? (
            <div className={`flex-1 ${activeTheme.bgLight} border ${activeTheme.bgLightBorder} rounded-full flex items-center justify-between px-4 py-1.5 min-h-[44px]`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className={`text-xs font-semibold ${activeTheme.textDark}`}>
                  Recording note: {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <button 
                type="button" 
                onClick={stopVoiceRecording}
                className={`text-xs font-bold ${activeTheme.textAccent} hover:text-white ${activeTheme.bgHover} transition-all duration-200 ${activeTheme.bgLight} px-3 py-1 rounded-full border ${activeTheme.bgLightBorder}`}
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-full flex items-center pr-2 py-1">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent px-4 py-2 text-[15px] text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
              
              {/* Emoji Open toggle */}
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 mr-1",
                  showEmojiPicker ? `${activeTheme.textAccent} ${activeTheme.bgLight}` : "text-slate-400 hover:text-slate-600"
                )}
                title="Choose emojis"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Send Button */}
              {(inputText.trim() || selectedFile) && (
                <button
                  type="submit"
                  disabled={isSending || selectedFileLoading}
                  className={`w-8 h-8 rounded-full ${activeTheme.bgAccent} ${activeTheme.bgHover} text-white flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-50`}
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              )}
            </div>
          )}

          {/* Voice clips Recording Button */}
          {!isRecording ? (
            <button 
              type="button" 
              onClick={startVoiceRecording}
              className={`w-10 h-10 flex items-center justify-center ${activeTheme.bgAccent} ${activeTheme.bgHover} text-white hover:scale-105 active:scale-95 transition-all rounded-full flex-shrink-0 shadow-sm ${activeTheme.shadowAccent}`}
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>
          ) : (
            <button 
              type="button" 
              onClick={() => {
                // Cancel recording
                if (mediaRecorderRef.current) {
                  mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                }
                setIsRecording(false);
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
              }}
              className="w-10 h-10 flex items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors rounded-full flex-shrink-0"
              title="Cancel recording"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </form>
        )}
      </div>

      {/* Image zoom Modal overlay */}
      {zoomImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setZoomImageUrl(null)}
        >
          <button 
            type="button" 
            onClick={() => setZoomImageUrl(null)}
            className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          
          <img 
            src={zoomImageUrl} 
            alt="Zoomed document" 
            ref={(el) => {
              if (el) el.referrerPolicy = "no-referrer";
            }}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-scale-up"
          />
        </div>
      )}
    </div>
  );
}
