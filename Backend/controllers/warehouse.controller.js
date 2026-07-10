import Warehouse from "../models/Warehouse.model.js";

/* =========================================================
   CREATE WAREHOUSE
========================================================= */
export const createWarehouse = async (req, res) => {
  try {
    const {
  name,
  code,
  location,
  manager,
  status,
  description,
  phone,
  email,
  address,
  city,
  state,
  country,
  pincode,
  capacity,
  currentStock,
  isPrimary,
} = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Warehouse name is required",
      });
    }

    // Duplicate name check
    const existingName = await Warehouse.findOne({
      name: name.trim(),
    });

    if (existingName) {
      return res.status(400).json({
        success: false,
        message: "Warehouse already exists",
      });
    }

    // Duplicate code check (only if code is provided)
    if (code) {
      const existingCode = await Warehouse.findOne({
        code: code.trim(),
      });

      if (existingCode) {
        return res.status(400).json({
          success: false,
          message: "Warehouse code already exists",
        });
      }
    }

    const warehouse = await Warehouse.create({
  name: name.trim(),
  code: code?.trim() || "",
  location: location?.trim() || "",
  manager: manager?.trim() || "",
  status: status || "Active",

  description: description || "",
  phone: phone || "",
  email: email || "",
  address: address || "",
  city: city || "",
  state: state || "",
  country: country || "India",
  pincode: pincode || "",

  capacity: Number(capacity) || 0,
  currentStock: Number(currentStock) || 0,

  isPrimary: Boolean(isPrimary),
});

    return res.status(201).json({
      success: true,
      message: "Warehouse created successfully",
      warehouse,
    });
  } catch (err) {
    console.error("Create Warehouse:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================================
   GET ALL WAREHOUSES
========================================================= */
export const getWarehouses = async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: warehouses.length,
      warehouses,
    });
  } catch (err) {
    console.error("Get Warehouses:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================================
   GET SINGLE WAREHOUSE
========================================================= */
export const getWarehouseById = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    return res.status(200).json({
      success: true,
      warehouse,
    });
  } catch (err) {
    console.error("Get Warehouse:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================================
   UPDATE WAREHOUSE
========================================================= */
export const updateWarehouse = async (req, res) => {
  try {
    const {
  name,
  code,
  location,
  manager,
  status,
  description,
  phone,
  email,
  address,
  city,
  state,
  country,
  pincode,
  capacity,
  currentStock,
  isPrimary,
} = req.body;

    const warehouse = await Warehouse.findById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    // Duplicate name check
    if (name) {
      const exists = await Warehouse.findOne({
        name,
        _id: { $ne: req.params.id },
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Warehouse name already exists",
        });
      }
    }

    // Duplicate code check
    if (code) {
      const existsCode = await Warehouse.findOne({
        code,
        _id: { $ne: req.params.id },
      });

      if (existsCode) {
        return res.status(400).json({
          success: false,
          message: "Warehouse code already exists",
        });
      }
    }

    warehouse.name = name ?? warehouse.name;
warehouse.code = code ?? warehouse.code;
warehouse.location = location ?? warehouse.location;
warehouse.manager = manager ?? warehouse.manager;
warehouse.status = status ?? warehouse.status;

warehouse.description = description ?? warehouse.description;
warehouse.phone = phone ?? warehouse.phone;
warehouse.email = email ?? warehouse.email;
warehouse.address = address ?? warehouse.address;
warehouse.city = city ?? warehouse.city;
warehouse.state = state ?? warehouse.state;
warehouse.country = country ?? warehouse.country;
warehouse.pincode = pincode ?? warehouse.pincode;

warehouse.capacity =
  capacity !== undefined
    ? Number(capacity)
    : warehouse.capacity;

warehouse.currentStock =
  currentStock !== undefined
    ? Number(currentStock)
    : warehouse.currentStock;

warehouse.isPrimary =
  isPrimary !== undefined
    ? Boolean(isPrimary)
    : warehouse.isPrimary;

    await warehouse.save();

    return res.status(200).json({
      success: true,
      message: "Warehouse updated successfully",
      warehouse,
    });
  } catch (err) {
    console.error("Update Warehouse:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =========================================================
   DELETE WAREHOUSE
========================================================= */
export const deleteWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    await warehouse.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Warehouse deleted successfully",
    });
  } catch (err) {
    console.error("Delete Warehouse:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};