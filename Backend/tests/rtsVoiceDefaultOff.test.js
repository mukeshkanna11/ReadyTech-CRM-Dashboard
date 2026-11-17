// RTS voice (Frontend/src/hooks/useRtsVoice.js): OFF by default — the
// microphone never opens until the user enables "Hey RTS", and nothing
// (mount, permission state, tab visibility, clicks, keys, retries) restarts it
// unless the user enabled it. Enable/disable and wake commands still work.
// Run: node --test tests/rtsVoiceDefaultOff.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* ---------------- browser fakes (installed before the hook loads) ---------------- */
class FakeRec {
  static all = [];
  constructor() { this.started = 0; this.aborted = 0; FakeRec.all.push(this); }
  start() { this.started += 1; }
  abort() { this.aborted += 1; }
  stop() { this.aborted += 1; }
}
const listeners = {};
let mic, permission;
globalThis.window = { SpeechRecognition: FakeRec, speechSynthesis: { cancel() {}, speak() {}, getVoices: () => [], speaking: false, pending: false } };
globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
globalThis.document = {
  hidden: false,
  addEventListener: (t, fn) => (listeners[t] ||= new Set()).add(fn),
  removeEventListener: (t, fn) => listeners[t]?.delete(fn),
};
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    mediaDevices: { getUserMedia: async () => {
      mic.calls += 1;
      if (mic.gate) await mic.gate; // permission prompt still open
      if (mic.deny) throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
      return { getTracks: () => [{ stop() {} }] };
    } },
    permissions: { query: async () => permission },
  },
});
// Debug trace on, so the "turned off" → "recognition started" sequence can be checked
localStorage._["rts.debug"] = "1";
const logs = [];
const info = console.info;
console.info = (...a) => (a[0] === "[RTS voice]" ? logs.push(a.slice(1).join(" ")) : info(...a));
const startedAfterOff = () => {
  const off = logs.lastIndexOf("turned off by user (this session)");
  return off >= 0 && logs.slice(off).some((l) => l.startsWith("recognition started"));
};
const fire = (type) => [...(listeners[type] || [])].forEach((fn) => fn({ type }));

