/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Chatbolt Unified A & B Palette Architecture
        background: 'var(--color-background)',
        console: 'var(--color-console)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'surface-subtle': 'var(--color-surface-subtle)',

        // Structural Hairlines
        border: 'var(--color-border)',
        'border-subtle': 'var(--color-border-subtle)',
        'border-focus': 'var(--color-border-focus)',

        // Typography Substrates
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',

        // Semantic State Spectrum
        signal: {
          blue: 'var(--color-signal-blue)',
          amber: 'var(--color-signal-amber)',
          red: 'var(--color-signal-red)',
          green: 'var(--color-signal-green)',
        },

        // Action Controls
        action: {
          primary: 'var(--color-action-primary)',
          'primary-hover': 'var(--color-action-primary-hover)',
          'primary-text': 'var(--color-action-primary-text)',
          danger: 'var(--color-action-danger)',
          'danger-hover': 'var(--color-action-danger-hover)',
        },

        // Telemetry Insets
        telemetry: {
          bg: 'var(--color-telemetry-bg)',
          text: 'var(--color-telemetry-text)',
          border: 'var(--color-telemetry-border)',
        }
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        card: '6px',
        input: '6px',
      },
      boxShadow: {
        none: 'none',
        'subtle-card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'inset-well': 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
