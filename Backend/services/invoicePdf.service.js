import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ *
 * Palette
 * ------------------------------------------------------------------ */
const C = {
  primary: "#4f46e5",
  dark: "#0f172a",
  slate: "#334155",
  gray: "#64748b",
  light: "#e2e8f0",
  zebra: "#f8fafc",
  text: "#1e293b",
  white: "#ffffff",
  green: "#16a34a",
  orange: "#f59e0b",
  red: "#dc2626",
  blue: "#2563eb",
  amber: "#d97706",
  rose: "#e11d48",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, "..", "assets", "fonts");

/* ------------------------------------------------------------------ *
 * Font resolution — embed a Unicode TTF so the Rupee sign (U+20B9)
 * and other glyphs render correctly. Falls back to core Helvetica +
 * an ASCII "Rs." currency prefix so output NEVER shows broken glyphs.
 * ------------------------------------------------------------------ */
function setupFonts(doc) {
  const candidates = [
    // 1) Bundled (portable — drop TTFs here for guaranteed rendering)
    { r: path.join(FONT_DIR, "NotoSans-Regular.ttf"), b: path.join(FONT_DIR, "NotoSans-Bold.ttf") },
    { r: path.join(FONT_DIR, "DejaVuSans.ttf"), b: path.join(FONT_DIR, "DejaVuSans-Bold.ttf") },
    // 2) Linux (production)
    { r: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", b: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" },
    { r: "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", b: "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf" },
    // 3) Windows
    { r: "C:/Windows/Fonts/arial.ttf", b: "C:/Windows/Fonts/arialbd.ttf" },
    { r: "C:/Windows/Fonts/Nirmala.ttf", b: "C:/Windows/Fonts/NirmalaB.ttf" },
    // 4) macOS
    { r: "/Library/Fonts/Arial Unicode.ttf", b: "/Library/Fonts/Arial Unicode.ttf" },
  ];

  for (const c of candidates) {
    try {
      if (c.r && fs.existsSync(c.r)) {
        doc.registerFont("Body", c.r);
        const hasBold = c.b && fs.existsSync(c.b);
        if (hasBold) doc.registerFont("BodyBold", c.b);
        return { reg: "Body", bold: hasBold ? "BodyBold" : "Body", unicode: true };
      }
    } catch {
      /* try next candidate */
    }
  }
  return { reg: "Helvetica", bold: "Helvetica-Bold", unicode: false };
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */
const num = (x) => Number(x) || 0;

const safe = (v, fb = "") => {
  if (v === null || v === undefined) return fb;
  const s = String(v).trim();
  return s.length ? s : fb;
};

const joinAddress = (parts) =>
  parts.map((p) => safe(p)).filter(Boolean).join(", ");

const formatDate = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  try {
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return date.toISOString().slice(0, 10);
  }
};

const formatDateTime = (d) => {
  const date = d ? new Date(d) : new Date();
  try {
    return date.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return date.toISOString();
  }
};

