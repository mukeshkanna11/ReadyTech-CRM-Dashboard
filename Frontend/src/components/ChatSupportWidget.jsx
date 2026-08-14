import { useRef, useState } from "react";
import {
  Brain,
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { submitEnquiry } from "../services/chatSupport";

/* ======================================================
   DEFAULT FORM
====================================================== */

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  category: "",
  message: "",
};

/* ======================================================
   CATEGORY OPTIONS
====================================================== */

const CATEGORIES = [
  "CRM Demo",
  "ERP Demo",
  "CRM & ERP",
  "Pricing Enquiry",
  "Technical Support",
  "General Enquiry",
];

/* ======================================================
   SUBJECT MAPPING
====================================================== */

const getSubject = (category) => {
  switch (category) {
    case "CRM Demo":
      return "CRM Demo Request";

    case "ERP Demo":
      return "ERP Demo Request";

    case "CRM & ERP":
      return "CRM & ERP Enquiry";

    case "Pricing Enquiry":
      return "Pricing Enquiry";

    case "Technical Support":
      return "Technical Support Request";

    default:
      return "General Enquiry";
  }
};

/* ======================================================
   EMAIL VALIDATION
====================================================== */

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/* ======================================================
   CHAT SUPPORT WIDGET
====================================================== */

export default function ChatSupportWidget() {
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);

  const [sending, setSending] = useState(false);

  const [success, setSuccess] = useState("");

  const [error, setError] = useState("");

  const inputRef = useRef(null);

  /* ======================================================
     HANDLE INPUT
  ====================================================== */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  /* ======================================================
     SUBMIT ENQUIRY
  ====================================================== */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (sending) return;

    setError("");
    setSuccess("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const company = form.company.trim();
    const category = form.category.trim();
    const message = form.message.trim();

    /* ================= VALIDATION ================= */

    if (!name) {
      setError("Please enter your name.");
      return;
    }

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!phone) {
      setError("Please enter your phone number.");
      return;
    }

    if (!company) {
      setError("Please enter your company name.");
      return;
    }

    if (!category) {
      setError("Please select your requirement.");
      return;
    }

    if (!message) {
      setError("Please enter your message.");
      return;
    }

    /* ==================================================
       BACKEND PAYLOAD

       Exactly matches your working Postman payload.
    ================================================== */

    const payload = {
      name,
      email,
      phone,
      company,
      category,
      subject: getSubject(category),
      message,
      source: "Website",
      priority: "Medium",
    };

    try {
      setSending(true);

      const response = await submitEnquiry(payload);

      if (!response?.success) {
        throw new Error(
          response?.message || "Failed to submit enquiry."
        );
      }

      /* ================================================
         SUCCESS

         Backend has already:
         Chat ✅
         Lead ✅
         Email ✅
      ================================================ */

      setSuccess(
        "Thank you! Your enquiry has been submitted successfully. Our team will contact you shortly."
      );

      setForm(INITIAL_FORM);

    } catch (err) {
      console.error("❌ ENQUIRY SUBMIT ERROR:", err);

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to submit your enquiry. Please try again.";

      setError(message);

    } finally {
      setSending(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  /* ======================================================
     CLOSE
  ====================================================== */

  const handleClose = () => {
    if (sending) return;

    setOpen(false);
    setError("");
    setSuccess("");
  };

  /* ======================================================
     FLOATING BUTTON
  ====================================================== */

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Contact ReadyTech"
        aria-label="Open contact form"
        className="fixed z-40 flex items-center justify-center text-white transition rounded-full shadow-xl  bottom-6 right-6 h-14 w-14 bg-gradient-to-br from-indigo-600 to-violet-600 hover:scale-105 active:scale-95"
      >
        <Brain size={24} />

        <span
          className="absolute w-3 h-3 border-2 border-white rounded-full  right-1 top-1 bg-emerald-400"
        />
      </button>
    );
  }

  /* ======================================================
     PANEL
  ====================================================== */

  return (
    <>
      {/* Mobile backdrop */}

      <div
        onClick={handleClose}
        className="fixed inset-0 z-40  bg-slate-900/40 backdrop-blur-sm sm:hidden"
      />

      <div
        role="dialog"
        aria-label="Contact ReadyTech"
        className="
          fixed z-50
          flex flex-col
          overflow-hidden
          bg-white
          shadow-2xl

          inset-x-0
          bottom-0
          top-0
          rounded-none

          sm:inset-auto
          sm:bottom-6
          sm:right-6
          sm:top-auto
          sm:h-[min(680px,calc(100vh-3rem))]
          sm:w-[420px]
          sm:rounded-3xl
          sm:border
          sm:border-slate-200
        "
      >
        {/* ==================================================
            HEADER
        ================================================== */}

        <div
          className="relative px-4 py-4 overflow-hidden text-white  bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-900 shrink-0"
        >
          <div
            className="absolute rounded-full  -right-10 -top-10 h-28 w-28 bg-indigo-500/20 blur-2xl"
          />

          <div className="relative flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 border  shrink-0 rounded-2xl border-white/20 bg-white/10"
            >
              <Brain size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                ReadyTech Support
              </p>

              <p className="flex items-center gap-1.5 text-xs text-indigo-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />

                How can we help you?
              </p>
            </div>

            <button
              onClick={handleClose}
              disabled={sending}
              title="Close"
              aria-label="Close support form"
              className="flex items-center justify-center  h-9 w-9 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ==================================================
            CONTENT
        ================================================== */}

        <div className="flex-1 px-4 py-4 overflow-y-auto bg-slate-50">
          {/* Greeting */}

          <div className="flex justify-start mb-4">
            <div
              className="
                max-w-[90%]
                rounded-2xl
                rounded-bl-md
                border
                border-slate-200
                bg-white
                px-3.5
                py-2.5
                shadow-sm
              "
            >
              <p className="text-sm leading-relaxed text-slate-700">
                Hi! 👋 Tell us what you need and our team will get
                back to you shortly.
              </p>
            </div>
          </div>

          {/* ==================================================
              SUCCESS MESSAGE
          ================================================== */}

          {success && (
            <div
              className="flex items-start gap-2 p-3 mb-4 border  rounded-2xl border-emerald-200 bg-emerald-50"
            >
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-emerald-600"
              />

              <p className="text-sm leading-relaxed text-emerald-700">
                {success}
              </p>
            </div>
          )}

          {/* ==================================================
              ERROR
          ================================================== */}

          {error && (
            <div
              className="flex items-start gap-2 p-3 mb-4 border  rounded-2xl border-rose-200 bg-rose-50"
            >
              <AlertTriangle
                size={17}
                className="mt-0.5 shrink-0 text-rose-600"
              />

              <p className="text-sm leading-relaxed text-rose-700">
                {error}
              </p>
            </div>
          )}

          {/* ==================================================
              FORM
          ================================================== */}

          {!success && (
            <form
              onSubmit={handleSubmit}
              className="space-y-3"
            >
              {/* Name */}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Name *
                </label>

                <input
                  ref={inputRef}
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  disabled={sending}
                  autoComplete="name"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-3.5
                    py-2.5
                    text-sm
                    text-slate-800
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-indigo-500
                    focus:ring-4
                    focus:ring-indigo-500/10
                    disabled:opacity-60
                  "
                />
              </div>

              {/* Email */}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Email *
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  disabled={sending}
                  autoComplete="email"
                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-3.5
                    py-2.5
                    text-sm
                    text-slate-800
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-indigo-500
                    focus:ring-4
                    focus:ring-indigo-500/10
                    disabled:opacity-60
                  "
                />
              </div>

              {/* Phone + Company */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Phone *
                  </label>

                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="9876543210"
                    disabled={sending}
                    autoComplete="tel"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-slate-200
                      bg-white
                      px-3.5
                      py-2.5
                      text-sm
                      text-slate-800
                      outline-none
                      transition
                      placeholder:text-slate-400
                      focus:border-indigo-500
                      focus:ring-4
                      focus:ring-indigo-500/10
                      disabled:opacity-60
                    "
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Company *
                  </label>

                  <input
                    type="text"
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="Company name"
                    disabled={sending}
                    autoComplete="organization"
                    className="
                      w-full
                      rounded-xl
                      border
                      border-slate-200
                      bg-white
                      px-3.5
                      py-2.5
                      text-sm
                      text-slate-800
                      outline-none
                      transition
                      placeholder:text-slate-400
                      focus:border-indigo-500
                      focus:ring-4
                      focus:ring-indigo-500/10
                      disabled:opacity-60
                    "
                  />
                </div>
              </div>

              {/* Requirement */}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Requirement *
                </label>

                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  disabled={sending}
                  className="
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-3.5
                    py-2.5
                    text-sm
                    text-slate-800
                    outline-none
                    transition
                    focus:border-indigo-500
                    focus:ring-4
                    focus:ring-indigo-500/10
                    disabled:opacity-60
                  "
                >
                  <option value="">
                    Select your requirement
                  </option>

                  {CATEGORIES.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message */}

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Message *
                </label>

                <textarea
                  name="message"
                  rows={4}
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Tell us how we can help..."
                  disabled={sending}
                  className="
                    w-full
                    resize-none
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-3.5
                    py-2.5
                    text-sm
                    text-slate-800
                    outline-none
                    transition
                    placeholder:text-slate-400
                    focus:border-indigo-500
                    focus:ring-4
                    focus:ring-indigo-500/10
                    disabled:opacity-60
                  "
                />
              </div>

              {/* Submit */}

              <button
                type="submit"
                disabled={sending}
                className="
                  flex
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-indigo-600
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-indigo-700
                  active:scale-[0.99]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {sending ? (
                  <>
                    <span
                      className="w-4 h-4 border-2 rounded-full  animate-spin border-white/30 border-t-white"
                    />

                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />

                    Submit Enquiry
                  </>
                )}
              </button>
            </form>
          )}

          {/* ==================================================
              AFTER SUCCESS
          ================================================== */}

          {success && (
            <button
              type="button"
              onClick={() => {
                setSuccess("");
                setError("");
              }}
              className="w-full px-4 py-3 text-sm font-semibold text-indigo-700 transition border border-indigo-200  rounded-xl bg-indigo-50 hover:bg-indigo-100"
            >
              Submit Another Enquiry
            </button>
          )}
        </div>

        {/* ==================================================
            FOOTER
        ================================================== */}

        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2.5">
          <p className="text-center text-[10px] text-slate-400">
            Your enquiry will be securely sent to the ReadyTech team.
          </p>
        </div>
      </div>
    </>
  );
}