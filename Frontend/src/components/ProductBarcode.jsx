import React from "react";
import Barcode from "react-barcode";
import { normalizeBarcode } from "../utils/productBarcode";

/**
 * Shared barcode image for products.
 *
 * Returns null when the product has no barcode yet (for example while
 * creating a product), so callers can render it inline without extra guards.
 * Any module (Inventory, Sales, Purchase, Warehouse, Billing) can reuse this
 * component as-is.
 */
export default function ProductBarcodeImage({
  value,
  height = 60,
  width = 1.6,
  displayValue = false,
  className = "",
}) {
  const code = normalizeBarcode(value);
  if (!code) return null;

  return (
    <div className={className}>
      <Barcode
        value={code}
        format="CODE128"
        renderer="svg"
        height={height}
        width={width}
        displayValue={displayValue}
        margin={0}
        background="#ffffff"
        lineColor="#0f172a"
      />
    </div>
  );
}