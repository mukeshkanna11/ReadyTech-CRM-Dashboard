import mongoose from "mongoose";
import { setDefaultWorkspaceId } from "../utils/workspaceContext.js";

/* Owns all pre-isolation records and all unauthenticated writes
   (website enquiry form, Instagram + WhatsApp webhooks).
   Raw driver read so the scope plugin is not involved. */
const resolveDefaultWorkspace = async () => {
  if (process.env.DEFAULT_WORKSPACE_ID) {
    setDefaultWorkspaceId(process.env.DEFAULT_WORKSPACE_ID);
    return;
  }

  const admin = await mongoose.connection.db
    .collection("users")
    .findOne(
      { role: "admin", isActive: true },
      { projection: { _id: 1 }, sort: { createdAt: 1 } }
    );

  setDefaultWorkspaceId(admin?._id);
  console.log(`🧱 Default workspace: ${admin?._id || "UNRESOLVED"}`);
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI); // remove options
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    await resolveDefaultWorkspace();
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    throw err;
  }
};

export default connectDB;
