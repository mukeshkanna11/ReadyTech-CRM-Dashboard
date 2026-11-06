import { useCallback, useEffect, useRef, useState } from "react";

import { matchWake } from "../components/rtsCommands";

/* ======================================================
   RTS VOICE (browser-native, no paid voice APIs)

   ONE SpeechRecognition session, two modes:
     wake    → listen for "Hey RTS" only (everything else ignored)
     command → the next utterance is the command
   "Hey RTS, go to invoice" in one breath → command fires at once.
   "Hey RTS" … "go to invoice" → wake → command mode → command.
   The mic button jumps straight to command mode on the SAME session
   (no second recogniser — Chrome allows only one at a time).
   After every command (or an 8s timeout) it returns to wake mode.

   phase: off | wake | detected | command | error

   Honest limits: works only while this tab is visible, only after the
   user grants microphone permission, and only in browsers with
   SpeechRecognition (Chrome / Edge; Safari partial; Firefox none →
   typing still works).
====================================================== */

const Recognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

export const VOICE_LANGS = [
  { code: "en-IN", label: "EN", name: "English / Tanglish" },
  { code: "ta-IN", label: "த", name: "தமிழ் (Tamil)" },
];

const COMMAND_MS = 8000; // how long we wait for the command after "Hey RTS"
const DUP_MS = 2500; // same command twice within this window = duplicate
const ECHO_MS = 4000; // ignore our own TTS heard back this long after speaking
const FAST_END_MS = 1500; // a session ending faster than this counts as a failure
const MAX_FAST_FAILS = 5;
const TAMIL = /[஀-௿]/;
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported"]);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};
const RETRY_MS = 15000; // transient failure (network, mic busy) → try again after this
const PERMISSION_ERRORS = new Set(["not-allowed", "service-not-allowed"]);

/* Debug trace: on in dev, or in any build with localStorage rts.debug = "1" */
const DEBUG = Boolean(import.meta.env?.DEV) || store.get("rts.debug") === "1";
export const rtsLog = (...args) => { if (DEBUG) console.info("[RTS voice]", ...args); };

