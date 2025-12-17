import mongoose from "mongoose";
const { Schema } = mongoose;

const ClientSchema = new Schema({
  name: { type: String, required: true },
  contactPerson: String,
  email: String,
  phone: String,
  billingAddress: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Client", ClientSchema);
