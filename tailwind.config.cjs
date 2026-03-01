/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--color-brand-50)',
          100: 'var(--color-brand-100)',
          200: 'var(--color-brand-200)',
          500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)',
          700: 'var(--color-brand-700)',
          800: 'var(--color-brand-800)',
        },
        surface: {
          base: 'var(--color-surface-base)',
          card: 'var(--color-surface-card)',
          muted: 'var(--color-surface-muted)',
          overlay: 'var(--color-surface-overlay)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        status: {
          success: 'var(--color-status-success)',
          warning: 'var(--color-status-warning)',
          danger: 'var(--color-status-danger)',
          info: 'var(--color-status-info)',
        },
      },
      animation: {
        float1: 'float1 6s ease-in-out infinite',
        float2: 'float2 8s ease-in-out infinite',
        float3: 'float3 10s ease-in-out infinite',
        droplet: 'droplet 2s ease-in-out infinite',
        ripple: 'ripple 1.5s ease-in-out infinite',
        slideInRight: 'slideInRight 0.3s ease-out',
        fadeIn: 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        float1: {
          '0%, 100%': {
            transform: 'translate(0, 0) rotate(0deg)',
            opacity: '0.5'
          },
          '50%': {
            transform: 'translate(20px, -20px) rotate(45deg)',
            opacity: '0.8'
          }
        },
        float2: {
          '0%, 100%': {
            transform: 'translate(0, 0) rotate(0deg)',
            opacity: '0.5'
          },
          '50%': {
            transform: 'translate(-20px, -30px) rotate(-45deg)',
            opacity: '0.8'
          }
        },
        float3: {
          '0%, 100%': {
            transform: 'translate(0, 0) scale(1)',
            opacity: '0.5'
          },
          '50%': {
            transform: 'translate(10px, -40px) scale(1.1)',
            opacity: '0.8'
          }
        },
        droplet: {
          '0%, 100%': {
            transform: 'translateY(0) scale(1)',
            opacity: '1'
          },
          '50%': {
            transform: 'translateY(-5px) scale(1.1)',
            opacity: '0.8'
          }
        },
        ripple: {
          '0%': {
            transform: 'scale(0.8)',
            opacity: '1'
          },
          '100%': {
            transform: 'scale(2)',
            opacity: '0'
          }
        },
        slideInRight: {
          '0%': {
            transform: 'translateX(100%)',
            opacity: '0'
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: '1'
          }
        },
        fadeIn: {
          '0%': {
            opacity: '0'
          },
          '100%': {
            opacity: '1'
          }
        }
      }
    },
  },
  plugins: [],
};

module.exports = config;
