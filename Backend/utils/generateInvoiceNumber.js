import Invoice from "../models/Invoice.js";

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();

  const lastInvoice = await Invoice.findOne({
    invoiceNumber: {
      $regex: `INV-${year}`,
    },
  }).sort({ createdAt: -1 });

  let sequence = 1;

  if (lastInvoice) {
    const parts = lastInvoice.invoiceNumber.split("-");
    sequence = parseInt(parts[2]) + 1;
  }

  return `INV-${year}-${String(sequence).padStart(5, "0")}`;
};

export default generateInvoiceNumber;