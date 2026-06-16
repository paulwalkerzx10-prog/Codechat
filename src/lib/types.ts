export interface User {
  uid: string;
  code: string;
  displayName: string;
  createdAt: string;
  accentColor?: string;
  patternEnabled?: boolean;
  patternStyle?: string;
}

export interface Contact {
  id?: string;
  code: string;
  displayName: string;
  createdAt: string;
  lastMessageAt: string;
  lastReadAt: string;
  clearedAt?: string | null;
  isBlocked?: boolean;
  isDeleted?: boolean;
}

export interface Conversation {
  id: string;
  uids: string[];
  codes: string[];
  createdAt: string;
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
  timestamp: string;
  attachment?: MessageAttachment;
}
