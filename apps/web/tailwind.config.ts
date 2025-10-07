import type { Config } from "tailwindcss";
// Nếu muốn dùng import thay vì require cho plugin (ESM friendly):
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";
import aspectRatio from "@tailwindcss/aspect-ratio";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // Nếu dùng UI lib dùng chung trong monorepo:
    "../../packages/ui/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#87CEFA",
          dark: "#60A5FA",
        },
      },
    },
  },
  plugins: [
    forms,
    typography,
    aspectRatio,
  ],
};

export default config;
