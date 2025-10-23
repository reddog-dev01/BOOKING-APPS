import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function tryLoad(id) {
  try {
    const mod = require(id);
    return typeof mod === "object" && mod !== null && "default" in mod ? mod.default : mod;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

const tailwindPlugin = tryLoad("@tailwindcss/postcss") ?? tryLoad("tailwindcss");

if (!tailwindPlugin) {
  throw new Error(
    "Tailwind CSS PostCSS plugin is missing. Install '@tailwindcss/postcss' (Tailwind v4) or 'tailwindcss' (Tailwind v3).",
  );
}

const autoprefixerPlugin = tryLoad("autoprefixer");

const plugins = [tailwindPlugin];

if (autoprefixerPlugin) {
  plugins.push(autoprefixerPlugin);
}

const config = {
  plugins,
};

export default config;