/* ---------------- load the hook with a one-render React stub ---------------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rts-voice-"));
const front = (p) => fs.readFileSync(new URL(`../../Frontend/src/${p}`, import.meta.url), "utf8");
fs.writeFileSync(path.join(dir, "react.mjs"), `
export const effects = [];
export const useState = (v) => [typeof v === "function" ? v() : v, () => {}];
export const useRef = (current) => ({ current });
export const useEffect = (fn) => { effects.push(fn); };
export const useCallback = (fn) => fn;`);
fs.writeFileSync(path.join(dir, "rtsCommands.mjs"), front("components/rtsCommands.js"));
fs.writeFileSync(path.join(dir, "useRtsVoice.mjs"), front("hooks/useRtsVoice.js")
  .replace('from "react"', 'from "./react.mjs"')
  .replace('from "../components/rtsCommands"', 'from "./rtsCommands.mjs"'));
const React = await import(path.join(dir, "react.mjs"));
const { default: useRtsVoice } = await import(path.join(dir, "useRtsVoice.mjs"));

const flush = () => new Promise((r) => setTimeout(r, 0));
let cleanups = [];
const mount = async (opts = {}) => {
  React.effects.length = 0;
  const voice = useRtsVoice({ onCommand: opts.onCommand || (() => {}), onWake: () => {} });
  cleanups = React.effects.map((fn) => fn()).filter((c) => typeof c === "function");
  await flush();
  return voice;
};
const live = () => FakeRec.all.filter((r) => r.started && !r.aborted);

beforeEach(() => {
  cleanups.forEach((c) => c()); // unmount the previous hook (removes its listeners)
  FakeRec.all = [];
  mic = { calls: 0, deny: false, gate: null };
  logs.length = 0;
  permission = { state: "granted", onchange: null };
  document.hidden = false;
  for (const k of Object.keys(listeners)) listeners[k].clear();
});

test("after login: OFF — no microphone request and no recognition, even with permission already granted", async () => {
  for (const state of ["granted", "prompt", "denied"]) {
    FakeRec.all = []; mic.calls = 0; permission = { state, onchange: null };
    await mount();
    assert.equal(FakeRec.all.length, 0, `no recognition (${state})`);
    assert.equal(mic.calls, 0, `no microphone prompt (${state})`);
  }
});

test("while OFF: tab visibility, permission changes, clicks and keys never start listening", async () => {
  await mount();
  document.hidden = true; fire("visibilitychange");
  document.hidden = false; fire("visibilitychange");
  permission.onchange?.();
  fire("pointerdown"); fire("keydown");
  await flush();
  assert.equal(FakeRec.all.length, 0);
  assert.equal(mic.calls, 0);
});

test("a failed mic-button attempt never turns wake listening on at the next click or key", async () => {
  const voice = await mount();
  mic.deny = true;
  await voice.listenNow();
  mic.deny = false;
  fire("pointerdown"); fire("keydown");
  await flush();
  assert.equal(mic.calls, 1, "only the user's own mic-button request");
  assert.equal(live().length, 0);
});

test("Enable starts continuous wake listening; 'Hey RTS, go to Leads' still reaches the command handler", async () => {
  const commands = [];
  const voice = await mount({ onCommand: (c) => commands.push(c) });
  await voice.enable();
  assert.equal(mic.calls, 1);
  const [rec] = live();
  assert.ok(rec, "recognition running");
  assert.equal(rec.continuous, true);
  const result = Object.assign([{ transcript: "hey RTS go to leads" }], { isFinal: true });
  rec.onresult({ resultIndex: 0, results: [result] });
  assert.deepEqual(commands, ["go to leads"]);
});

test("Disable stops at once and nothing restarts it (session end, visibility, permission, clicks, keys)", async () => {
  const voice = await mount();
  await voice.enable();
  const [rec] = live();
  voice.disable();
  assert.equal(rec.aborted, 1, "recognition aborted immediately");
  assert.equal(rec.onresult, null);
  rec.onend?.();
  document.hidden = true; fire("visibilitychange");
  document.hidden = false; fire("visibilitychange");
  permission.onchange?.();
  fire("pointerdown"); fire("keydown");
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(live().length, 0);
  assert.equal(FakeRec.all.length, 1, "no new recognition session");
});

test("only voice the user enabled resumes when the tab becomes visible again", async () => {
  const voice = await mount();
  await voice.enable();
  document.hidden = true; fire("visibilitychange");
  assert.equal(live().length, 0, "paused while hidden");
  document.hidden = false; fire("visibilitychange");
  assert.equal(live().length, 1, "resumed for the user who enabled it");
});

test("every reload / login starts OFF: nothing is persisted", async () => {
  const voice = await mount();
  await voice.enable();
  assert.equal(Object.keys(localStorage._).some((k) => /voice/.test(k)), false);
  FakeRec.all = []; mic.calls = 0;
  await mount(); // a fresh page load
  assert.equal(FakeRec.all.length, 0);
  assert.equal(mic.calls, 0);
});

/* ---------------- Disable / restart races ---------------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("Chrome's late 'start' / 'end' events of a disabled session never revive it", async () => {
  const voice = await mount();
  await voice.enable();
  const [rec] = live();
  const { onstart, onend, onresult } = rec; // events Chrome may still deliver
  voice.disable();
  onstart.call(rec); // async start arriving after Disable (the logged sequence)
  onend.call(rec);
  onresult.call(rec, { resultIndex: 0, results: [Object.assign([{ transcript: "hey RTS go to leads" }], { isFinal: true })] });
  await wait(400);
  assert.equal(startedAfterOff(), false, "no 'recognition started' after 'turned off by user'");
  assert.ok(rec.aborted >= 2, "the stale session is aborted again");
  assert.equal(FakeRec.all.length, 1, "no new session");
});

test("a pending restart (normal session end) is cancelled by Disable", async () => {
  const voice = await mount();
  await voice.enable();
  const [rec] = live();
  rec.onstart();
  await wait(5);
  rec.onend(); // Chrome ends sessions after silence → restart scheduled
  voice.disable();
  await wait(400);
  assert.equal(FakeRec.all.length, 1);
  assert.equal(startedAfterOff(), false);
});

test("Disable while the microphone prompt is open: neither Enable nor the mic button starts recognition", async () => {
  for (const action of ["enable", "listenNow"]) {
    FakeRec.all = [];
    let allow;
    mic.gate = new Promise((r) => { allow = r; });
    const voice = await mount();
    const pending = voice[action]();
    voice.disable();
    allow();
    await pending;
    await wait(20);
    assert.equal(FakeRec.all.length, 0, action);
    mic.gate = null;
  }
});

/* ---------------- Recognition configuration ---------------- */
test("Indian English by default (invalid stored language ignored); 3 alternatives; wake word found in any alternative", async () => {
  localStorage._["rts.lang"] = "hi-IN";
  const commands = [];
  const voice = await mount({ onCommand: (c) => commands.push(c) });
  delete localStorage._["rts.lang"];
  await voice.enable();
  const [rec] = live();
  assert.equal(rec.lang, "en-IN");
  assert.equal(rec.maxAlternatives, 3);
  // Top guess misheard ("Dehati …"); the wake word + command is the 2nd alternative
  rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "dehati go to lease" }, { transcript: "hey RTS go to leads" }], { isFinal: true })] });
  assert.deepEqual(commands, ["go to leads"]);
});

test("Tamil stays available when selected (one language per session)", async () => {
  localStorage._["rts.lang"] = "ta-IN";
  const voice = await mount();
  delete localStorage._["rts.lang"];
  await voice.enable();
  assert.equal(live()[0].lang, "ta-IN");
});
