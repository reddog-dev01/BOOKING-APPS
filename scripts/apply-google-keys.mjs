#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const serverKey = process.env.PLACES_API_KEY ?? process.env.PLACES_KEY ?? null;
const browserKey =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.MAPS_JS_KEY ?? null;
const webPort = process.env.WEB_PORT ?? "3005";

if (!serverKey) {
  console.error(
    "❌ Thiếu PLACES_API_KEY (hoặc PLACES_KEY). Export giá trị key server trước khi chạy script.",
  );
  process.exitCode = 1;
}

if (!browserKey) {
  console.error(
    "❌ Thiếu NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (hoặc MAPS_JS_KEY). Export giá trị key browser trước khi chạy script.",
  );
  process.exitCode = 1;
}

if (!serverKey || !browserKey) {
  process.exit(process.exitCode ?? 1);
}

const targets = [
  {
    file: ".env",
    example: ".env.example",
    entries: [
      { key: "PLACES_API_KEY", value: serverKey },
      { key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", value: browserKey },
    ],
  },
  {
    file: "apps/api/.env",
    example: "apps/api/.env.example",
    entries: [{ key: "PLACES_API_KEY", value: serverKey }],
  },
  {
    file: "apps/web/.env",
    example: "apps/web/.env.example",
    entries: [
      { key: "PLACES_API_KEY", value: serverKey },
      {
        key: "GOOGLE_MAPS_REFERER",
        value: `http://localhost:${webPort}/`,
      },
    ],
  },
  {
    file: "apps/web/.env.local",
    example: "apps/web/.env.local.example",
    entries: [
      { key: "PLACES_API_KEY", value: serverKey },
      {
        key: "GOOGLE_MAPS_REFERER",
        value: `http://localhost:${webPort}/`,
      },
      {
        key: "NEXT_PUBLIC_API_BASE",
        value: "http://127.0.0.1:3006",
        optional: true,
      },
      {
        key: "INTERNAL_API_BASE",
        value: "http://127.0.0.1:3006",
        optional: true,
      },
      {
        key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
        value: browserKey,
      },
    ],
  },
  {
    file: "apps/admin/.env.local",
    example: "apps/admin/.env.local.example",
    optional: true,
    entries: [
      { key: "PLACES_API_KEY", value: serverKey },
      {
        key: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
        value: browserKey,
      },
    ],
  },
];

async function ensureFile(relativePath, examplePath, optional = false) {
  const absolutePath = path.join(repoRoot, relativePath);

  try {
    await fs.access(absolutePath, fs.constants.F_OK);
    return absolutePath;
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  if (!examplePath) {
    if (optional) {
      return null;
    }

    await fs.writeFile(absolutePath, "", "utf8");
    return absolutePath;
  }

  const exampleAbsolute = path.join(repoRoot, examplePath);

  try {
    await fs.copyFile(exampleAbsolute, absolutePath);
    console.log(`📄 Sao chép ${examplePath} → ${relativePath}`);
    return absolutePath;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      if (optional) {
        console.log(`⚠️  Bỏ qua ${relativePath} (không tìm thấy file và đây là mục tùy chọn).`);
        return null;
      }

      throw new Error(
        `Không tìm thấy ${relativePath} hoặc ${examplePath}. Tạo thủ công trước khi chạy lại.`,
      );
    }

    throw error;
  }
}

function updateContent(content, { key, value }) {
  const doubleQuoted = new RegExp(`^${key}="[^"]*"`, "m");
  const singleQuoted = new RegExp(`^${key}='[^']*'`, "m");
  const bare = new RegExp(`^${key}=[^\n]*`, "m");

  if (doubleQuoted.test(content)) {
    return content.replace(doubleQuoted, `${key}=${value}`);
  }

  if (singleQuoted.test(content)) {
    return content.replace(singleQuoted, `${key}=${value}`);
  }

  if (bare.test(content)) {
    return content.replace(bare, `${key}=${value}`);
  }

  const needsNewline = content.length > 0 && !content.endsWith("\n");
  return `${content}${needsNewline ? "\n" : ""}${key}=${value}\n`;
}

async function applyEntries(filePath, entries) {
  let content = "";
  let existing = false;

  try {
    content = await fs.readFile(filePath, "utf8");
    existing = true;
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }

  let updatedContent = content;
  const appliedKeys = [];

  for (const entry of entries) {
    if (entry.optional && !existing) {
      continue;
    }

    const nextContent = updateContent(updatedContent, {
      key: entry.key,
      value: entry.value,
    });

    if (nextContent !== updatedContent) {
      appliedKeys.push(entry.key);
    }

    updatedContent = nextContent;
  }

  if (updatedContent !== content) {
    await fs.writeFile(filePath, updatedContent, "utf8");
    console.log(`✅ Cập nhật ${path.relative(repoRoot, filePath)} (${appliedKeys.join(", ")}).`);
  } else {
    console.log(`ℹ️  Không cần thay đổi cho ${path.relative(repoRoot, filePath)}.`);
  }
}

async function main() {
  console.log("🔧 Đang ghi Google API key vào các file .env…\n");

  for (const target of targets) {
    const absolutePath = await ensureFile(
      target.file,
      target.example,
      target.optional ?? false,
    );

    if (!absolutePath) {
      continue;
    }

    await applyEntries(absolutePath, target.entries);
  }

  console.log("\n🎉 Hoàn tất. Chạy 'pnpm check:google-keys' để xác thực lại giá trị.");
}

main().catch((error) => {
  console.error("❌ apply-google-keys thất bại:", error);
  process.exit(1);
});
