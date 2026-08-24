import React from 'react';
import { Composition } from 'remotion';
import { Promo } from './Promo';

// 9:16 vertical, 30fps, 30s (900 frames) — TikTok / Reels / RED ready.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
