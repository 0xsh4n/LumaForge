/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lumetta "graphite & forge" dark identity.
        ink: {
          900: "#07080a", // app background
          850: "#0d0f13",
          800: "#121419", // deep surface
          750: "#171a21", // panels
          700: "#1c2029", // raised panels
          600: "#242933", // borders / dividers
          500: "#2e3442",
        },
        mist: {
          100: "#f4f6fa",
          200: "#e7eaf1",
          300: "#c7cdda",
          400: "#9aa3b4", // muted text
          500: "#6b7384", // faint text
        },
        forge: {
          // warm amber accent — the "luma"
          300: "#ffce8a",
          400: "#ffb559",
          500: "#f59e2c", // primary accent
          600: "#e2850f",
          700: "#b8690a",
        },
        ember: "#ff6b4a",
        teal: "#3ec6c0",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
        pop: "0 12px 40px -12px rgba(0,0,0,0.7)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
