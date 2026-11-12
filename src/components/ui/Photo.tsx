import { Image, type ImageProps } from 'expo-image';
import { View } from 'react-native';

import { colors, radius } from '@/constants/theme';

type PhotoProps = Omit<ImageProps, 'style'> & {
  aspectRatio?: number;
  rounded?: keyof typeof radius;
};

// Photo-first building block: fixed aspect ratio so layouts never jump while images load.
export function Photo({ aspectRatio = 4 / 5, rounded = 'xl', ...rest }: PhotoProps) {
  return (
    <View
      style={{
        width: '100%',
        aspectRatio,
        borderRadius: radius[rounded],
        overflow: 'hidden',
        backgroundColor: colors['surface-muted'],
      }}
    >
      <Image style={{ flex: 1 }} contentFit="cover" transition={200} cachePolicy="memory-disk" {...rest} />
    </View>
  );
}
