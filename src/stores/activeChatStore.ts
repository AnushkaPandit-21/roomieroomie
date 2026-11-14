import { create } from 'zustand';

// The chat currently on screen, so its message notifications aren't shown while you're reading it.
type ActiveChatState = {
  matchId: string | null;
  setMatchId: (matchId: string | null) => void;
};

export const useActiveChat = create<ActiveChatState>()((set) => ({
  matchId: null,
  setMatchId: (matchId) => set({ matchId }),
}));
