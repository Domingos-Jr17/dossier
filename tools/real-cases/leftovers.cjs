// Texts still in English on each page with the interface in Portuguese.
const { open } = require("./rc.cjs");
const KEEP = '[data-no-translate],[contenteditable],pre,code,textarea,article[aria-label="Resume"],article[aria-label="Cover letter"],article[aria-label="Email"],[role="region"][aria-label="Posting text"],script,style';
(async () => {
  const { browser, context, page } = await open();
  await context.addCookies([{ name: "dossier_language", value: "pt-PT", url: "http://127.0.0.1:3200" }]);
  const all = new Map();
  for (const path of process.env.PAGES.split(",")) {
    await page.goto(path);
    await page.waitForTimeout(1800);
    const left = await page.evaluate((keep) => {
      const out = [];
      const english = /\b(the|and|you|your|to|of|for|with|in|is|it|no|not|yet|all|from|this|that|on|at|by|or|be|are|was|an|a)\b|ing\b|ed\b|s\b/i;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeType === 3) {
          const v = n.nodeValue.replace(/\s+/g, " ").trim();
          if (v && /[A-Za-z]{3}/.test(v) && !n.parentElement.closest(keep)) out.push(v);
        } else for (const a of ["placeholder", "aria-label", "title"]) { const v = n.getAttribute(a); if (v && !n.closest(keep)) out.push(`@${a}: ${v}`); }
      }
      return out;
    }, KEEP);
    for (const v of left) if (!all.has(v)) all.set(v, path);
  }
  for (const [v, p] of all) console.log(`${p}\t${v}`);
  await browser.close();
})();
