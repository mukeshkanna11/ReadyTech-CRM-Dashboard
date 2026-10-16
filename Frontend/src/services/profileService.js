import API from "./api";

/* ---------- My Profile ---------- */
export const getMyProfile = async () => (await API.get("/user/me")).data?.data;
export const updateMyProfile = async (patch) => (await API.patch("/user/me", patch)).data?.data;

/* ---------- Notifications (new-lead events) ---------- */
export const getNotifications = async (limit = 10) =>
  (await API.get("/user/me/notifications", { params: { limit } })).data?.data || { items: [], unread: 0 };
export const markNotificationsRead = async () =>
  (await API.patch("/user/me/notifications/read")).data?.data;

/* Profile changes broadcast so the navbar avatar/name refresh instantly */
export const PROFILE_EVENT = "profile:updated";

/* Resize/compress an image file to a square JPEG data URL (≤ 256px) */
export const fileToAvatar = (file, size = 256) =>
  new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file?.type || "")) {
      return reject(new Error("Choose a PNG, JPEG or WebP image"));
    }
    if (file.size > 5 * 1024 * 1024) return reject(new Error("Image must be under 5 MB"));

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(
        img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error("Could not read this image")));
    img.src = url;
  });

export const initialsOf = (name) =>
  String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export const timeAgo = (date) => {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
};
