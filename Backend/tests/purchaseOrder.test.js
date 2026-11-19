// Purchase order update/delete rules (DB-free, mocked model).
// Run: node --test tests/purchaseOrder.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const { default: PO } = await import("../models/PurchaseOrder.model.js");
const ctl = await import("../controllers/purchase.controller.js");

const ID = "64b0000000000000000000a1";
const VENDOR = "64b0000000000000000000b1";
const PRODUCT = "64b0000000000000000000c1";
const realFind = PO.findById;
beforeEach(() => { PO.findById = realFind; });

const res = () => {
  const r = { statusCode: 200 };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const doc = (status) => {
  const d = { _id: ID, poNumber: "PO-1", status, vendor: "old", items: [], saved: 0, deleted: 0 };
  d.save = async () => (d.saved++, d);
  d.deleteOne = async () => (d.deleted++, {});
  return d;
};
const body = { vendor: VENDOR, items: [{ product: PRODUCT, qty: "2", cost: "5" }, { product: "", qty: 1 }], status: "RECEIVED", poNumber: "HACK" };

test("DRAFT PO: update writes only vendor + items; delete removes it", async () => {
  const d = doc("DRAFT");
  PO.findById = async () => d;
  let r = res();
  await ctl.updatePO({ params: { id: ID }, body }, r);
  assert.equal(r.statusCode, 200);
  assert.equal(d.vendor, VENDOR);
  assert.deepEqual(d.items, [{ product: PRODUCT, qty: 2, cost: 5 }], "blank lines dropped, numbers cast");
  assert.equal(d.status, "DRAFT", "status not client-settable");
  assert.equal(d.poNumber, "PO-1", "poNumber not client-settable");

  r = res();
  await ctl.deletePO({ params: { id: ID } }, r);
  assert.equal(r.statusCode, 200);
  assert.equal(d.deleted, 1);
});

test("RECEIVED PO is locked for update and delete (stock already posted)", async () => {
  const d = doc("RECEIVED");
  PO.findById = async () => d;
  let r = res();
  await ctl.updatePO({ params: { id: ID }, body }, r);
  assert.equal(r.statusCode, 400);
  r = res();
  await ctl.deletePO({ params: { id: ID } }, r);
  assert.equal(r.statusCode, 400);
  assert.equal(d.saved + d.deleted, 0);
});

test("Validation and not-found (incl. other workspace, hidden by scope)", async () => {
  PO.findById = async () => null;
  const cases = [
    [{ ...body, vendor: "" }, 400],
    [{ vendor: VENDOR, items: [] }, 400],
    [{ vendor: VENDOR, items: [{ product: PRODUCT, qty: 0, cost: 1 }] }, 400],
    [{ vendor: VENDOR, items: [{ product: PRODUCT, qty: 1, cost: -1 }] }, 400],
    [body, 404],
  ];
  for (const [b, code] of cases) {
    const r = res();
    await ctl.updatePO({ params: { id: ID }, body: b }, r);
    assert.equal(r.statusCode, code, JSON.stringify(b));
  }
  const r = res();
  await ctl.deletePO({ params: { id: "not-an-id" } }, r);
  assert.equal(r.statusCode, 404);
});
