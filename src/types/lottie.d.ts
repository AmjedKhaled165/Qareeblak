import React from 'react';

type DotLottiePlayerProps = React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLElement> & {
        src?: string;
        background?: string;
        speed?: string;
        style?: React.CSSProperties;
        direction?: string;
        play?: boolean;
        autoplay?: boolean;
        loop?: boolean;
    },
    HTMLElement
>;

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'dotlottie-player': DotLottiePlayerProps;
        }
    }
}

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'dotlottie-player': DotLottiePlayerProps;
        }
    }
}

export {};
