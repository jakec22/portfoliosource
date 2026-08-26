import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Bottom-tab icons drawn with react-native-svg (already a project dependency),
// so we avoid pulling in an icon font. Paths are the standard Material Design
// glyphs on a 24x24 viewBox: a filled house, a clock-with-rewind "history",
// and a person.
type IconName = 'Home' | 'Exercise' | 'History' | 'Profile';

const PATHS: Record<IconName, string> = {
  Home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  Exercise:
    'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z',
  History:
    'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  Profile:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
};

interface Props {
  name: IconName;
  color: string;
  size?: number;
}

export function TabIcon({ name, color, size = 24 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PATHS[name] ?? PATHS.Home} fill={color} />
    </Svg>
  );
}
