/**
 * Professional Light Mode Color System
 * Arabic-friendly Dashboard Design
 * Built for Accessibility & Modern Aesthetics
 */

export const LIGHT_MODE_COLORS = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BACKGROUNDS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  backgrounds: {
    primary: '#F8FAFC',      // Slate-50: Main page background
    card: '#FFFFFF',         // White: Card surfaces
    elevated: '#F1F5F9',     // Slate-100: Hover states, alternate backgrounds
    secondary: '#F9FAFB',    // Gray-50: Grouped sections, footer areas
    overlay: 'rgba(0, 0, 0, 0.02)', // Subtle overlay for depth
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEXT COLORS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  text: {
    primary: '#0F172A',      // Slate-900: Headings & Important text
    secondary: '#475569',    // Slate-600: Body text & descriptions
    tertiary: '#64748B',     // Slate-500: Helper text & hints
    disabled: '#CBD5E1',     // Slate-300: Inactive/disabled elements
    muted: '#94A3B8',        // Slate-400: Metadata & timestamps
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ACCENT COLORS (Status Badges)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  accents: {
    revenue: {
      icon: '#3B82F6',        // Blue-500: Professional color for revenue
      background: '#DBEAFE',  // Blue-100: Light background
      text: '#1E40AF',        // Blue-800: Dark text for contrast
      hover: '#0B63F6',       // Blue-600: Hover state
    },
    orders: {
      icon: '#10B981',        // Emerald-500: Growth & completion
      background: '#D1FAE5',  // Emerald-100: Light background
      text: '#047857',        // Emerald-800: Dark text
      hover: '#059669',       // Emerald-600: Hover state
    },
    customers: {
      icon: '#F59E0B',        // Amber-500: Warm & inviting
      background: '#FEF3C7',  // Amber-100: Light background
      text: '#B45309',        // Amber-800: Dark text
      hover: '#D97706',       // Amber-600: Hover state
    },
    completion: {
      icon: '#8B5CF6',        // Violet-500: Premium & special
      background: '#EDE9FE',  // Violet-100: Light background
      text: '#5B21B6',        // Violet-800: Dark text
      hover: '#7C3AED',       // Violet-600: Hover state
    },
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NAVIGATION & BORDERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  navigation: {
    background: '#FFFFFF',   // White: Nav bar background
    border: '#E2E8F0',       // Slate-200: Subtle separation line
    activeIcon: '#3B82F6',   // Blue-600: Active navigation item
    inactiveIcon: '#94A3B8', // Slate-400: Inactive navigation item
    hoverBackground: '#F1F5F9', // Slate-100: Hover state
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STATES & FEEDBACK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  states: {
    success: '#10B981',      // Emerald-500
    warning: '#F59E0B',      // Amber-500
    error: '#EF4444',        // Red-500
    info: '#3B82F6',         // Blue-500
    pending: '#F59E0B',      // Amber-500
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SHADOWS (For depth without heavy borders)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  shadows: {
    subtle: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',      // Minimal elevation
    card: '0 4px 6px -1px rgba(15, 23, 42, 0.1)',      // Standard card shadow
    hover: '0 10px 15px -3px rgba(15, 23, 42, 0.1)',   // Hover lift effect
    elevated: '0 20px 25px -5px rgba(15, 23, 42, 0.1)', // Prominent elevation
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BORDERS & DIVIDERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  borders: {
    light: '#E2E8F0',        // Slate-200: Standard borders
    lighter: '#F1F5F9',      // Slate-100: Subtle dividers
    accent: '#3B82F6',       // Blue-500: Highlight borders
    disabled: '#CBD5E1',     // Slate-300: Disabled state
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAILWIND CLASS HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const LIGHT_MODE_CLASSES = {
  // Page backgrounds
  pageBackground: 'bg-slate-50',
  cardBackground: 'bg-white',
  elevatedBackground: 'bg-slate-100',

  // Text styles with proper hierarchy
  heading1: 'text-2xl font-black text-slate-900 font-cairo',
  heading2: 'text-lg font-bold text-slate-900 font-cairo',
  heading3: 'text-base font-bold text-slate-900 font-cairo',
  
  body: 'text-sm font-medium text-slate-600',
  small: 'text-xs font-normal text-slate-500',
  muted: 'text-xs font-medium text-slate-400',

  // Card styling - no heavy borders
  card: 'bg-white rounded-2xl shadow-md border border-slate-100 hover:shadow-lg transition-shadow',
  cardElevated: 'bg-white rounded-2xl shadow-lg border border-slate-100',

  // Accent badge styles
  badgeRevenue: 'bg-blue-100 text-blue-800 border border-blue-200',
  badgeOrders: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  badgeCustomers: 'bg-amber-100 text-amber-800 border border-amber-200',
  badgeCompletion: 'bg-violet-100 text-violet-800 border border-violet-200',

  // Navigation styles
  navItem: 'text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors',
  navItemActive: 'text-blue-600 bg-blue-50 border-b-2 border-blue-600',

  // Button styles
  buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl',
  buttonSecondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-xl',
  buttonGhost: 'text-slate-600 hover:bg-slate-100 font-bold rounded-xl',

  // Input/Form styles
  input: 'bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ICON COLOR MAPPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getAccentColorClasses = (type: 'revenue' | 'orders' | 'customers' | 'completion') => {
  const colors = {
    revenue: {
      bg: 'bg-blue-100',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-600',
    },
    orders: {
      bg: 'bg-emerald-100',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: 'text-emerald-600',
    },
    customers: {
      bg: 'bg-amber-100',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: 'text-amber-600',
    },
    completion: {
      bg: 'bg-violet-100',
      border: 'border-violet-200',
      text: 'text-violet-800',
      icon: 'text-violet-600',
    },
  };
  return colors[type];
};
