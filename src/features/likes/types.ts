import type { CardProfile } from '@/features/feed/types';

// One person in Likes You: their card, plus what of mine they liked and their comment.
export type IncomingLike = {
  profile: CardProfile;
  likedItemId: string | null; // one of MY photos/prompts, or null for a plain like
  comment: string | null;
  likedAt: string;
};

export type LikesYouPage = { likes: IncomingLike[]; nextCursor: string | null };
