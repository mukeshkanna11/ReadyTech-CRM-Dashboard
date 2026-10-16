import { useCallback, useEffect, useRef, useState } from "react";

/* ======================================================
   RTS VOICE (browser-native, no paid voice APIs)
   - SpeechRecognition for "Hey RTS" + voice questions
   - speechSynthesis for spoken replies
   Listens only while the page is open AND voice mode is
   explicitly enabled by the user.
====================================================== */

const Recognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

// "Hey RTS" as browsers commonly transcribe it
const WAKE = /\bhey[\s,.!]*(r[\s.]*t[\s.]*s|rts|arts|artis|rds)\b[\s,.!?]*/i;

const AWAKE_MS = 8000;

const plain = (text) => text.replace(/[*#`_>|-]+/g, " ").replace(/\s+/g, " ").trim();

export default function useRtsVoice({ onCommand }) {
  const [enabled, setEnabled] = useState(false);
  const [awake, setAwake] = useState(false);
  const [heard, setHeard] = useState("");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  const recRef = useRef(null);
  const enabledRef = useRef(false);
  const awakeRef = useRef(false);
  const speakingRef = useRef(false);
  const awakeTimer = useRef(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

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

  const startRecognition = () => {
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-IN";

    rec.onresult = (event) => {
      if (speakingRef.current) return; // ignore our own spoken reply
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        setHeard(text.trim());
        if (event.results[i].isFinal) handleFinal(text);
      }
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was denied. You can still type your question.");
        enabledRef.current = false;
        setEnabled(false);
      }
    };

    // Browsers stop after silence; keep listening while voice mode is on
    rec.onend = () => {
      if (enabledRef.current) {
        try { rec.start(); } catch { /* already started */ }
      }
    };

    recRef.current = rec;
    rec.start();
  };

  const enable = useCallback(async () => {
    setError("");
    if (!Recognition) {
      setError("Voice input is not supported in this browser. Please type your question.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setError("Microphone permission was denied. You can still type your question.");
      return;
    }
    enabledRef.current = true;
    setEnabled(true);
    startRecognition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSpeaking = useCallback(() => {
    synth?.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const disable = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    setAwakeState(false);
    setHeard("");
    recRef.current?.abort();
    recRef.current = null;
    stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSpeaking]);

  const speak = useCallback(
    (text) => {
      if (!synth || muted || !text) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(plain(text));
      utterance.lang = navigator.language || "en-IN";
      utterance.onstart = () => { speakingRef.current = true; setSpeaking(true); };
      utterance.onend = utterance.onerror = () => { speakingRef.current = false; setSpeaking(false); };
      synth.speak(utterance);
    },
    [muted]
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) stopSpeaking();
      return !m;
    });
  }, [stopSpeaking]);

  useEffect(
    () => () => {
      enabledRef.current = false;
      recRef.current?.abort();
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
    error,
    enable,
    disable,
    speak,
    stopSpeaking,
    toggleMute,
  };
}
