// Regression: disconnect → reconnect of the same mailbox restores its history.
// Run: node --test tests/mailReconnect.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsecret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://api/email/oauth/google/callback";
process.env.EMAIL_TOKEN_SECRET ||= "x".repeat(64);

const { memModel } = await import("./helpers/memMongo.js");
const oauth = await import("../services/emailOAuth.service.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: EmailMessage } = await import("../models/EmailMessage.js");
const { default: EmailSyncState } = await import("../models/EmailSyncState.js");

const WS_A = "64b0000000000000000000a1";
const WS_B = "64b0000000000000000000b2";
const USER = "64b0000000000000000000c3";
const json = (status, body) => ({ ok: status < 300, status, statusText: "x", json: async () => body, text: async () => JSON.stringify(body) });
global.fetch = async (url) => {
  const u = String(url);
  if (u.includes("oauth2.googleapis.com/token")) return json(200, { access_token: "AT", refresh_token: "RT", expires_in: 3600, scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly" });
  if (u.includes("userinfo")) return json(200, { email: "Owner@A.com" });
  return json(200, {}); // revoke etc.
};

test("reconnecting the same mailbox restores messages, drafts and sync state without duplicates", async () => {
  const conns = memModel(EmailConnection, { unique: [["workspace", "provider", "email"]] });
  const messages = memModel(EmailMessage, { unique: [["workspace", "account", "providerMessageId"], ["workspace", "clientId"]] });
  const states = memModel(EmailSyncState, { unique: [["workspace", "account"]] });

  // 1. Connect in both workspaces (same address) and seed history
  await oauth.completeConnection({ provider: "google", code: "c", workspaceId: WS_A, userId: USER });
  await oauth.completeConnection({ provider: "google", code: "c", workspaceId: WS_B, userId: USER });
  const oldA = String(conns.find((c) => String(c.workspace) === WS_A)._id);
  const accB = String(conns.find((c) => String(c.workspace) === WS_B)._id);
  const mail = { provider: "google", accountEmail: "owner@a.com" };
  await EmailMessage.create({ workspace: WS_A, account: oldA, ...mail, status: "received", direction: "inbound", providerMessageId: "g1", providerThreadId: "t1" });
  await EmailMessage.create({ workspace: WS_A, account: oldA, ...mail, status: "sent", providerMessageId: "g2", providerThreadId: "t1" });
  await EmailMessage.create({ workspace: WS_A, account: oldA, ...mail, status: "draft" });
  await EmailMessage.create({ workspace: WS_B, account: accB, ...mail, status: "received", providerMessageId: "g1" });
  await EmailSyncState.create({ workspace: WS_A, account: oldA, provider: "google", historyId: "H42", totalImported: 2, lastSuccessAt: new Date() });
  await EmailSyncState.create({ workspace: WS_B, account: accB, provider: "google", historyId: "B9" });

  // 2. Disconnect A → history must stay stored
  assert.ok(await oauth.disconnect(WS_A));
  assert.equal(messages.length, 4);

  // 3. Reconnect the same provider + email in A
  await oauth.completeConnection({ provider: "google", code: "c", workspaceId: WS_A, userId: USER });
  const newA = String(conns.find((c) => String(c.workspace) === WS_A)._id);
  assert.equal(conns.filter((c) => String(c.workspace) === WS_A).length, 1, "no duplicate mailbox");

  // 4. History + sync cursor follow the new connection, ids/threads unchanged, nothing duplicated
  const a = messages.filter((m) => String(m.workspace) === WS_A);
  assert.equal(a.length, 3);
  assert.ok(a.every((m) => String(m.account) === newA));
  assert.deepEqual(a.map((m) => m.status).sort(), ["draft", "received", "sent"]);
  assert.deepEqual(a.filter((m) => m.providerThreadId).map((m) => m.providerThreadId), ["t1", "t1"]);
  const sa = states.filter((s) => String(s.workspace) === WS_A);
  assert.equal(sa.length, 1);
  assert.equal(String(sa[0].account), newA);
  assert.equal(sa[0].historyId, "H42");
  assert.equal(sa[0].totalImported, 2);

  // 5. Workspace B untouched
  const b = messages.filter((m) => String(m.workspace) === WS_B);
  assert.equal(b.length, 1);
  assert.equal(String(b[0].account), accB);
  const sb = states.find((s) => String(s.workspace) === WS_B);
  assert.equal(String(sb.account), accB);
  assert.equal(sb.historyId, "B9");
});
