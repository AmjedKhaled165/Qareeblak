/**
 * Tailwind CSS Configuration for Light Mode
 * Add this to your tailwind.config.ts if you want custom color tokens
 */

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light Mode Custom Colors
        'light': {
          // Backgrounds
          'bg-primary': '#F8FAFC',
          'bg-card': '#FFFFFF',
          'bg-elevated': '#F1F5F9',
          'bg-secondary': '#F9FAFB',

          // Text
          'text-primary': '#0F172A',
          'text-secondary': '#475569',
          'text-tertiary': '#64748B',
          'text-disabled': '#CBD5E1',
          'text-muted': '#94A3B8',

          // Accents
          'accent-blue': '#3B82F6',
          'accent-emerald': '#10B981',
          'accent-amber': '#F59E0B',
          'accent-violet': '#8B5CF6',
        },
      },
      boxShadow: {
        'light-subtle': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'light-card': '0 4px 6px -1px rgba(15, 23, 42, 0.1)',
        'light-hover': '0 10px 15px -3px rgba(15, 23, 42, 0.1)',
        'light-elevated': '0 20px 25px -5px rgba(15, 23, 42, 0.1)',
      },
      borderRadius: {
        'card': '1rem', // 16px
        'large': '1.5rem', // 24px
      },
      fontFamily: {
        'cairo': ['Cairo', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config

/**
 * USAGE EXAMPLES:
 * 
 * Background: bg-light-bg-primary
 * Text: text-light-text-primary
 * Shadow: shadow-light-card
 * Accents: text-light-accent-blue
 */
