import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function resolvePluginName(id) {
  try {
    require.resolve(id);
    return id;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

const tailwindPluginName = resolvePluginName("@tailwindcss/postcss") ?? resolvePluginName("tailwindcss");

if (!tailwindPluginName) {
  throw new Error(
    "Tailwind CSS PostCSS plugin is missing. Install '@tailwindcss/postcss' (Tailwind v4) or 'tailwindcss' (Tailwind v3).",
  );
}

if (!resolvePluginName("autoprefixer")) {
  throw new Error("Autoprefixer is required. Install it with 'pnpm add -D autoprefixer'.");
}

const config = {
  plugins: {
    [tailwindPluginName]: {},
    autoprefixer: {},
  },
};

export default config;
