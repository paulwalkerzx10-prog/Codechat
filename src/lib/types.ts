export interface User {
  uid: string;
  code: string;
  displayName: string;
  createdAt: any; // Firestore Timestamp
  accentColor?: string;
  patternEnabled?: boolean;
  patternStyle?: string;
}

export interface Contact {
  code: string;
  displayName: string;
  createdAt: any;
  lastMessageAt: any;
  lastReadAt: any;
}

export interface Conversation {
  id: string;
  uids: string[];
  codes: string[];
  createdAt: any;
}

export interface MessageAttachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface Message {
  id: string;
  senderCode: string;
  text: string;
  timestamp: any;
  attachment?: MessageAttachment;
}
