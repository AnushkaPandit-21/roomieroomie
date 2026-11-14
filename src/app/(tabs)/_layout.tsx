import { Tabs } from 'expo-router';

import { useInboxRealtime, useUnreadCount } from '@/features/chat/useMatches';
import { useLikesYouCount } from '@/features/likes/useLikesYou';
import { useSessionStore } from '@/stores/sessionStore';

import { Icon, type IconName } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';

type TabConfig = {
  name: string;
  title: string;
  icon: IconName;
  iconFocused: IconName;
};

// Order and labels are fixed by CLAUDE.md §2 — Discover, Rooms, Likes You, Matches, Profile.
const TABS: TabConfig[] = [
  { name: 'index', title: 'Discover', icon: 'albums-outline', iconFocused: 'albums' },
  { name: 'rooms', title: 'Rooms', icon: 'home-outline', iconFocused: 'home' },
  { name: 'likes-you', title: 'Likes You', icon: 'heart-outline', iconFocused: 'heart' },
  { name: 'matches', title: 'Matches', icon: 'chatbubbles-outline', iconFocused: 'chatbubbles' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconFocused: 'person-circle' },
];

export default function TabsLayout() {
  const userId = useSessionStore((s) => s.session?.user.id);
  const likesCount = useLikesYouCount(userId).data ?? 0;
  const unreadCount = useUnreadCount(userId).data ?? 0;
  useInboxRealtime(userId);
  const badges: Record<string, number | undefined> = {
    'likes-you': likesCount || undefined,
    matches: unreadCount || undefined,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors['ink-subtle'],
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontFamily: fonts['sans-medium'], fontSize: 11 },
        tabBarAllowFontScaling: false,
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: badges[tab.name] ? `${tab.title}, ${badges[tab.name]} new` : tab.title,
            tabBarBadge: badges[tab.name] && badges[tab.name]! > 99 ? '99+' : badges[tab.name],
            tabBarBadgeStyle: { backgroundColor: colors.brand, color: colors['on-brand'], fontFamily: fonts['sans-medium'], fontSize: 11 },
            tabBarIcon: ({ focused }) => (
              <Icon name={focused ? tab.iconFocused : tab.icon} size={24} color={focused ? 'ink' : 'ink-subtle'} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
