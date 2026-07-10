import { useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Send,
  Upload,
  MessageCircle,
} from "lucide-react";

export default function ContactPage() {
  /* ================= FORM STATE ================= */
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    expertise: "",
    message: "",
    file: null,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  /* ================= VALIDATION ================= */
  const validate = () => {
    const newErrors = {};
    if (!form.name) newErrors.name = "Name is required";
    if (!form.email) newErrors.email = "Email is required";
    if (!form.phone) newErrors.phone = "Phone is required";
    if (!form.expertise) newErrors.expertise = "Select expertise";
    if (!form.message) newErrors.message = "Message required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      const data = new FormData();
      Object.keys(form).forEach(key => data.append(key, form[key]));

      await fetch("http://localhost:5000/api/contact", {
        method: "POST",
        body: data,
      });

      alert("Message sent successfully!");
      setForm({
        name: "",
        email: "",
        phone: "",
        location: "",
        expertise: "",
        message: "",
        file: null,
      });
    } catch {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef6fb] relative">

      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-6 py-4 bg-white shadow">
        <h1 className="text-xl font-bold text-indigo-700">
          ReadyTech Solutions
        </h1>
        <a href="/" className="text-sm font-medium text-slate-600">
          Home
        </a>
      </header>

      {/* ================= HERO BANNER ================= */}
      <section className="px-6 text-white bg-gradient-to-br from-indigo-600 to-purple-600 py-14">
        <h2 className="max-w-5xl mx-auto text-4xl font-bold">
          Connect with Our Team of Experts
        </h2>
        <p className="max-w-5xl mx-auto mt-3 text-indigo-100">
          Build smarter, faster, and scalable solutions with ReadyTech.
        </p>
      </section>

      {/* ================= MAIN CONTENT ================= */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid items-center grid-cols-1 gap-12 px-6 py-16 mx-auto max-w-7xl lg:grid-cols-2"
      >

        {/* LEFT */}
        <div className="space-y-6">
          <h3 className="text-3xl font-bold text-slate-900">
            Let’s talk about your project
          </h3>

          <p className="max-w-md text-slate-600">
            CRM, Automation, Web & Mobile Development, AI solutions.
          </p>

          <div className="flex flex-wrap gap-6 text-sm text-slate-700">
            <Info icon={<Phone />} text="+91 90000 00000" />
            <Info icon={<Mail />} text="support@readytechsolutions.com" />
            <Info icon={<MapPin />} text="India" />
          </div>

          <img
            src="https://images.unsplash.com/photo-1544005313-94ddf0286df2"
            className="w-40 shadow rounded-xl"
            alt="Team"
          />
        </div>

        {/* RIGHT FORM */}
        <div className="bg-[#062a4d] text-white p-8 rounded-3xl shadow-2xl">
          <form className="space-y-5" onSubmit={handleSubmit}>

            <Input label="Full Name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              error={errors.name} />

            <Input label="Email Address" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              error={errors.email} />

            <Input label="Phone Number" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              error={errors.phone} />

            <Input label="Location" value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })} />

            <div>
              <label className="text-sm">Expertise</label>
              <select
                value={form.expertise}
                onChange={e => setForm({ ...form, expertise: e.target.value })}
                className="w-full p-3 mt-1 rounded-lg text-slate-900"
              >
                <option value="">Select</option>
                <option>CRM Development</option>
                <option>Web Development</option>
                <option>Mobile App</option>
                <option>Automation & AI</option>
              </select>
              {errors.expertise && <p className="text-sm text-red-400">{errors.expertise}</p>}
            </div>

            <div>
              <label className="text-sm">Message</label>
              <textarea
                rows="4"
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                className="w-full p-3 mt-1 rounded-lg text-slate-900"
              />
              {errors.message && <p className="text-sm text-red-400">{errors.message}</p>}
            </div>

            {/* FILE UPLOAD */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Upload size={16} /> Upload File
              <input
                type="file"
                hidden
                onChange={e => setForm({ ...form, file: e.target.files[0] })}
              />
            </label>

            <button
              disabled={loading}
              className="flex items-center justify-center w-full gap-2 px-6 py-3 font-semibold transition bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            >
              {loading ? "Sending..." : "Submit"} <Send size={18} />
            </button>
          </form>
        </div>
      </motion.div>

      {/* ================= GOOGLE MAP ================= */}
      <div className="px-6 pb-16 mx-auto max-w-7xl">
        <iframe
          title="map"
          className="w-full h-72 rounded-2xl"
          src="https://www.google.com/maps?q=India&output=embed"
        />
      </div>

      {/* ================= WHATSAPP FLOAT ================= */}
      <a
        href="https://wa.me/919000000000"
        target="_blank"
        className="fixed p-4 text-white bg-green-500 rounded-full shadow-lg bottom-6 right-6"
      >
        <MessageCircle />
      </a>
    </div>
  );
}

/* ================= COMPONENTS ================= */
function Input({ label, value, onChange, error }) {
  return (
    <div>
      <label className="text-sm">{label}</label>
      <input
        value={value}
        onChange={onChange}
        className="w-full p-3 mt-1 rounded-lg text-slate-900"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function Info({ icon, text }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-indigo-600">{icon}</span>
      {text}
    </div>
  );
}
