const { colors, fontFamily, radius } = require('./src/constants/tokens');

const px = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, `${v}px`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontFamily: Object.fromEntries(Object.entries(fontFamily).map(([k, v]) => [k, [v]])),
      borderRadius: px(radius),
    },
  },
  plugins: [],
};
