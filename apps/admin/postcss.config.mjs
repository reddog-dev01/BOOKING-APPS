// PostCSS setup aligned with Tailwind CSS v3 to avoid v4 plugin expectations.
// Using object syntax keeps Next.js tooling stable across admin/web workspaces.
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default {
  plugins: {
    tailwindcss,
    autoprefixer,
  },
};
