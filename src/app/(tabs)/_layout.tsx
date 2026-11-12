import { Tabs } from 'expo-router';

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
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ focused }) => (
              <Icon name={focused ? tab.iconFocused : tab.icon} size={24} color={focused ? 'ink' : 'ink-subtle'} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
