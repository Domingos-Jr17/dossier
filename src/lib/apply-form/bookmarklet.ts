import type { FormField } from "./fields";

// A bookmark that fills in an application form in the page it's opened on.
// The values are in the link itself: it runs in the browser, on the page of
// the site, and nothing goes to Dossier or anywhere else. It never presses
// Send, and leaves out what only a person can do (the CV file, accepting a
// privacy policy). Its matching of lists by words mirrors match-option.ts.

const PAGE_SCRIPT = `(function (fields) {
  var fold = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); };
  var stem = function (w) { return w.length > 4 ? w.replace(/(as|os|a|o|e|s)$/, "") : w; };
  var STOP = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, em: 1, a: 1, o: 1, para: 1, senior: 1, junior: 1, sr: 1, jr: 1, of: 1, the: 1, and: 1 };
  var words = function (s) { return fold(s).split(" ").filter(function (w) { return w.length > 1 && !STOP[w]; }).map(stem); };
  var controls = [].slice.call(document.querySelectorAll("input, select, textarea")).filter(function (el) {
    var type = (el.getAttribute("type") || "").toLowerCase();
    return type !== "hidden" && type !== "file" && type !== "checkbox" && type !== "radio" && type !== "password" && type !== "submit" && !el.disabled;
  });
  var labelOf = function (el) {
    var text = (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("placeholder") || "") + " " + (el.getAttribute("name") || "");
    if (el.id) { var l = document.querySelector('label[for="' + el.id + '"]'); if (l) text += " " + l.textContent; }
    var wrap = el.closest("label"); if (wrap) text += " " + wrap.textContent;
    return fold(text);
  };
  var find = function (f) {
    var byName = controls.filter(function (el) { return f.names.indexOf(el.getAttribute("name")) >= 0; });
    if (byName.length) return byName[f.index || 0] || null;
    if (f.index) return null;
    return controls.filter(function (el) { return f.labels.some(function (l) { return labelOf(el).indexOf(l) >= 0; }); })[0] || null;
  };
  var setValue = function (el, value) {
    var proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  var pick = function (el, f) {
    var options = [].slice.call(el.options).filter(function (o) { return o.value !== ""; });
    if (f.code) { var byCode = options.filter(function (o) { return o.value === f.code; })[0]; if (byCode) return byCode.value; }
    var wanted = words(f.value), target = fold(f.value), best = null, bestScore = 0;
    options.forEach(function (o) {
      if (fold(o.text) === target) { best = o; bestScore = 2; return; }
      var ow = words(o.text); if (!ow.length || !wanted.length || bestScore === 2) return;
      var shared = ow.filter(function (w) { return wanted.indexOf(w) >= 0; }).length;
      var score = shared / Math.max(ow.length, wanted.length);
      if (shared && score >= 0.5 && score > bestScore) { best = o; bestScore = score; }
    });
    return best ? best.value : null;
  };
  var filled = 0, left = [];
  fields.forEach(function (f) {
    if (!f.value) { if (f.required) left.push(f.label); return; }
    var el = find(f);
    if (!el) { left.push(f.label); return; }
    var value = f.value;
    if (el.tagName === "SELECT") { value = pick(el, f); if (value === null) { left.push(f.label); return; } }
    setValue(el, value); filled++;
  });
  alert("Dossier: " + filled + " campos preenchidos." + (left.length ? "\\n\\nPor preencher ou escolher: " + left.join(", ") + "." : "") + "\\n\\nAnexe o currículo, leia e aceite a política de privacidade e carregue em Enviar você mesmo.");
})`;

/** The `javascript:` link that fills `fields` in. Only the fields with something to type are in it. */
export function bookmarklet(fields: readonly FormField[]): string {
  const data = fields
    .filter((field) => field.value.trim() || field.required)
    .map(({ names, labels, index, label, value, code, required }) => ({ names, labels, ...(index === undefined ? {} : { index }), label, value, ...(code ? { code } : {}), required }));
  return `javascript:${encodeURIComponent(`${PAGE_SCRIPT}(${JSON.stringify(data)});void 0;`)}`;
}
