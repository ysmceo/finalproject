import React, { forwardRef } from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';

type ScrollViewRef = React.ElementRef<typeof ScrollView>;

export const ThemedScrollView = forwardRef<ScrollViewRef, ScrollViewProps>(function ThemedScrollView(
  { showsHorizontalScrollIndicator, showsVerticalScrollIndicator, ...props },
  ref
) {
  return (
    <ScrollView
      ref={ref}
      {...props}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    />
  );
});
