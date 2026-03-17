/**
 * @file tailwind.config.ts
 * @description Design System do Food SaaS — tokens, cores, tipografia e animações.
 *
 * Filosofia visual:
 *  - Paleta neutra escura (slate) como base — sofisticada e não cansa a vista
 *  - Laranja quente como cor primária — energia, apetite, ação
 *  - Esmeralda como cor de sucesso — feedback positivo claro
 *  - Tipografia com Inter (sans) + Geist Mono (código)
 *  - Radius suave (0.75rem) — moderno sem ser arredondado demais
 */

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class'],
  theme: {
    // -------------------------------------------------------------------------
    // Container — centralizado com padding responsivo
    // -------------------------------------------------------------------------
    container: {
      center : true,
      padding: {
        DEFAULT: '1rem',
        sm     : '1.5rem',
        lg     : '2rem',
        xl     : '2rem',
        '2xl'  : '2rem',
      },
      screens: {
        '2xl': '1400px',
      },
    },

    extend: {
      // -----------------------------------------------------------------------
      // Cores — Design System completo via CSS Variables (suporte a dark mode)
      // As variáveis são definidas em globals.css usando HSL sem o hsl()
      // wrapper (padrão shadcn/ui), ex: --primary: 24 100% 50%
      // -----------------------------------------------------------------------
      colors: {
        // Cores semânticas mapeadas para CSS variables
        border     : 'hsl(var(--border))',
        input      : 'hsl(var(--input))',
        ring       : 'hsl(var(--ring))',
        background : 'hsl(var(--background))',
        foreground : 'hsl(var(--foreground))',

        primary: {
          DEFAULT    : 'hsl(var(--primary))',
          foreground : 'hsl(var(--primary-foreground))',
          50 : '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',  // Laranja principal
          600: '#ea6c0a',  // Hover
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },

        secondary: {
          DEFAULT   : 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },

        destructive: {
          DEFAULT   : 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },

        muted: {
          DEFAULT   : 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },

        accent: {
          DEFAULT   : 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        popover: {
          DEFAULT   : 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        card: {
          DEFAULT   : 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Cores de status de pedido — paleta semântica do negócio
        status: {
          pending   : '#F59E0B',  // Âmbar — aguardando
          confirmed : '#3B82F6',  // Azul — confirmado
          preparing : '#8B5CF6',  // Violeta — preparando
          ready     : '#10B981',  // Esmeralda — pronto
          dispatched: '#06B6D4',  // Ciano — saiu para entrega
          delivered : '#22C55E',  // Verde — entregue
          cancelled : '#EF4444',  // Vermelho — cancelado
          rejected  : '#6B7280',  // Cinza — rejeitado
        },

        // Cores de status de mesa
        table: {
          available  : '#22C55E',  // Verde
          occupied   : '#F97316',  // Laranja
          reserved   : '#3B82F6',  // Azul
          maintenance: '#6B7280',  // Cinza
        },
      },

      // -----------------------------------------------------------------------
      // Border Radius — consistente em todo o sistema
      // -----------------------------------------------------------------------
      borderRadius: {
        lg  : 'var(--radius)',
        md  : 'calc(var(--radius) - 2px)',
        sm  : 'calc(var(--radius) - 4px)',
        xl  : 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },

      // -----------------------------------------------------------------------
      // Tipografia
      // -----------------------------------------------------------------------
      fontFamily: {
        sans : ['var(--font-inter)',       'system-ui', 'sans-serif'],
        mono : ['var(--font-geist-mono)',  'Menlo', 'monospace'],
        display: ['var(--font-inter)',     'system-ui', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },

      // -----------------------------------------------------------------------
      // Espaçamento extra
      // -----------------------------------------------------------------------
      spacing: {
        '18' : '4.5rem',
        '88' : '22rem',
        '112': '28rem',
        '128': '32rem',
      },

      // -----------------------------------------------------------------------
      // Sombras — elevação sutil e sofisticada
      // -----------------------------------------------------------------------
      boxShadow: {
        'soft-xs': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        'soft-sm': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'soft'   : '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'soft-md': '0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)',
        'soft-lg': '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
        'glow'   : '0 0 20px -5px hsl(var(--primary) / 0.4)',
        'glow-sm': '0 0 10px -3px hsl(var(--primary) / 0.3)',
      },

      // -----------------------------------------------------------------------
      // Animações — fluidas e com propósito
      // -----------------------------------------------------------------------
      keyframes: {
        // shadcn/ui compatíveis
        'accordion-down': {
          from: { height: '0' },
          to  : { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to  : { height: '0' },
        },
        // Animações custom
        'fade-in': {
          from: { opacity: '0' },
          to  : { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to  : { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to  : { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to  : { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to  : { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.4)' },
          '50%'     : { boxShadow: '0 0 0 8px hsl(var(--primary) / 0)' },
        },
        'shimmer': {
          from: { backgroundPosition: '-200% 0' },
          to  : { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        // Notificação de novo pedido
        'bounce-in': {
          '0%'  : { opacity: '0', transform: 'scale(0.3)' },
          '50%' : { opacity: '1', transform: 'scale(1.05)' },
          '70%' : { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
      },

      animation: {
        'accordion-down'  : 'accordion-down 0.2s ease-out',
        'accordion-up'    : 'accordion-up 0.2s ease-out',
        'fade-in'         : 'fade-in 0.2s ease-out',
        'fade-up'         : 'fade-up 0.3s ease-out',
        'fade-down'       : 'fade-down 0.3s ease-out',
        'slide-in-right'  : 'slide-in-right 0.3s ease-out',
        'scale-in'        : 'scale-in 0.2s ease-out',
        'pulse-ring'      : 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer'         : 'shimmer 2s linear infinite',
        'spin-slow'       : 'spin-slow 3s linear infinite',
        'bounce-in'       : 'bounce-in 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      },

      // -----------------------------------------------------------------------
      // Transições — rápidas e naturais
      // -----------------------------------------------------------------------
      transitionTimingFunction: {
        'spring'   : 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth'   : 'cubic-bezier(0.4, 0, 0.2, 1)',
        'snappy'   : 'cubic-bezier(0.2, 0, 0, 1)',
      },

      transitionDuration: {
        '50' : '50ms',
        '400': '400ms',
        '600': '600ms',
      },

      // -----------------------------------------------------------------------
      // Backdrop blur — glassmorphism sutil
      // -----------------------------------------------------------------------
      backdropBlur: {
        xs: '2px',
      },

      // -----------------------------------------------------------------------
      // Larguras para layouts específicos
      // -----------------------------------------------------------------------
      width: {
        sidebar: '16rem',   // 256px — sidebar recolhida
        sidebar_lg: '20rem', // 320px — sidebar expandida
      },

      // -----------------------------------------------------------------------
      // Z-index — camadas bem definidas
      // -----------------------------------------------------------------------
      zIndex: {
        'dropdown'  : '1000',
        'sticky'    : '1020',
        'fixed'     : '1030',
        'backdrop'  : '1040',
        'modal'     : '1050',
        'popover'   : '1060',
        'tooltip'   : '1070',
        'toast'     : '1080',
      },

      // -----------------------------------------------------------------------
      // Grid customizado para o painel de mesas
      // -----------------------------------------------------------------------
      gridTemplateColumns: {
        'tables-sm': 'repeat(auto-fill, minmax(140px, 1fr))',
        'tables-md': 'repeat(auto-fill, minmax(180px, 1fr))',
        'tables-lg': 'repeat(auto-fill, minmax(220px, 1fr))',
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------
  plugins: [
    require('tailwindcss-animate'),
  ],
};

export default config;
