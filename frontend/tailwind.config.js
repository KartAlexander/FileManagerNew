/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",  // Ваши переменные для фона
        foreground: "var(--foreground)",  // Ваши переменные для текста
      },
    },
  },
  plugins: [],
}

