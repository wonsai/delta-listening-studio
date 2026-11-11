/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        delta: {
          navy: '#09396A',
          primary: '#357DC7',
          red: '#E6002D',
          soft: '#EAF2FB',
          ink: '#222B38',
          muted: '#64748B',
          line: '#D9E2EC',
          bg: '#F5F7FA',
        }
      },
      fontFamily: {
        sans: ['"NanumSquare"', '"NanumSquareR"', '"Pretendard"', '"Nanum Gothic"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
