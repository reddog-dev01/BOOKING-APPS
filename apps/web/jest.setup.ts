import { TextDecoder, TextEncoder } from "util";

try {
  // Lazily load jest-dom khi đã cài để có matcher DOM nâng cao.
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  require("@testing-library/jest-dom");
} catch (error) {
  if (process.env.DEBUG?.includes("jest")) {
    // eslint-disable-next-line no-console
    console.warn("@testing-library/jest-dom is not installed; DOM-specific matchers will be unavailable.");
  }
}

if (typeof globalThis.TextEncoder === "undefined") {
  (globalThis as { TextEncoder?: typeof TextEncoder }).TextEncoder = TextEncoder;
}

if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as { TextDecoder?: typeof TextDecoder }).TextDecoder = TextDecoder as typeof TextDecoder;
}
