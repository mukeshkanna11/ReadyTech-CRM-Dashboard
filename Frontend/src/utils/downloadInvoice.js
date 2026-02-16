import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const downloadInvoice = (invoice) => {
  const doc = new jsPDF();

  /* ===== COMPANY HEADER ===== */
  doc.setFontSize(16);
  doc.text("READY TECH SOLUTIONS", 14, 15);

  doc.setFontSize(10);
  doc.text("Chennai, Tamil Nadu", 14, 22);
  doc.text("Email: support@readytechsolution.in", 14, 27);
  doc.text("Phone: +91 9876543210", 14, 32);

  doc.setFontSize(18);
  doc.text("INVOICE", 160, 15);

  /* ===== CLIENT ===== */
  doc.setFontSize(12);
  doc.text(`Bill To: ${invoice.clientName}`, 14, 45);
  doc.text(invoice.clientAddress, 14, 52);
  doc.text(invoice.clientEmail, 14, 59);

  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 140, 45);
  doc.text(
    `Date: ${new Date(invoice.createdAt).toLocaleDateString()}`,
    140,
    52
  );

  /* ===== TABLE ===== */
  autoTable(doc, {
    startY: 70,
    head: [["Description", "Qty", "Price", "Total"]],
    body: invoice.items.map((item) => [
      item.description,
      item.quantity,
      item.price,
      item.total,
    ]),
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  doc.text(`Sub Total: ₹${invoice.subTotal}`, 140, finalY);
  doc.text(`CGST: ₹${invoice.cgst}`, 140, finalY + 7);
  doc.text(`SGST: ₹${invoice.sgst}`, 140, finalY + 14);
  doc.text(`Grand Total: ₹${invoice.totalAmount}`, 140, finalY + 21);

  doc.save(`${invoice.invoiceNumber}.pdf`);
};
