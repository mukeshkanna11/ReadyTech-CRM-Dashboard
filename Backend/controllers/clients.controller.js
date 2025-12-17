import Client from "../models/Client.js";
import { logAction } from "../utils/auditLogger.js"; // Optional: if you want audit logs

// Create new client
export const createClient = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const client = await Client.create({ name, email, phone });

    // Log the action
    if (req.user) await logAction(req.user._id, "CREATE_CLIENT", { clientId: client._id, name });

    res.status(201).json(client);
  } catch (err) {
    console.error("Create Client Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// Get all clients
export const getClients = async (req, res) => {
  try {
    const clients = await Client.find();
    res.status(200).json(clients);
  } catch (err) {
    console.error("Get Clients Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// Get client by ID
export const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.status(200).json(client);
  } catch (err) {
    console.error("Get Client By ID Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// Update client
export const updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!client) return res.status(404).json({ message: "Client not found" });

    // Log the action
    if (req.user) await logAction(req.user._id, "UPDATE_CLIENT", { clientId: client._id });

    res.status(200).json(client);
  } catch (err) {
    console.error("Update Client Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// Delete client
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    // Log the action
    if (req.user) await logAction(req.user._id, "DELETE_CLIENT", { clientId: client._id });

    res.status(200).json({ message: "Client deleted successfully" });
  } catch (err) {
    console.error("Delete Client Error:", err.message);
    res.status(500).json({ message: err.message });
  }
};
