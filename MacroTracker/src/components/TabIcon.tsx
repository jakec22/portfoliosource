import React from 'react';
import { Icon, type IconName } from './Icon';

// Tab icons come from the same set as the rest of the app.
//
// These used to be four hand-drawn SVG paths, from before the app had an icon
// set at all. Keeping them meant the only icons not drawn in one stroke and
// weight were the four the user sees on every screen, and adding the Food tab
// would have meant hand-drawing a fifth to match three others by eye.
type TabName = 'Home' | 'Food' | 'Exercise' | 'Profile';

const TAB_ICON: Record<TabName, IconName> = {
  Home: 'home',
  Food: 'meal',
  Exercise: 'workout',
  Profile: 'profile',
};

interface Props {
  name: TabName;
  color: string;
  size?: number;
}

export function TabIcon({ name, color, size = 24 }: Props) {
  return <Icon name={TAB_ICON[name] ?? 'home'} size={size} color={color} />;
}
