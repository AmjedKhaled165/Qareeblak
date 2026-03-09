import React from 'react';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'dotlottie-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
                src?: string;
                background?: string;
                speed?: string;
                style?: React.CSSProperties;
                direction?: string;
                play?: boolean;
                autoplay?: boolean;
                loop?: boolean;
            }, HTMLElement>;
        }
    }
}