const statusColor = (status) => {
  switch (safe(status).toLowerCase()) {
    case "paid": return C.green;
    case "pending": return C.orange;
    case "overdue": return C.red;
    case "partially paid": return C.amber;
    case "sent": return C.blue;
    case "viewed": return C.primary;
    case "cancelled": return C.rose;
    default: return C.gray; // Draft & unknown
  }
};

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
export async function buildInvoicePdf(invoice = {}, res) {
  const inv = invoice || {};
  const company = inv.companyDetails || {};
  const billing = inv.billingDetails || {};
  const shipping = inv.shippingDetails || {};
  const customer = inv.customer || {};
  const items = Array.isArray(inv.items) ? inv.items : [];

  // QR (async) — build before streaming
  let qrBuffer = null;
  try {
    const qrText = [
      `Invoice: ${safe(inv.invoiceNumber, "INV")}`,
      `GSTIN: ${safe(company.gstNumber, "N/A")}`,
      `Total: ${num(inv.grandTotal).toFixed(2)}`,
      `Status: ${safe(inv.status, "N/A")}`,
    ].join(" | ");
    const dataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 240 });
    const b64 = dataUrl.split(",")[1];
    if (b64) qrBuffer = Buffer.from(b64, "base64");
  } catch {
    qrBuffer = null;
  }

  try {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Invoice-${safe(inv.invoiceNumber, "INV")}.pdf"`
    );
  } catch {
    /* headers may be committed already */
  }

  const margin = 42;
  const doc = new PDFDocument({ size: "A4", margin, bufferPages: true });
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const left = margin;
  const right = pageW - margin;
  const contentW = pageW - margin * 2;
  const bottomLimit = pageH - margin - 70; // keep clear of footer band

  const F = setupFonts(doc);
  const CUR = F.unicode ? "₹" : "Rs.";
  const money = (x) => {
    const v = num(x);
    let s;
    try {
      s = v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      s = v.toFixed(2);
    }
    return `${CUR} ${s}`;
  };

  doc.pipe(res);

  /* ============================ HEADER BAND ============================ */
  const bandH = 104;
  doc.save().rect(0, 0, pageW, bandH).fill(C.dark).restore();
  doc.save().rect(0, bandH, pageW, 3).fill(C.primary).restore();

  // Logo (defensive: only data-URI or existing file path)
  let logoW = 0;
  const logo = safe(company.logo);
  if (logo) {
    try {
      if (logo.startsWith("data:image")) {
        const b64 = logo.split(",")[1];
        if (b64) { doc.image(Buffer.from(b64, "base64"), left, 24, { fit: [56, 56] }); logoW = 66; }
      } else if (fs.existsSync(logo)) {
        doc.image(logo, left, 24, { fit: [56, 56] }); logoW = 66;
      }
    } catch { logoW = 0; }
  }

  const headX = left + logoW;
  const headW = contentW - logoW;
  doc.fillColor(C.white).font(F.bold).fontSize(19)
    .text(safe(company.companyName, "Company Name"), headX, 24, { width: headW });

  doc.font(F.reg).fontSize(8).fillColor("#cbd5e1");
  const compAddr = joinAddress([company.address, company.city, company.state, company.pincode, company.country]);
  doc.text(compAddr || " ", headX, 50, { width: headW });

  const contact = [];
  if (safe(company.phone)) contact.push(`Phone: ${safe(company.phone)}`);
  if (safe(company.email)) contact.push(`Email: ${safe(company.email)}`);
  if (safe(company.website)) contact.push(`Web: ${safe(company.website)}`);
  doc.text(contact.join("   |   ") || " ", headX, 64, { width: headW });

  const tax = [];
  if (safe(company.gstNumber)) tax.push(`GSTIN: ${safe(company.gstNumber)}`);
  if (safe(company.panNumber)) tax.push(`PAN: ${safe(company.panNumber)}`);
  doc.fillColor("#e2e8f0").font(F.bold).fontSize(8)
    .text(tax.join("   |   ") || " ", headX, 78, { width: headW });

  /* ==================== TITLE + STATUS + META BOX ==================== */
  let y = bandH + 18;

  doc.fillColor(C.primary).font(F.bold).fontSize(20).text("TAX INVOICE", left, y);

  // Status badge
  const stText = safe(inv.status || inv.paymentStatus, "Draft").toUpperCase();
  doc.font(F.bold).fontSize(9);
  const badgeW = doc.widthOfString(stText) + 18;
  const badgeY = y + 26;
  doc.save().roundedRect(left, badgeY, badgeW, 18, 9).fill(statusColor(inv.status || inv.paymentStatus)).restore();
  doc.fillColor(C.white).font(F.bold).fontSize(9).text(stText, left + 9, badgeY + 5);

  // Meta box (right)
  const metaW = 236;
  const metaX = right - metaW;
  const metaRows = [
    ["Invoice #", safe(inv.invoiceNumber, "-")],
    ["Invoice Date", formatDate(inv.issueDate)],
    ["Due Date", formatDate(inv.dueDate)],
    ["Order Date", formatDate(inv.orderDate)],
    ["Purchase Date", formatDate(inv.purchaseDate)],
    ["Payment Date", formatDate(inv.paymentDate)],
  ];
  const metaRowH = 15;
  const metaH = metaRows.length * metaRowH + 10;
  doc.save().roundedRect(metaX, y - 4, metaW, metaH, 5).lineWidth(0.8).stroke(C.light).restore();
  let my = y + 2;
  metaRows.forEach(([k, v]) => {
    doc.font(F.bold).fontSize(8).fillColor(C.gray).text(k, metaX + 10, my, { width: 90 });
    doc.font(F.reg).fontSize(8).fillColor(C.text).text(v, metaX + 104, my, { width: metaW - 114, align: "right" });
    my += metaRowH;
  });

  y = Math.max(badgeY + 18, y - 4 + metaH) + 16;

  /* ======================= BILL TO / SHIP TO ======================= */
  const gap = 18;
  const colW = (contentW - gap) / 2;
  const billX = left;
  const shipX = left + colW + gap;

  const partyHeader = (title, x) => {
    doc.save().rect(x, y, colW, 17).fill(C.primary).restore();
    doc.fillColor(C.white).font(F.bold).fontSize(9).text(title, x + 7, y + 5);
  };
  partyHeader("BILL TO", billX);
  partyHeader("SHIP TO", shipX);
  const partyTop = y + 22;

  const renderParty = (p, x, fallbackName) => {
    let ty = partyTop;
    const line = (txt, bold = false, size = 9, color = C.text) => {
      if (!txt) return;
      doc.font(bold ? F.bold : F.reg).fontSize(size).fillColor(color).text(txt, x, ty, { width: colW });
      ty = doc.y + 1;
    };
    line(safe(p.companyName, fallbackName), true, 10, C.dark);
    if (safe(p.contactPerson)) line(safe(p.contactPerson), false, 9, C.slate);
    const a = joinAddress([p.addressLine1, p.addressLine2]);
    if (a) line(a, false, 8.5, C.slate);
    const cs = joinAddress([p.city, p.state, p.pincode, p.country]);
    if (cs) line(cs, false, 8.5, C.slate);
    if (safe(p.gstNumber)) line(`GSTIN: ${safe(p.gstNumber)}`, false, 8, C.gray);
    if (safe(p.panNumber)) line(`PAN: ${safe(p.panNumber)}`, false, 8, C.gray);
    if (safe(p.email)) line(`Email: ${safe(p.email)}`, false, 8, C.gray);
    if (safe(p.phone)) line(`Phone: ${safe(p.phone)}`, false, 8, C.gray);
    return ty;
  };

  const fallbackName = safe(customer.companyName) || safe(customer.contactPerson) || "-";
  const endBill = renderParty(billing, billX, fallbackName);
  const endShip = renderParty(shipping, shipX, fallbackName);
  y = Math.max(endBill, endShip) + 6;

  if (safe(inv.placeOfSupply)) {
    doc.font(F.bold).fontSize(8).fillColor(C.gray).text("Place of Supply: ", left, y, { continued: true })
      .font(F.reg).fillColor(C.text).text(safe(inv.placeOfSupply));
    y = doc.y + 8;
  } else {
    y += 4;
  }

  /* ============================ ITEMS TABLE ============================ */
  const cols = [
    { label: "#", w: 22, align: "left" },
    { label: "Description", w: 132, align: "left" },
    { label: "HSN/SAC", w: 54, align: "left" },
    { label: "Qty", w: 34, align: "right" },
    { label: "Unit Price", w: 66, align: "right" },
    { label: "Discount", w: 58, align: "right" },
    { label: "Tax %", w: 36, align: "right" },
    { label: "Amount", w: 0, align: "right" },
  ];
  cols[cols.length - 1].w = contentW - cols.reduce((s, c) => s + c.w, 0);
  const colX = [];
  let acc = left;
  cols.forEach((c) => { colX.push(acc); acc += c.w; });

  const drawHead = (yy) => {
    doc.save().rect(left, yy, contentW, 20).fill(C.dark).restore();
    doc.font(F.bold).fontSize(8).fillColor(C.white);
    cols.forEach((c, i) => doc.text(c.label, colX[i] + 4, yy + 6, { width: c.w - 8, align: c.align }));
    return yy + 20;
  };

  y = drawHead(y);
  const pad = 5;
  let zebra = false;

  const cell = (txt, i, yy, align) =>
    doc.font(F.reg).fontSize(8).fillColor(C.text).text(txt, colX[i] + 4, yy, { width: cols[i].w - 8, align });

  if (items.length === 0) {
    doc.font(F.reg).fontSize(9).fillColor(C.gray).text("No items.", left + 4, y + 6);
    y += 24;
  }

  items.forEach((item, index) => {
    const it = item || {};
    const desc = safe(it.description, "-");
    doc.font(F.reg).fontSize(8);
    const descH = doc.heightOfString(desc, { width: cols[1].w - 8 });
    const rowH = Math.max(descH + pad * 2, 20);

    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = drawHead(margin);
      zebra = false;
    }

    if (zebra) doc.save().rect(left, y, contentW, rowH).fill(C.zebra).restore();
    zebra = !zebra;

    const ry = y + pad;
    const hsn = safe(it.hsnCode) || safe(it.sacCode) || "-";
    const disc = num(it.discount || it.discountAmount);
    cell(String(index + 1), 0, ry, "left");
    cell(desc, 1, ry, "left");
    cell(hsn, 2, ry, "left");
    cell(String(num(it.quantity)), 3, ry, "right");
    cell(money(it.unitPrice), 4, ry, "right");
    cell(disc > 0 ? money(disc) : "-", 5, ry, "right");
    cell(`${num(it.taxPercent)}%`, 6, ry, "right");
    cell(money(it.total), 7, ry, "right");

    y += rowH;
    doc.save().moveTo(left, y).lineTo(right, y).lineWidth(0.3).stroke(C.light).restore();
  });

  // Table outer border
  doc.save().roundedRect(left, y - (items.length ? 0 : 0), contentW, 0.001, 0).restore();
  y += 14;

  /* ===================== GST SUMMARY + PAYMENT ===================== */
  const sumW = 248;
  const sumX = right - sumW;

  const rows = [["Subtotal", money(inv.subtotal)]];
  if (num(inv.discountAmount) > 0) {
    const dl = /perc/i.test(safe(inv.discountType))
      ? `Discount (${num(inv.discountValue)}%)`
      : "Discount";
    rows.push([dl, `- ${money(inv.discountAmount)}`]);
  }
  rows.push(["Taxable Value", money(inv.taxableAmount)]);
  if (safe(inv.taxType) === "INTER") {
    rows.push([`IGST (${num(inv.igstPercent)}%)`, money(inv.igstAmount)]);
  } else {
    rows.push([`CGST (${num(inv.cgstPercent)}%)`, money(inv.cgstAmount)]);
    rows.push([`SGST (${num(inv.sgstPercent)}%)`, money(inv.sgstAmount)]);
  }
  if (num(inv.roundOff) !== 0) rows.push(["Round Off", money(inv.roundOff)]);

  const rowH = 16, grandH = 24;
  const boxH = rows.length * rowH + grandH + rowH * 2 + 14;

  if (y + boxH > bottomLimit) { doc.addPage(); y = margin; }

  // Payment details (left column, aligned with summary)
  let py = y;
  const payX = left;
  doc.font(F.bold).fontSize(10).fillColor(C.dark).text("Payment Details", payX, py);
  py = doc.y + 4;
  const payLine = (label, value) => {
    doc.font(F.bold).fontSize(8).fillColor(C.gray).text(`${label}: `, payX, py, { continued: true, width: sumX - left - 16 })
      .font(F.reg).fillColor(C.text).text(safe(value, "-"));
    py = doc.y + 3;
  };
  payLine("Payment Method", inv.paymentMode);
  payLine("Transaction ID", inv.transactionId);
  payLine("Reference No", inv.paymentReference);
  payLine("Payment Date", formatDate(inv.paymentDate));
  payLine("Payment Status", safe(inv.paymentStatus, inv.status));

  // Summary box (right)
  let sy = y;
  doc.save().roundedRect(sumX, sy, sumW, boxH, 5).lineWidth(0.8).stroke(C.light).restore();
  sy += 8;
  const sumRow = (label, value, color = C.text, bold = false, size = 9) => {
    doc.font(bold ? F.bold : F.reg).fontSize(size).fillColor(bold ? C.dark : C.gray)
      .text(label, sumX + 12, sy, { width: 120 });
    doc.font(bold ? F.bold : F.reg).fontSize(size).fillColor(color)
      .text(value, sumX + 128, sy, { width: sumW - 140, align: "right" });
  };
  rows.forEach(([l, v]) => { sumRow(l, v); sy += rowH; });

  // Grand total highlight band
  sy += 2;
  doc.save().rect(sumX, sy, sumW, grandH).fill(C.primary).restore();
  doc.font(F.bold).fontSize(11).fillColor(C.white).text("Grand Total", sumX + 12, sy + 7, { width: 120 });
  doc.font(F.bold).fontSize(11).fillColor(C.white).text(money(inv.grandTotal), sumX + 128, sy + 7, { width: sumW - 140, align: "right" });
  sy += grandH + 6;

  sumRow("Amount Paid", money(inv.amountPaid), C.green);
  sy += rowH;
  sumRow("Balance Due", money(inv.balanceDue), C.red, true, 10);
  sy += rowH;

  y = Math.max(py, y + boxH) + 22;

  /* ================= QR + SIGNATURE + SEAL ROW ================= */
  const zoneH = 120;
  if (y + zoneH > pageH - margin - 60) { doc.addPage(); y = margin + 6; }

  // Seal placeholder (left)
  const sealSize = 92;
  doc.save().roundedRect(left, y, sealSize, sealSize, 6).dash(3, { space: 3 }).lineWidth(1).stroke(C.light).undash().restore();
  doc.font(F.reg).fontSize(8).fillColor(C.gray).text("Company Seal", left, y + sealSize / 2 - 5, { width: sealSize, align: "center" });

  // Signature (center)
  const sigW = 190;
  const sigX = left + sealSize + (right - 120 - (left + sealSize) - sigW) / 2;
  const sigLineY = y + 66;
  doc.save().moveTo(sigX, sigLineY).lineTo(sigX + sigW, sigLineY).lineWidth(0.8).stroke(C.dark).restore();
  doc.font(F.bold).fontSize(9).fillColor(C.dark).text("Authorised Signatory", sigX, sigLineY + 5, { width: sigW, align: "center" });
  doc.font(F.reg).fontSize(8).fillColor(C.gray).text(safe(company.companyName, ""), sigX, sigLineY + 19, { width: sigW, align: "center" });

  // QR (bottom-right, large)
  const qrSize = 96;
  const qrX = right - qrSize;
  if (qrBuffer) {
    try {
      doc.image(qrBuffer, qrX, y, { width: qrSize });
      doc.font(F.reg).fontSize(7).fillColor(C.gray).text("Scan to verify invoice", qrX - 10, y + qrSize + 3, { width: qrSize + 20, align: "center" });
    } catch { /* skip */ }
  }
  y += zoneH;

  /* ======================= NOTES / TERMS ======================= */
  const notes = safe(inv.notes);
  const terms = safe(inv.termsAndConditions);
  if (notes || terms) {
    if (y + 60 > pageH - margin - 60) { doc.addPage(); y = margin; }
    if (notes) {
      doc.font(F.bold).fontSize(8).fillColor(C.dark).text("Notes", left, y);
      y = doc.y + 1;
      doc.font(F.reg).fontSize(8).fillColor(C.gray).text(notes, left, y, { width: contentW });
      y = doc.y + 6;
    }
    if (terms) {
      doc.font(F.bold).fontSize(8).fillColor(C.dark).text("Terms & Conditions", left, y);
      y = doc.y + 1;
      doc.font(F.reg).fontSize(8).fillColor(C.gray).text(terms, left, y, { width: contentW });
    }
  }

  /* ============================ FOOTER ============================ */
  // Draw on every buffered page.
  const range = doc.bufferedPageRange();
  const footParts = [];
  if (safe(company.email)) footParts.push(`Support: ${safe(company.email)}`);
  if (safe(company.phone)) footParts.push(`Phone: ${safe(company.phone)}`);
  if (safe(company.website)) footParts.push(`Web: ${safe(company.website)}`);
  const footLine1 = footParts.join("   |   ");
  const footLine2 = `Invoice generated on ${formatDateTime(new Date())}`;
  const footLine3 = "This is a computer-generated invoice and does not require a physical signature.";

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const fy = pageH - margin - 34;
    doc.save().moveTo(left, fy).lineTo(right, fy).lineWidth(0.5).stroke(C.light).restore();
    if (footLine1) doc.font(F.reg).fontSize(7.5).fillColor(C.slate).text(footLine1, left, fy + 5, { width: contentW, align: "center" });
    doc.font(F.reg).fontSize(7).fillColor(C.gray).text(footLine2, left, fy + 16, { width: contentW, align: "center" });
    doc.font(F.reg).fontSize(7).fillColor(C.gray).text(footLine3, left, fy + 26, { width: contentW, align: "center" });
    // Page number
    doc.font(F.reg).fontSize(7).fillColor(C.gray).text(`Page ${i + 1} of ${range.count}`, right - 80, fy + 26, { width: 80, align: "right" });
  }

  doc.end();
}

export default buildInvoicePdf;
