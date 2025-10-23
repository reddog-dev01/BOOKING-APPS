import autoprefixer from "autoprefixer";

async function loadTailwindPlugin() {
  try {
    const mod = await import("@tailwindcss/postcss");
    return mod.default ?? mod;
  } catch (error) {
    if (error && typeof error === "object") {
      const code = /** @type {{ code?: string }} */ (error).code;
      if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
        const legacy = await import("tailwindcss");
        return legacy.default ?? legacy;
      }
      if (error instanceof Error && error.message.includes("@tailwindcss/postcss")) {
        const legacy = await import("tailwindcss");
        return legacy.default ?? legacy;
      }
    }
    throw error;
  }
}

const tailwindEntry = await loadTailwindPlugin();
const tailwindPlugin = typeof tailwindEntry === "function" ? tailwindEntry() : tailwindEntry;

const config = {
  plugins: [tailwindPlugin, autoprefixer()],
};

export default config;
