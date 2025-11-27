// Use the Tailwind v3 PostCSS plugin explicitly to avoid accidentally resolving v4's
// @tailwindcss/postcss entry point, which would break builds if pulled in via an
// out-of-sync node_modules tree.
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default {
  plugins: [tailwindcss, autoprefixer],
};
