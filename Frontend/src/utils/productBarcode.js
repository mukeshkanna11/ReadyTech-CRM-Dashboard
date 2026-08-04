/*
  Shared product barcode helpers.

  Single source of truth for reading, matching and printing a product barcode.
  Products (CRM + ERP) consume these today; Inventory, Sales Orders, Purchase
  Orders, Warehouse and Billing can reuse the same helpers for scanning
  without touching the Products UI.
*/

/** Barcode value returned by the API for a product (never null). */
export const getProductBarcode = (product) =>
  String(product?.barcode || "").trim();

/**
 * Cleans raw scanner input. Hardware scanners emit the code followed by
 * Enter / carriage return and sometimes padding whitespace.
 */
export const normalizeBarcode = (input) =>
  String(input ?? "")
    .replace(/[\r\n\t]/g, "")
    .trim();

/** Resolves a scanned code against an already loaded product list. */
export const findProductByBarcode = (products, code) => {
  const scanned = normalizeBarcode(code).toUpperCase();
  if (!scanned) return null;
  return (
    (products || []).find(
      (p) => getProductBarcode(p).toUpperCase() === scanned
    ) || null
  );
};

const escapeHtml = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char])
  );

/**
 * Prints a barcode label containing only the product name, the barcode image
 * and the barcode number.
 *
 * @param product   Product (or form state) holding `name` and `barcode`.
 * @param sourceEl  DOM node wrapping a <ProductBarcodeImage /> whose SVG is
 *                  cloned into the print document.
 */
export function printProductBarcode(product, sourceEl) {
  const code = getProductBarcode(product);
  if (!code) return;

  const name = product?.name || "Product";
  const svg = sourceEl?.querySelector("svg")?.outerHTML || "";

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
  <head>
    <title>${escapeHtml(name)} - ${escapeHtml(code)}</title>
    <style>
      @page { margin: 8mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        color: #0f172a;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .label {
        width: 100%;
        padding: 10px 0;
        text-align: center;
      }
      .name {
        margin: 0 0 10px;
        font-size: 15px;
        font-weight: 700;
      }
      .image svg { display: block; margin: 0 auto; }
      .code {
        margin: 8px 0 0;
        font-family: "Courier New", monospace;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 2px;
      }
    </style>
  </head>
  <body>
    <div class="label">
      <p class="name">${escapeHtml(name)}</p>
      <div class="image">${svg}</div>
      <p class="code">${escapeHtml(code)}</p>
    </div>
  </body>
</html>`);
  doc.close();

  const triggerPrint = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };

  if (doc.readyState === "complete") triggerPrint();
  else frame.onload = triggerPrint;
}