"use client";

import { useEffect, useRef } from 'react';
import { DotLottie } from '@lottiefiles/dotlottie-web';

interface LottieAnimationProps {
  src: string;
  className?: string;
  id?: string;
}

export default function LottieAnimation({ src, className, id }: LottieAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const dotLottie = new DotLottie({
        canvas: canvasRef.current,
        src: src,
        autoplay: true,
        loop: true,
      });

      return () => {
        dotLottie.destroy();
      };
    }
  }, [src]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} id={id} className="w-full h-auto" />
    </div>
  );
}
