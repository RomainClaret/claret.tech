module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Tailwind 4 prefixes only what it generates. The stylesheets imported
    // from node_modules (xterm, react-pdf) still need autoprefixer, for
    // -webkit-user-select and the -webkit-backdrop-filter that Safari before
    // 18 needs (browser-targets.test.ts).
    autoprefixer: {},
  },
};
