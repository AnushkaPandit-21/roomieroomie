import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { registerPushToken } from '@/services/push';
import { useActiveChat } from '@/stores/activeChatStore';

type PushData = { type?: 'like' | 'match' | 'message'; matchId?: string };

// Foreground: show alerts, except messages for the chat that's already open (CLAUDE.md §8).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as PushData;
    const hide = data?.type === 'message' && !!data.matchId && data.matchId === useActiveChat.getState().matchId;
    return { shouldShowBanner: !hide, shouldShowList: !hide, shouldPlaySound: !hide, shouldSetBadge: false };
  },
});

function openFromNotification(data: PushData | undefined) {
  if (!data?.type) return;
  if (data.type === 'like') router.navigate('/likes-you');
  else if (data.matchId) router.push({ pathname: '/chat/[id]', params: { id: data.matchId } });
}

// Registers this phone for pushes once signed in with a complete profile, and opens the right
// screen when a notification is tapped (also when it launched the app).
export function usePushNotifications(userId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!userId || !enabled) return;
    registerPushToken(userId).catch((error) => {
      if (__DEV__) console.warn('Push registration failed:', error);
    });

    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last.notification.request.content.data as PushData);
    const sub = Notifications.addNotificationResponseReceivedListener((response) =>
      openFromNotification(response.notification.request.content.data as PushData),
    );
    return () => sub.remove();
  }, [userId, enabled]);
}