// Strip markdown symbols but keep hyphens inside words (e.g. purchase-orders)
const plain = (text) =>
  text.replace(/^\s*[-•]\s+/gm, "").replace(/[*#`_>|]+/g, " ").replace(/\s+/g, " ").trim();
const norm = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const errorText = (code) =>
  code === "not-allowed" || code === "service-not-allowed"
    ? "Microphone access is blocked. Click anywhere on the page to be asked again, allow it in the browser's site settings, or type your question."
    : code === "audio-capture"
    ? "No microphone was found. Please connect one or type your question."
    : code === "network"
    ? "Browser speech service is unreachable (it needs internet). Please type your question."
    : code === "language-not-supported"
    ? "This browser cannot recognise the selected language. Switch to EN or type your question."
    : "Voice input keeps stopping, so it was paused — it will retry shortly. You can type meanwhile.";

export default function useRtsVoice({ onCommand, onWake }) {
  const [enabled, setEnabled] = useState(false); // "Hey RTS" wake listening on
  const [phase, setPhase] = useState("off");
  const [heard, setHeard] = useState("");
  const [muted, setMuted] = useState(() => store.get("rts.muted") === "1");
  const [speaking, setSpeaking] = useState(false);
  const [lang, setLangState] = useState(() => store.get("rts.lang") || "en-IN");
  const [error, setError] = useState("");

  const recRef = useRef(null);
  const enabledRef = useRef(false);
  const modeRef = useRef("wake");
  const micOkRef = useRef(false);
  const speakingRef = useRef(false);
  const mutedRef = useRef(muted);
  const langRef = useRef(lang);
  const cmdTimer = useRef(null);
  const restartTimer = useRef(null);
  const fastFails = useRef(0);
  const lastCmd = useRef({ text: "", at: 0 });
  const lastSpoken = useRef({ text: "", at: 0 });
  const userOffRef = useRef(false); // user switched "Hey RTS" off for this session (never persisted)
  const permRef = useRef(""); // microphone Permissions API state, when known
  const retryTimer = useRef(null);
  const gestureRetry = useRef(null); // pending "retry on next click/key" handler
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;
  mutedRef.current = muted;
  langRef.current = lang;

  const idlePhase = () => (enabledRef.current ? "wake" : "off");
  const shouldRun = () => enabledRef.current || modeRef.current === "command";

  /* ---------- speech output ---------- */
  const stopSpeaking = useCallback(() => {
    synth?.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const speak = useCallback((text) => {
    if (!synth || mutedRef.current || !text) return;
    synth.cancel();
    const spoken = plain(text);
    const utterance = new SpeechSynthesisUtterance(spoken);
    const want = TAMIL.test(text) ? "ta-IN" : langRef.current === "ta-IN" ? "en-IN" : langRef.current;
    utterance.lang = want;
    const voice = synth.getVoices().find((v) => v.lang?.replace("_", "-").toLowerCase().startsWith(want.slice(0, 2).toLowerCase()));
    if (voice) utterance.voice = voice;
    // Guard BEFORE audio starts so the mic never treats our reply as a command
    speakingRef.current = true;
    lastSpoken.current = { text: norm(spoken), at: Date.now() };
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = utterance.onerror = () => {
      setSpeaking(false);
      lastSpoken.current.at = Date.now();
      setTimeout(() => { speakingRef.current = false; }, 700);
    };
    synth.speak(utterance);
  }, []);

  const isEcho = (text) => {
    const { text: said, at } = lastSpoken.current;
    const t = norm(text);
    return Boolean(said && t.length > 2 && Date.now() - at < ECHO_MS && said.includes(t));
  };

  /* ---------- modes ---------- */
  function stopRec() {
    clearTimeout(restartTimer.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = rec.onresult = rec.onerror = null;
      try { rec.abort(); } catch { /* already stopped */ }
    }
  }

  function backToWake() {
    clearTimeout(cmdTimer.current);
    modeRef.current = "wake";
    setHeard("");
    setPhase(idlePhase());
    if (!enabledRef.current) stopRec(); // mic-button-only session ends here
  }

  const enterCommand = () => {
    modeRef.current = "command";
    setPhase("command");
    clearTimeout(cmdTimer.current);
    cmdTimer.current = setTimeout(backToWake, COMMAND_MS);
  };

  const fireCommand = (raw) => {
    const text = String(raw || "").trim();
    backToWake();
    if (!text) return;
    if (isEcho(text)) { rtsLog("ignored (echo of own speech):", JSON.stringify(text)); return; }
    const key = norm(text);
    if (key === lastCmd.current.text && Date.now() - lastCmd.current.at < DUP_MS) { rtsLog("ignored (duplicate):", JSON.stringify(text)); return; }
    lastCmd.current = { text: key, at: Date.now() };
    rtsLog("command:", JSON.stringify(text));
    onCommandRef.current?.(text);
  };

  /* ---------- recogniser ---------- */
  const fail = (code) => {
    rtsLog("listening stopped:", code);
    enabledRef.current = false;
    setEnabled(false);
    clearTimeout(cmdTimer.current);
    modeRef.current = "wake";
    stopRec();
    setError(errorText(code));
    setPhase("error");
    if (PERMISSION_ERRORS.has(code)) micOkRef.current = false;
    scheduleRecovery(code);
  };

  /* Never stay dead silently: previously every failure needed the panel's
     "Hey RTS" toggle (a click) to restart, so voice only came back after
     opening the assistant. Now:
       - permission blocked/dismissed (often because the prompt was opened
         without a user gesture) → retry once on the next click/key anywhere
         (skipped when permanently denied; permission onchange covers that)
       - transient errors → retry after RETRY_MS */
  function clearRecovery() {
    clearTimeout(retryTimer.current);
    if (gestureRetry.current) {
      document.removeEventListener("pointerdown", gestureRetry.current, true);
      document.removeEventListener("keydown", gestureRetry.current, true);
      gestureRetry.current = null;
    }
  }

  function scheduleRecovery(code) {
    clearRecovery();
    if (userOffRef.current || code === "language-not-supported") return;
    if (PERMISSION_ERRORS.has(code)) {
      if (permRef.current === "denied") return;
      const retry = () => {
        clearRecovery();
        if (!userOffRef.current && !enabledRef.current) { rtsLog("retrying after user gesture"); enableRef.current?.(); }
      };
      gestureRetry.current = retry;
      document.addEventListener("pointerdown", retry, true);
      document.addEventListener("keydown", retry, true);
      rtsLog("will retry microphone on next click/key");
      return;
    }
    retryTimer.current = setTimeout(() => {
      if (!userOffRef.current && !enabledRef.current && !document.hidden) { rtsLog("retrying after", code); enableRef.current?.(); }
    }, RETRY_MS);
  }

  function startRec() {
    if (!Recognition || recRef.current || document.hidden || !shouldRun()) return;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langRef.current;
    let startedAt = Date.now();
    let gotResult = false;

    rec.onstart = () => { startedAt = Date.now(); rtsLog("recognition started", rec.lang); };

    rec.onresult = (event) => {
      gotResult = true;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        const wake = matchWake(text);
        rtsLog(result.isFinal ? "final:" : "interim:", JSON.stringify(text), `mode=${modeRef.current}`, wake ? "(wake)" : "");

        // Chrome sometimes never fires utterance.onend → guard stuck on, every command ignored
        if (speakingRef.current && synth && !synth.speaking && !synth.pending && Date.now() - lastSpoken.current.at > 1000) {
          rtsLog("speech guard was stuck — cleared");
          speakingRef.current = false;
        }

        // While we speak, only "Hey RTS" (barge-in) is accepted
        if (speakingRef.current) {
          if (!wake) { if (result.isFinal) rtsLog("ignored (assistant speaking):", JSON.stringify(text)); continue; }
          stopSpeaking();
        }

        if (!result.isFinal) {
          if (wake && modeRef.current === "wake") {
            rtsLog("wake word detected");
            onWakeRef.current?.(); // animate the launcher + "RTS Listening" immediately
          }
          if (modeRef.current === "command" || wake) {
            setHeard((wake ? wake.rest : text).trim());
            // Enter/extend command mode on the interim wake too: the final
            // transcript may drop or mis-spell "Hey RTS", which used to leave
            // the session stuck in "detected" with the command ignored.
            enterCommand();
          }
          continue;
        }

        if (wake) {
          if (modeRef.current === "wake") { rtsLog("wake word detected"); onWakeRef.current?.(); }
          if (wake.rest) fireCommand(wake.rest); // "Hey RTS, go to invoice"
          else enterCommand(); // "Hey RTS" … wait for the next utterance
        } else if (modeRef.current === "command") {
          fireCommand(text);
        } else {
          rtsLog("ignored (no wake word):", JSON.stringify(text)); // ordinary speech
        }
      }
    };

    rec.onerror = (event) => {
      rtsLog("recognition error:", event.error);
      if (FATAL.has(event.error)) fail(event.error);
      // "no-speech" / "aborted" are normal; onend restarts
    };

    // Sessions end after silence / ~60s; restart while needed, backing off
    // on fast failures so a broken mic can never spin in a tight loop.
    rec.onend = () => {
      if (recRef.current !== rec) return;
      rtsLog("recognition ended (will restart if still listening)");
      recRef.current = null;
      if (!shouldRun() || document.hidden) return;
      const fast = !gotResult && Date.now() - startedAt < FAST_END_MS;
      fastFails.current = fast ? fastFails.current + 1 : 0;
      if (fastFails.current > MAX_FAST_FAILS) {
        fail("stopped");
        return;
      }
      restartTimer.current = setTimeout(startRec, fast ? 300 * 2 ** fastFails.current : 150);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
      fastFails.current += 1;
      if (fastFails.current <= MAX_FAST_FAILS) restartTimer.current = setTimeout(startRec, 300 * 2 ** fastFails.current);
    }
  }

  const ensureMic = async () => {
    setError("");
    if (!Recognition) {
      setError("Voice input is not supported in this browser (use Chrome or Edge). Please type your question.");
      setPhase("error");
      return false;
    }
    if (micOkRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      micOkRef.current = true;
      rtsLog("microphone permission granted");
      return true;
    } catch (err) {
      rtsLog("microphone request failed:", err?.name || err);
      fail(err?.name === "NotFoundError" ? "audio-capture" : "not-allowed");
      return false;
    }
  };

  const startWakeListening = () => {
    clearRecovery();
    enabledRef.current = true;
    fastFails.current = 0;
    setEnabled(true);
    setError("");
    if (modeRef.current !== "command") setPhase("wake");
    startRec();
  };

  const enable = useCallback(async () => {
    userOffRef.current = false;
    if (!(await ensureMic())) return;
    if (userOffRef.current) return; // switched off while the prompt was open
    startWakeListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session-only: a reload / next login starts listening again (default ON)
  const disable = useCallback(() => {
    rtsLog("turned off by user (this session)");
    userOffRef.current = true;
    clearRecovery();
    enabledRef.current = false;
    setEnabled(false);
    clearTimeout(cmdTimer.current);
    modeRef.current = "wake";
    stopRec();
    setHeard("");
    setPhase("off");
    stopSpeaking();
  }, [stopSpeaking]);
  const enableRef = useRef(enable);
  enableRef.current = enable;

  /* Mic button: listen for a command NOW (no wake word needed).
     Pressing it again while listening cancels. */
  const listenNow = useCallback(async () => {
    if (modeRef.current === "command") { backToWake(); return; }
    stopSpeaking();
    if (!(await ensureMic())) return;
    enterCommand();
    if (!recRef.current) { fastFails.current = 0; startRec(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  /* Cancel: stop talking and drop the pending command */
  const cancel = useCallback(() => {
    stopSpeaking();
    if (modeRef.current === "command") backToWake();
    setHeard("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    if (next) stopSpeaking();
    store.set("rts.muted", next ? "1" : "0");
    setMuted(next);
  }, [stopSpeaking]);

  const setLang = useCallback((code) => {
    store.set("rts.lang", code);
    langRef.current = code;
    setLangState(code);
    if (recRef.current) { stopRec(); startRec(); } // apply the new language now
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Background tabs: browsers suspend recognition there. Pause cleanly
     when hidden; resume with a fresh failure budget when visible. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stopRec();
        clearTimeout(cmdTimer.current);
        modeRef.current = "wake";
        setPhase(idlePhase());
      } else if (enabledRef.current) {
        fastFails.current = 0;
        startRec();
      } else if (!userOffRef.current && permRef.current === "granted") {
        startWakeListening(); // a retry was skipped while the tab was hidden
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* After login (this hook lives in the dashboard layout, mounted once
     for every authenticated CRM + ERP route): start wake listening
     automatically — default ON. The old persisted rts.voice = "off"
     flag blocked this forever (only the panel toggle could undo it), so
     it is cleared and no longer read. */
  useEffect(() => {
    rtsLog("listener mounted", Recognition ? "" : "(SpeechRecognition not supported)");
    store.del("rts.voice");
    if (!Recognition) return undefined;
    let status;
    let cancelled = false;
    const apply = () => {
      permRef.current = status?.state || "";
      rtsLog("microphone permission:", permRef.current || "unknown");
      if (cancelled || enabledRef.current || userOffRef.current) return;
      if (status?.state === "granted") {
        micOkRef.current = true;
        startWakeListening();
      } else if (status?.state === "denied") {
        setError("Microphone access is blocked for this site. Allow it in the browser's site settings (listening starts automatically), or type your question.");
        setPhase("error");
      } else {
        enable(); // "prompt": the browser asks once, then listening starts
      }
    };
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" })
        .then((p) => { status = p; p.onchange = apply; apply(); })
        .catch(() => enable()); // Permissions API without "microphone" (Safari/Firefox)
    } else {
      enable();
    }
    return () => { cancelled = true; if (status) status.onchange = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      rtsLog("listener unmounted");
      clearRecovery();
      enabledRef.current = false;
      modeRef.current = "wake";
      clearTimeout(cmdTimer.current);
      stopRec();
      synth?.cancel();
    },
     
    []
  );

  return {
    supported: Boolean(Recognition),
    ttsSupported: Boolean(synth),
    enabled,
    phase,
    listening: phase === "command" || phase === "detected",
    heard,
    muted,
    speaking,
    lang,
    error,
    enable,
    disable,
    listenNow,
    speak,
    stopSpeaking,
    toggleMute,
    setLang,
    cancel,
  };
}
