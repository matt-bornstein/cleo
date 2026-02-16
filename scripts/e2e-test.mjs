#!/usr/bin/env node
/**
 * E2E test: sign up, create document, verify editor loads.
 */
import puppeteer from "puppeteer";

const BASE_URL = "http://localhost:3000";
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = "testpassword123";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log("🚀 Starting E2E test...");
  console.log(`   Email: ${TEST_EMAIL}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Capture browser errors
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log(`   [ERR] ${msg.text()}`);
    });

    // 1. Go to sign-in
    console.log("\n1️⃣  Navigate to sign-in...");
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle2" });
    console.log("   ✅ Sign-in page loaded");

    // 2. Click "Sign up" link
    console.log("\n2️⃣  Switch to sign-up...");
    await page.click("button.underline"); // The "Sign up" is a button with underline class
    await sleep(500);

    // 3. Fill the form using page.type (triggers React change events properly)
    console.log("\n3️⃣  Fill form...");
    
    // Name field (only in sign-up mode)
    await page.type('input[name="name"]', "Test User");
    await page.type('input[name="email"]', TEST_EMAIL);
    await page.type('input[name="password"]', TEST_PASSWORD);
    await sleep(300);
    await page.screenshot({ path: "/tmp/e2e-03-filled.png" });
    console.log("   Form filled");

    // 4. Click the submit button
    console.log("\n4️⃣  Click Create Account...");
    await page.click('button[type="submit"]');
    console.log("   Clicked submit button");
    
    // Wait for the auth to process
    await sleep(6000);
    await page.screenshot({ path: "/tmp/e2e-04-after-submit.png" });

    const url = page.url();
    console.log(`   URL: ${url}`);

    // Check for errors
    const errText = await page.$eval(".text-destructive", (el) => el.textContent).catch(() => null);
    if (errText) console.log(`   ⚠️  Error: ${errText}`);

    // Did we get redirected?
    if (url === `${BASE_URL}/` || url.endsWith(":3000/") || url.endsWith(":3000")) {
      console.log("   ✅ Redirected to home page!");
      await sleep(2000);
      await page.screenshot({ path: "/tmp/e2e-05-home.png" });

      // Create a document
      console.log("\n5️⃣  Create document...");
      await page.click('button:has-text("New")').catch(async () => {
        // Fallback: find button by text
        const btns = await page.$$("button");
        for (const btn of btns) {
          const text = await btn.evaluate((el) => el.textContent);
          if (text?.includes("New")) { await btn.click(); break; }
        }
      });
      await sleep(1000);
      await page.screenshot({ path: "/tmp/e2e-06-modal.png" });

      const titleInput = await page.$('input[placeholder="Document title"]');
      if (titleInput) {
        await titleInput.type("E2E Test Document");
        const createBtns = await page.$$("button");
        for (const btn of createBtns) {
          const text = await btn.evaluate((el) => el.textContent);
          if (text?.trim() === "Create") { await btn.click(); break; }
        }
        await sleep(4000);
        await page.screenshot({ path: "/tmp/e2e-07-editor.png" });

        if (page.url().includes("/editor/")) {
          await sleep(3000);
          await page.screenshot({ path: "/tmp/e2e-08-final.png" });
          console.log(`   URL: ${page.url()}`);
          console.log("\n✅ E2E TEST PASSED! Full flow works.");
        } else {
          console.log(`   URL: ${page.url()}`);
        }
      } else {
        console.log("   Modal didn't appear");
      }
    } else {
      console.log("   Still on sign-in page after submit");
    }
  } catch (err) {
    console.error("\n❌ Error:", err.message);
  } finally {
    await browser.close();
    console.log("\n📸 Screenshots in /tmp/e2e-*.png");
  }
}

run().catch(console.error);
