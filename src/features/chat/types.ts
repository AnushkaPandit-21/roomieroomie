export type MatchSummary = {
  matchId: string;
  profileId: string;
  name: string;
  age: number;
  photoUrl: string | null;
  matchedAt: string;
  lastMessage: string | null; // null = new match, no messages yet
  lastSenderId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  yourTurn: boolean;
  activityAt: string;
};

export type MatchesPage = { matches: MatchSummary[]; nextCursor: string | null };

export type ChatMessage = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  // Client-only: shown while sending, or after a failed send.
  pending?: boolean;
  failed?: boolean;
};

export type MessagesPage = { messages: ChatMessage[]; nextCursor: string | null };
