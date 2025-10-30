#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const maskKey = (value) => {
  if (!value) {
    return "<trống>";
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

const expectedServerKey =
  process.env.PLACES_API_KEY ?? process.env.PLACES_KEY ?? null;
const expectedBrowserKey =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
  process.env.MAPS_JS_KEY ??
  null;

const denylist = (process.env.GOOGLE_KEY_DENYLIST ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const keyHints = {
  PLACES_API_KEY: {
    friendlyName: "server PLACES_API_KEY",
    expected: expectedServerKey,
  },
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: {
    friendlyName: "browser NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    expected: expectedBrowserKey,
  },
};

const runtimeTargets = [
  {
    file: "apps/api/.env",
    keys: ["PLACES_API_KEY"],
  },
  {
    file: "apps/web/.env",
    keys: ["PLACES_API_KEY"],
    optional: true,
  },
  {
    file: "apps/web/.env.local",
    keys: ["PLACES_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"],
  },
  {
    file: "apps/admin/.env.local",
    keys: ["PLACES_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"],
    optional: true,
  },
];

const placeholderPattern = /__REPLACE_WITH_[A-Z_]+__/;
const apiKeyPattern = /^AIza[0-9A-Za-z_\-]{20,}$/;

const errors = [];
const warnings = [];

function pushError(message) {
  errors.push(message);
}

function pushWarning(message) {
  warnings.push(message);
}

function parseEnv(content) {
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (value.startsWith("\"") || value.startsWith("'")) {
      const quote = value[0];
      const closingIndex = value.indexOf(quote, 1);

      if (closingIndex !== -1) {
        value = value.slice(1, closingIndex);
      } else {
        value = value.slice(1);
      }
    } else {
      const commentIndex = value.indexOf("#");

      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    result[key] = value;
  }

  return result;
}

async function readEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function validateValue({ file, key, value }) {
  const hint = keyHints[key];

  if (!value) {
    pushError(`${file}: thiếu biến ${key}.`);
    return;
  }

  if (placeholderPattern.test(value)) {
    pushError(`${file}: ${key} vẫn dùng placeholder (${value}).`);
    return;
  }

  if (denylist.includes(value)) {
    pushError(
      `${file}: ${key} trùng với giá trị nằm trong GOOGLE_KEY_DENYLIST (${maskKey(value)}).`,
    );
  }

  if (!apiKeyPattern.test(value)) {
    pushWarning(
      `${file}: ${key} không giống định dạng API key của Google (${maskKey(value)}). Kiểm tra lại giới hạn hoặc copy/paste.`,
    );
  }

  if (hint?.expected && value !== hint.expected) {
    pushError(
      `${file}: ${key} khác với biến shell đã export (${maskKey(value)} ≠ ${maskKey(
        hint.expected,
      )}). Đảm bảo mọi file dùng cùng một key.`,
    );
  }
}

async function main() {
  console.log("🔍 Đang kiểm tra Google API key trong các file .env…\n");

  for (const target of runtimeTargets) {
    const absolutePath = path.join(repoRoot, target.file);
    const content = await readEnvFile(absolutePath);

    if (content === null) {
      if (!target.optional) {
        pushError(`${target.file}: không tồn tại. Chạy lại bước sao chép .env.`);
      } else {
        console.log(`⚠️  Bỏ qua ${target.file} (không tồn tại).`);
      }
      continue;
    }

    const parsed = parseEnv(content);

    for (const key of target.keys) {
      const value = parsed[key];
      validateValue({ file: target.file, key, value });

      if (value) {
        console.log(
          `✔ ${target.file}: ${key} = ${maskKey(value)}${
            keyHints[key]?.expected
              ? value === keyHints[key].expected
                ? " (khớp biến shell)"
                : ""
              : ""
          }`,
        );
      }
    }
  }

  if (warnings.length > 0) {
    console.log("\n⚠️  Cảnh báo:");
    for (const warning of warnings) {
      console.log(` - ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ Phát hiện vấn đề với Google API key:");
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log("\n✅ Tất cả file .env đã chứa Google API key hợp lệ và đồng bộ.");
}

main().catch((error) => {
  console.error("Không thể kiểm tra Google API key:", error);
  process.exit(1);
});
