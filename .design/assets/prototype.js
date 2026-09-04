import { prepare, layout } from "./pretext.js";

const prepared = new Map();

async function prepareText() {
  await document.fonts.ready;
  for (const element of document.querySelectorAll("[data-pretext]")) {
    prepared.set(element, prepare(element.textContent || "", getComputedStyle(element).font));
  }
  relayout();
}

function relayout() {
  for (const [element, handle] of prepared) {
    if (!element.clientWidth) continue;
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight) || 22;
    const { height } = layout(handle, element.clientWidth, lineHeight);
    element.style.minHeight = `${Math.ceil(height)}px`;
  }
}

document.querySelectorAll("[data-range]").forEach((button) => {
  button.addEventListener("click", () => {
    button.parentElement?.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const range = button.getAttribute("data-range");
    document.querySelectorAll("[data-range-label]").forEach((label) => { label.textContent = range || "30d"; });
  });
});

const search = document.querySelector("[data-event-search]");
search?.addEventListener("input", () => {
  const value = search.value.toLowerCase();
  document.querySelectorAll("[data-event-row]").forEach((row) => {
    row.hidden = !row.textContent.toLowerCase().includes(value);
  });
});

const sheet = document.querySelector("[data-detail-sheet]");
document.querySelectorAll("[data-event-row]").forEach((row) => {
  row.addEventListener("click", () => {
    const name = row.getAttribute("data-event-name") || "Event detail";
    sheet?.querySelector("[data-sheet-event]")?.replaceChildren(document.createTextNode(name));
    sheet?.showModal();
  });
});
document.querySelector("[data-sheet-close]")?.addEventListener("click", () => sheet?.close());

new ResizeObserver(relayout).observe(document.body);
prepareText();
