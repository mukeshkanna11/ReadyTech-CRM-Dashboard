import { useCallback, useEffect, useRef, useState } from "react";

/* ======================================================
   RTS VOICE (browser-native, no paid voice APIs)
   - SpeechRecognition: "Hey RTS" wake word (continuous) and
     push-to-talk (one question, works without the wake word)
   - speechSynthesis for spoken replies (English / Tamil)
   Honest limits: listening only works while this tab is open,
   only after the user grants microphone permission, and only in
   browsers with SpeechRecognition (Chrome / Edge; Safari partial;
   Firefox none → typing still works).
====================================================== */

const Recognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

export const VOICE_LANGS = [
  { code: "en-IN", label: "EN", name: "English / Tanglish" },
  { code: "ta-IN", label: "த", name: "தமிழ் (Tamil)" },
];

// "Hey RTS" as browsers commonly transcribe it (English + Tamil script)
const WAKE =
  /(\bhey[\s,.!]*(r[\s.]*t[\s.]*s|rts|arts|artis|rds)\b|ஹே[\s,.!]*(ஆர்[\s.]*டி[\s.]*எஸ்|ஆர்டிஎஸ்))[\s,.!?]*/i;

const AWAKE_MS = 8000;
const TAMIL = /[஀-௿]/;
const FATAL = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported"]);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// Strip markdown symbols but keep hyphens inside words (e.g. purchase-orders)
const plain = (text) =>
  text.replace(/^\s*[-•]\s+/gm, "").replace(/[*#`_>|]+/g, " ").replace(/\s+/g, " ").trim();

const errorText = (code) =>
  code === "not-allowed" || code === "service-not-allowed"
    ? "Microphone permission was denied. Allow it in the browser's site settings, or type your question."
    : code === "audio-capture"
    ? "No microphone was found. Please connect one or type your question."
    : code === "network"
    ? "Browser speech service is unreachable (it needs internet). Please type your question."
    : code === "language-not-supported"
    ? "This browser cannot recognise the selected language. Switch to EN or type your question."
    : "Voice input stopped. Turn voice mode on again or type your question.";

export default function useRtsVoice({ onCommand }) {
  const [enabled, setEnabled] = useState(false);
  const [awake, setAwake] = useState(false);
  const [heard, setHeard] = useState("");
  const [muted, setMuted] = useState(() => store.get("rts.muted") === "1");
  const [speaking, setSpeaking] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const [lang, setLangState] = useState(() => store.get("rts.lang") || "en-IN");
  const [error, setError] = useState("");

  const recRef = useRef(null);
  const pttRef = useRef(null);
  const enabledRef = useRef(false);
  const awakeRef = useRef(false);
  const speakingRef = useRef(false);
  const mutedRef = useRef(muted);
  const langRef = useRef(lang);
  const awakeTimer = useRef(null);
  const restartTimer = useRef(null);
  const restarts = useRef([]);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  mutedRef.current = muted;
  langRef.current = lang;

  const setAwakeState = (value) => {
    awakeRef.current = value;
    setAwake(value);
    clearTimeout(awakeTimer.current);
    if (value) awakeTimer.current = setTimeout(() => setAwakeState(false), AWAKE_MS);
  };

  const handleFinal = (text) => {
    const match = text.match(WAKE);

    if (match) {
      const rest = text.slice(match.index + match[0].length).trim();
      if (rest) {
        setAwakeState(false);
        onCommandRef.current?.(rest);
      } else {
        setAwakeState(true);
        onCommandRef.current?.(null); // wake only: open the panel
      }
      return;
    }

    if (awakeRef.current && text.trim()) {
      setAwakeState(false);
      onCommandRef.current?.(text.trim());
    }
  };

  const stopWake = () => {
    clearTimeout(restartTimer.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec) { rec.onend = null; rec.abort(); }
  };

  const turnOff = (message) => {
    enabledRef.current = false;
    setEnabled(false);
    setAwakeState(false);
    stopWake();
    if (message) setError(message);
  };

  const startWake = () => {
    if (!enabledRef.current || recRef.current || pttRef.current || document.hidden) return;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langRef.current;

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        // While we speak, only "Hey RTS" (barge-in) counts — never our own reply
        if (speakingRef.current) {
          if (!WAKE.test(text)) continue;
          synth?.cancel();
          speakingRef.current = false;
          setSpeaking(false);
        }
        setHeard(text.trim());
        if (event.results[i].isFinal) handleFinal(text);
      }
    };

    rec.onerror = (event) => {
      if (FATAL.has(event.error)) {
        turnOff(errorText(event.error));
        if (event.error.startsWith("not-allowed") || event.error === "service-not-allowed") store.set("rts.voice", "off");
      }
    };

    // Browsers stop after silence; keep listening while voice mode is on,
    // with a guard against tight restart loops.
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      if (!enabledRef.current || document.hidden) return;
      const now = Date.now();
      restarts.current = [...restarts.current.filter((t) => now - t < 10000), now];
      if (restarts.current.length > 6) {
        turnOff(errorText("stopped"));
        return;
      }
      restartTimer.current = setTimeout(startWake, 300);
    };

    recRef.current = rec;
    try { rec.start(); } catch { recRef.current = null; }
  };

  const ensureMic = async () => {
    setError("");
    if (!Recognition) {
      setError("Voice input is not supported in this browser (use Chrome or Edge). Please type your question.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      setError(errorText("not-allowed"));
      return false;
    }
  };

  const enable = useCallback(async () => {
    if (!(await ensureMic())) return;
    store.set("rts.voice", "on");
    enabledRef.current = true;
    restarts.current = [];
    setEnabled(true);
    startWake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSpeaking = useCallback(() => {
    synth?.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const disable = useCallback(() => {
    store.set("rts.voice", "off");
    turnOff();
    setHeard("");
    stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  /* Push-to-talk: one question, no wake word needed */
  const pushToTalk = useCallback(async () => {
    if (pttRef.current) { pttRef.current.stop(); return; }
    if (!(await ensureMic())) return;
    stopSpeaking();
    stopWake(); // the browser allows one recogniser at a time

    const rec = new Recognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = langRef.current;
    let finalText = "";

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        setHeard(text.trim());
        if (event.results[i].isFinal) finalText += ` ${text}`;
      }
    };
    rec.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") setError(errorText(event.error));
    };
    rec.onend = () => {
      pttRef.current = null;
      setPttActive(false);
      const text = finalText.replace(WAKE, " ").trim();
      if (text) onCommandRef.current?.(text);
      startWake(); // resume "Hey RTS" if voice mode is on
    };

    pttRef.current = rec;
    setPttActive(true);
    try { rec.start(); } catch { pttRef.current = null; setPttActive(false); startWake(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  const speak = useCallback((text) => {
    if (!synth || mutedRef.current || !text) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(plain(text));
    const want = TAMIL.test(text) ? "ta-IN" : langRef.current === "ta-IN" ? "en-IN" : langRef.current;
    utterance.lang = want;
    const voice = synth.getVoices().find((v) => v.lang?.replace("_", "-").toLowerCase().startsWith(want.slice(0, 2).toLowerCase()));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => { speakingRef.current = true; setSpeaking(true); };
    utterance.onend = utterance.onerror = () => {
      setSpeaking(false);
      // short tail so the end of our own reply is not heard as a command
      setTimeout(() => { speakingRef.current = false; }, 600);
    };
    synth.speak(utterance);
  }, []);

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
    if (enabledRef.current) { stopWake(); startWake(); } // apply to the wake listener
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Cancel: stop talking and listening for the current question */
  const cancel = useCallback(() => {
    stopSpeaking();
    setAwakeState(false);
    setHeard("");
    pttRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  /* Background tabs: browsers suspend/kill recognition there. Pause
     cleanly when hidden and resume (fresh restart budget) when visible. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stopWake();
        setAwakeState(false);
      } else if (enabledRef.current) {
        restarts.current = [];
        startWake();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* After login: resume voice mode only if the user turned it on before
     AND the browser already has microphone permission (no surprise prompts). */
  useEffect(() => {
    if (!Recognition || store.get("rts.voice") !== "on") return;
    let cancelled = false;
    navigator.permissions?.query({ name: "microphone" })
      .then((p) => {
        if (cancelled || p.state !== "granted") return;
        enabledRef.current = true;
        setEnabled(true);
        startWake();
      })
      .catch(() => { /* Permissions API unavailable: user re-enables manually */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      enabledRef.current = false;
      stopWake();
      pttRef.current?.abort();
      clearTimeout(awakeTimer.current);
      synth?.cancel();
    },
    []
  );

  return {
    supported: Boolean(Recognition),
    ttsSupported: Boolean(synth),
    enabled,
    awake,
    heard,
    muted,
    speaking,
    pttActive,
    lang,
    error,
    enable,
    disable,
    cancel,
    pushToTalk,
    speak,
    stopSpeaking,
    toggleMute,
    setLang,
  };
}
