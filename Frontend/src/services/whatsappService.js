import API from "./api";

/* =========================================================
   WHATSAPP INBOX API
   Reuses the shared axios instance (auth interceptor).
   No tokens or secrets ever reach the browser.
========================================================= */

export const getConversations = async ({ page = 1, limit = 20, search = "", unread = false, channel = "", status = "" } = {}) => {
  const { data } = await API.get("/whatsapp/conversations", {
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
      ...(unread ? { unread: "true" } : {}),
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
    },
  });

  return { items: data?.data || [], pagination: data?.pagination };
};

export const getMessages = async (conversationId, { page = 1, limit = 30 } = {}) => {
  const { data } = await API.get(
    `/whatsapp/conversations/${conversationId}/messages`,
    { params: { page, limit } }
  );

  return {
    conversation: data?.data?.conversation || null,
    messages: data?.data?.messages || [],
    pagination: data?.pagination,
  };
};

export const sendMessage = async (conversationId, text, media = null) => {
  const { data } = await API.post(
    `/whatsapp/conversations/${conversationId}/messages`,
    { text, ...(media ? { media } : {}) }
  );

  return data?.data;
};

export const markRead = async (conversationId) => {
  const { data } = await API.patch(
    `/whatsapp/conversations/${conversationId}/read`
  );

  return data?.data;
};

export const syncWhatsApp = async () => {
  const { data } = await API.post("/whatsapp/sync");
  return data?.data;
};

/* ---------- Unified inbox actions ---------- */
export const updateConversation = async (id, patch) => {
  const { data } = await API.patch(`/whatsapp/conversations/${id}`, patch);
  return data?.data;
};

export const addNote = async (id, body) => {
  const { data } = await API.post(`/whatsapp/conversations/${id}/notes`, { body });
  return data?.data;
};

export const convertToLead = async (id) => {
  const { data } = await API.post(`/whatsapp/conversations/${id}/lead`);
  return data;
};

export const getAssignees = async () => {
  const { data } = await API.get("/whatsapp/assignees");
  return data?.data || [];
};

/* Authenticated media proxy → object URL (token stays in the header) */
export const getMediaUrl = async (conversationId, messageId) => {
  const { data } = await API.get(
    `/whatsapp/conversations/${conversationId}/messages/${messageId}/media`,
    { responseType: "blob" }
  );
  return URL.createObjectURL(data);
};

export const connectWhatsApp = async (payload) => {
  const { data } = await API.post("/whatsapp/connect", payload);
  return data?.data;
};

export const disconnectWhatsApp = async () => {
  const { data } = await API.post("/whatsapp/disconnect");
  return data?.data;
};

/* =========================================================
   META EMBEDDED SIGNUP (connect / change number / reconnect)
   The browser only receives a 30-second code + the chosen
   phone/WABA ids; the server exchanges the code for the token.
========================================================= */
export const getEmbeddedSignupConfig = async () => {
  const { data } = await API.get("/whatsapp/embedded-signup/config");
  return data?.data;
};

const completeEmbeddedSignup = async (payload) => {
  const { data } = await API.post("/whatsapp/embedded-signup", payload);
  return data?.data;
};

let sdkPromise = null;
const loadFacebookSdk = (appId, version) => {
  const init = () => {
    window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
    return window.FB;
  };
  if (window.FB) return Promise.resolve(init());
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      window.fbAsyncInit = () => resolve(init());
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error("Could not load the Facebook SDK. Disable ad/tracking blockers for this site and try again."));
      };
      document.body.appendChild(script);
    });
  }
  return sdkPromise.then(init);
};

const isFacebookOrigin = (origin) => {
  try {
    const host = new URL(origin).hostname;
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
};

/* Warm-up: fetch config + load the SDK BEFORE the click, so FB.login
   runs synchronously inside the click and the popup isn't blocked. */
const PREPARED_TTL_MS = 10 * 60 * 1000; // server state lives 15 min
let prepared = null;
let preparing = null;

export const prepareEmbeddedSignup = () => {
  if (prepared && Date.now() - prepared.at < PREPARED_TTL_MS) return Promise.resolve(prepared);
  if (!preparing) {
    preparing = (async () => {
      const cfg = await getEmbeddedSignupConfig();
      if (!cfg?.ready) {
        throw Object.assign(new Error("WhatsApp signup is not configured on the server"), {
          blockers: cfg?.blockers || [],
        });
      }
      const FB = await loadFacebookSdk(cfg.appId, cfg.apiVersion);
      prepared = { cfg, FB, at: Date.now() };
      return prepared;
    })().finally(() => {
      preparing = null;
    });
  }
  return preparing;
};

/* Resolves with the safe WhatsApp status; rejects with a readable
   Error (err.blockers = server setup blockers when not configured). */
export const runEmbeddedSignup = async ({ coexistence = false } = {}) => {
  // No await on the warm path → popup opens within the user's click
  const ready = prepared && Date.now() - prepared.at < PREPARED_TTL_MS ? prepared : await prepareEmbeddedSignup();
  prepared = null; // signed state is per attempt
  const { cfg, FB } = ready;

  return new Promise((resolve, reject) => {
    let session = null;
    let code = null;
    let settled = false;
    let timer = null;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
    const fail = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const finish = () => {
      if (settled || !code || !session) return;
      settled = true;
      cleanup();
      completeEmbeddedSignup({ code, state: cfg.state, ...session })
        .then(resolve)
        // surfaced: the axios interceptor already showed this error
        .catch((err) => reject(Object.assign(new Error(err.response?.data?.message || err.message), { surfaced: !!err.response })));
    };

    function onMessage(event) {
      if (!isFacebookOrigin(event.origin)) return;
      let msg;
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (msg?.type !== "WA_EMBEDDED_SIGNUP") return;

      const d = msg.data || {};
      if (msg.event === "FINISH" || msg.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        session = {
          phoneNumberId: d.phone_number_id,
          wabaId: d.waba_id,
          coexistence: msg.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        };
        finish();
      } else if (msg.event === "FINISH_ONLY_WABA") {
        fail("Signup finished without a phone number. Run it again and add or select a phone number.");
      } else if (msg.event === "CANCEL" || msg.event === "ERROR") {
        fail(
          d.error_message
            ? `Meta reported an error: ${d.error_message}${d.error_code ? ` (code ${d.error_code})` : ""}`
            : `WhatsApp signup was cancelled${d.current_step ? ` at step "${d.current_step}"` : ""}.`
        );
      }
    }

    window.addEventListener("message", onMessage);

    FB.login(
      (response) => {
        code = response?.authResponse?.code || null;
        if (!code) return fail("WhatsApp signup was closed before it finished.");
        finish();
        // Code lives 30s — give the session event a short window to arrive
        timer = setTimeout(
          () => fail("Meta did not report which number was set up. Please try again."),
          15000
        );
      },
      {
        config_id: cfg.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          sessionInfoVersion: cfg.sessionInfoVersion,
          // v4 is Meta's default (selected by the Login for Business
          // configuration) — only non-default versions are sent explicitly
          ...(cfg.esVersion && cfg.esVersion !== "v4" ? { version: cfg.esVersion } : {}),
          ...(coexistence ? { featureType: "whatsapp_business_app_onboarding" } : {}),
        },
      }
    );
  });
};
