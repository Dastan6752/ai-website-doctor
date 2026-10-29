import { expect, test, type Page } from "@playwright/test";

const BROKEN_PAGE = `<!doctype html>
<html>
<head>
  <title>Hi</title>
  <meta name="robots" content="noindex">
  <script src="/blocking.js"></script>
</head>
<body>
  <h1>Welcome</h1>
  <img src="hero.jpg">
  <a href="/about"></a>
  <form><input type="email" name="email"></form>
  <div style="width:960px">wide</div>
</body>
</html>`;

const HEALTHY_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acme Bakery in Leeds | Fresh sourdough daily</title>
  <meta name="description" content="Family bakery on Kirkgate, Leeds. Fresh sourdough, pastries and coffee. Open 7 days. Order online for next-day collection.">
  <link rel="canonical" href="https://acme.test/">
  <link rel="icon" href="/favicon.ico">
  <meta property="og:title" content="Acme Bakery in Leeds">
  <meta property="og:description" content="Fresh sourdough, pastries and coffee. Open 7 days.">
  <meta property="og:image" content="https://acme.test/og.jpg">
  <style>@media (max-width: 640px){.c{display:block}} @media (max-width: 1024px){.c{gap:1rem}} @media (min-width: 1025px){.w{max-width:1100px}}</style>
</head>
<body>
  <a href="#main">Skip to content</a>
  <header><nav><a href="/">Home</a><a href="/menu">Our menu</a><a href="/about">About us</a><a href="/contact">Contact</a><a href="/hours">Opening hours</a></nav></header>
  <main id="main">
    <h1>Fresh sourdough baked every morning in Leeds</h1>
    <h2>Today's loaves</h2>
    <p>${"Our bakers start at 4am every day. ".repeat(40)}</p>
    <img src="loaf.jpg" alt="Crusty sourdough loaf on a wooden board" width="800" height="600">
    <form>
      <label for="email">Your email</label>
      <input id="email" type="email" name="email">
      <button type="submit">Send</button>
    </form>
  </main>
  <footer>© Acme</footer>
</body>
</html>`;

async function pasteAndAnalyze(page: Page, html: string, label = "https://fixture.test") {
  await page.getByRole("button", { name: /paste html/i }).click();
  await page.locator("#paste-html").fill(html);
  const hint = page.getByPlaceholder(/which address/i);
  if (await hint.count()) await hint.fill(label);
  await page.getByRole("button", { name: /analyze html/i }).click();
  await expect(page.getByRole("heading", { name: /healthy|needs attention|several problems|serious problems|not scored/i })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("AI Website Doctor — landing", () => {
  test("shows the hero, URL field, analyze button, and honesty copy", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AI Website Doctor/i);
    await expect(page.getByRole("heading", { name: /find out what's wrong/i })).toBeVisible();
    await expect(page.getByLabel(/your website address/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /analyze website/i })).toBeVisible();
    await expect(page.getByText(/no invented results/i)).toBeVisible();
    await expect(page.getByText(/not implemented/i).first()).toBeVisible();
    await expect(page.getByText(/core web vitals/i)).toBeVisible();
  });

  test("rejects an invalid URL without fabricating a report", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/your website address/i).fill("not a website");
    await page.getByRole("button", { name: /analyze website/i }).click();
    // "not a website" normalises to https://not a website and is rejected by the
    // missing-valid-domain check. Assert that real message, not a guess.
    await expect(
      page.getByText(/missing a valid domain|looks? like a valid web address/i),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /healthy|needs attention|several problems/i })).toHaveCount(0);
  });

  test("rejects localhost without fabricating a report", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/your website address/i).fill("localhost:3000");
    await page.getByRole("button", { name: /analyze website/i }).click();
    await expect(page.getByText(/local addresses can't be reached/i)).toBeVisible();
  });
});

test.describe("AI Website Doctor — pasted HTML report", () => {
  test("broken page produces a real report with the four categories", async ({ page }) => {
    await page.goto("/");
    await pasteAndAnalyze(page, BROKEN_PAGE);

    await expect(page.getByRole("heading", { name: /performance/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /mobile friendliness/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /accessibility/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /seo & discoverability/i })).toBeVisible();

    // Evidence from THIS html, not invented
    await expect(page.getByText(/noindex/i).first()).toBeVisible();
    await expect(page.getByText(/hero\.jpg/i).first()).toBeVisible();

    // Honesty: pasted HTML means no network checks
    await expect(page.getByText(/pasted/i).first()).toBeVisible();
    await expect(page.getByText(/not implemented in this tool/i).first()).toBeVisible();

    // The word "Download" inside the report button is hidden with `hidden sm:inline` on
    // small screens, so on mobile the button reads as "report". Match either.
    await expect(page.getByRole("button", { name: /download report|report/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^json$/i })).toBeVisible();
  });

  test("healthy page scores well and lists passing checks", async ({ page }) => {
    await page.goto("/");
    await pasteAndAnalyze(page, HEALTHY_PAGE, "https://acme.test/");
    await expect(page.getByRole("heading", { name: /healthy|needs attention/i })).toBeVisible();
    await expect(page.getByText(/fresh sourdough baked every morning/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /new scan/i })).toBeVisible();
  });

  test("filter chips switch the visible checks", async ({ page }) => {
    await page.goto("/");
    await pasteAndAnalyze(page, BROKEN_PAGE);
    await page.getByRole("button", { name: /problems/i }).click();
    await expect(page.getByText(/problem found|needs work/i).first()).toBeVisible();
    await page.getByRole("button", { name: /passed/i }).click();
  });

  test("new scan returns to the landing form", async ({ page }) => {
    await page.goto("/");
    await pasteAndAnalyze(page, BROKEN_PAGE);
    await page.getByRole("button", { name: /new scan/i }).click();
    await expect(page.getByLabel(/your website address/i)).toBeVisible();
  });
});

test.describe("AI Website Doctor — mobile layout", () => {
  test("landing is usable at desktop width without horizontal overflow", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "chromium") return;
    await page.goto("/");
    await expect(page.getByRole("button", { name: /analyze website/i })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(8);
  });

  test("landing is usable at a phone width", async ({ page }, testInfo) => {
    if (testInfo.project.name !== "mobile") return;
    await page.goto("/");
    const btn = page.getByRole("button", { name: /analyze website/i });
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    // No horizontal overflow of the document
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(8);
  });
});
