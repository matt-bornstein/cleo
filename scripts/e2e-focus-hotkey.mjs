#!/usr/bin/env node
/**
 * E2E test for the Cmd/Ctrl+K editor <-> chat focus shortcut.
 *
 * Requires `npm run convex:dev` and `npm run dev` to be running.
 * Usage: node scripts/e2e-focus-hotkey.mjs [--headful] [--shots <dir>]
 */
import puppeteer from "puppeteer";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = `hotkey-${Date.now()}@example.com`;
const TEST_PASSWORD = "testpassword123";
const HEADFUL = process.argv.includes("--headful");
const SHOT_DIR =
  process.argv.includes("--shots")
    ? process.argv[process.argv.indexOf("--shots") + 1]
    : "/tmp/hotkey-e2e";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  if (actual === expected) {
    passed += 1;
    console.log(`   ✅ ${label}`);
  } else {
    failures.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    console.log(`   ❌ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** Coarse name for whatever currently has focus. */
function readFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return "body";
  if (el.hasAttribute("data-chat-input")) return "chat-input";
  if (el.classList.contains("tiptap-content")) return "editor";
  return el.tagName.toLowerCase();
}

/** Overrides both platform sources the app reads, without a reload. */
async function setPlatform(page, uaDataPlatform, legacyPlatform) {
  await page.evaluate(
    (uaDataPlatform, legacyPlatform) => {
      Object.defineProperty(navigator, "userAgentData", {
        value: { platform: uaDataPlatform },
        configurable: true,
      });
      Object.defineProperty(navigator, "platform", {
        value: legacyPlatform,
        configurable: true,
      });
    },
    uaDataPlatform,
    legacyPlatform
  );
}

async function clickButtonByText(page, text) {
  const buttons = await page.$$("button");
  for (const button of buttons) {
    const label = await button.evaluate((el) => el.textContent?.trim());
    if (label === text || label?.includes(text)) {
      await button.click();
      return true;
    }
  }
  return false;
}

async function signUpAndOpenDocument(page) {
  console.log("\n1️⃣  Sign up");
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle2" });
  await page.click("button.underline");
  await sleep(500);
  await page.type('input[name="name"]', "Hotkey Tester");
  await page.type('input[name="email"]', TEST_EMAIL);
  await page.type('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => !window.location.pathname.startsWith("/sign-in"),
    { timeout: 30000 }
  );
  console.log("   ✅ Signed in");

  console.log("\n2️⃣  Create a document");
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        b.textContent?.includes("New document")
      ),
    { timeout: 30000 }
  );
  // The app opens new documents in a tab; keep the flow in this page instead.
  await page.evaluate(() => {
    window.open = (url) => {
      window.location.href = url;
      return null;
    };
  });
  await clickButtonByText(page, "New document");
  await page.waitForFunction(() => window.location.pathname.includes("/editor/"), {
    timeout: 30000,
  });
  await page.waitForSelector(".tiptap-content", { timeout: 30000 });
  await page.waitForSelector("[data-chat-input]", { timeout: 30000 });
  await sleep(2500);
  console.log("   ✅ Editor and AI panel are ready");
}

async function run() {
  const browser = await puppeteer.launch({
    headless: HEADFUL ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on("pageerror", (err) => console.log(`   [PAGE ERROR] ${err.message}`));

    await signUpAndOpenDocument(page);

    console.log("\n3️⃣  Type in the content pane");
    await page.click(".tiptap-content");
    await page.type(".tiptap-content", "Focus starts in the document.");
    check("focus is in the editor", await page.evaluate(readFocus), "editor");
    await page.screenshot({ path: `${SHOT_DIR}/01-editor-focused.png` });

    console.log("\n4️⃣  Ctrl+K moves focus to the chat input");
    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    await sleep(200);
    check("focus is in the chat input", await page.evaluate(readFocus), "chat-input");

    await page.keyboard.type("Summarize this document.");
    check(
      "typing lands in the chat input",
      await page.$eval("[data-chat-input]", (el) => el.value),
      "Summarize this document."
    );
    check(
      "editor text is unchanged",
      await page.$eval(".tiptap-content", (el) => el.textContent),
      "Focus starts in the document."
    );
    await page.screenshot({ path: `${SHOT_DIR}/02-chat-focused.png` });

    console.log("\n5️⃣  Ctrl+K moves focus back to the content pane");
    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    await sleep(200);
    check("focus is back in the editor", await page.evaluate(readFocus), "editor");

    await page.keyboard.type(" Back in the document.");
    check(
      "typing resumes at the previous caret position",
      await page.$eval(".tiptap-content", (el) => el.textContent),
      "Focus starts in the document. Back in the document."
    );
    check(
      "the chat draft is preserved",
      await page.$eval("[data-chat-input]", (el) => el.value),
      "Summarize this document."
    );
    await page.screenshot({ path: `${SHOT_DIR}/03-editor-refocused.png` });

    console.log("\n6️⃣  Ctrl+K reveals a collapsed AI panel");
    await page.click('button[title="Hide panel"]');
    await sleep(400);
    check(
      "the AI panel is hidden",
      await page.evaluate(
        () => document.querySelector("[data-chat-panel]") === null
      ),
      true
    );
    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    await sleep(500);
    check("the panel reopens with the chat focused", await page.evaluate(readFocus), "chat-input");

    console.log("\n7️⃣  The shortcut is ignored while a modal is open");
    await clickButtonByText(page, "Share");
    await page.waitForSelector('[data-slot="dialog-content"][data-state="open"]', {
      timeout: 10000,
    });
    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    await sleep(300);
    check(
      "focus stays inside the dialog",
      await page.evaluate(() =>
        document
          .querySelector('[data-slot="dialog-content"]')
          ?.contains(document.activeElement)
      ),
      true
    );
    await page.keyboard.press("Escape");
    await sleep(400);

    console.log("\n8️⃣  Cmd+K is the shortcut on macOS");
    await setPlatform(page, "macOS", "MacIntel");
    await page.click(".tiptap-content");
    check("focus is in the editor", await page.evaluate(readFocus), "editor");
    await page.keyboard.down("Meta");
    await page.keyboard.press("k");
    await page.keyboard.up("Meta");
    await sleep(200);
    check("Cmd+K focuses the chat input", await page.evaluate(readFocus), "chat-input");

    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    await sleep(200);
    check("Ctrl+K is ignored on macOS", await page.evaluate(readFocus), "chat-input");

    await setPlatform(page, "Linux", "Linux x86_64");

    console.log("\n9️⃣  Modified variants do not trigger the shortcut");
    await page.click(".tiptap-content");
    for (const modifier of ["Shift", "Alt"]) {
      await page.keyboard.down("Control");
      await page.keyboard.down(modifier);
      await page.keyboard.press("k");
      await page.keyboard.up(modifier);
      await page.keyboard.up("Control");
      await sleep(150);
      check(`Ctrl+${modifier}+K leaves focus alone`, await page.evaluate(readFocus), "editor");
    }

    console.log("\n🔟 The shortcut is inert below the desktop breakpoint");
    await page.setViewport({ width: 800, height: 900 });
    await sleep(500);
    await page.click(".tiptap-content");
    await page.keyboard.down("Control");
    await page.keyboard.press("k");
    await page.keyboard.up("Control");
    await sleep(300);
    check("focus stays in the editor on narrow viewports", await page.evaluate(readFocus), "editor");
    await page.setViewport({ width: 1440, height: 900 });
    await sleep(500);

    console.log("\n1️⃣1️⃣ The AI panel shows the shortcut hint");
    check(
      "the header renders a Ctrl+K hint",
      await page.$eval("[data-chat-panel] kbd", (el) => el.textContent.trim()),
      "Ctrl+K"
    );
    await page.screenshot({ path: `${SHOT_DIR}/04-shortcut-hint.png` });
  } finally {
    await browser.close();
  }

  console.log(`\n${"─".repeat(60)}`);
  if (failures.length === 0) {
    console.log(`✅ ALL ${passed} CHECKS PASSED`);
    console.log(`📸 Screenshots in ${SHOT_DIR}`);
  } else {
    console.log(`❌ ${failures.length} of ${passed + failures.length} checks failed:`);
    for (const failure of failures) console.log(`   - ${failure}`);
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("\n❌ Test crashed:", err);
  process.exitCode = 1;
});
