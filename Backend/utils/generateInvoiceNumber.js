import Invoice from "../models/Invoice.js";

const generateInvoiceNumber = async () => {
  const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });

  if (!lastInvoice) return "INV-1001";

  const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[1]);
  return `INV-${lastNumber + 1}`;
};

export default generateInvoiceNumber;
