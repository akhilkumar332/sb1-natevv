/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        float1: 'float1 6s ease-in-out infinite',
        float2: 'float2 8s ease-in-out infinite',
        float3: 'float3 10s ease-in-out infinite',
        droplet: 'droplet 2s ease-in-out infinite',
        ripple: 'ripple 1.5s ease-in-out infinite',
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
        }
      }
    },
  },
  plugins: [],
};