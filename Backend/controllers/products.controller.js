// controllers/products.controller.js
import Product from "../models/Product.js";


const generateBarcode = () => {
  return (
    "RTS" +
    Date.now().toString().slice(-8) +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
  );
};

// Trimmed SKU from the request body; "" when blank
const normalizeSku = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const skuTakenResponse = (res) =>
  res.status(409).json({
    success: false,
    message: "SKU already exists",
  });


/* ================= CREATE PRODUCT ================= */
export const createProduct = async (req, res) => {
  try {
    // Blank SKU → schema default generates one
    const sku = normalizeSku(req.body.sku);
    if (sku) {
      if (await Product.findOne({ sku })) return skuTakenResponse(res);
      req.body.sku = sku;
    } else {
      delete req.body.sku;
    }

    let barcode = generateBarcode();

    // Ensure barcode is unique
    while (await Product.findOne({ barcode })) {
      barcode = generateBarcode();
    }

    const product = await Product.create({
      ...req.body,
      barcode,
    });

    res.status(201).json({
      success: true,
      message: "Product created",
      data: product,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.sku) {
      return skuTakenResponse(res);
    }
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create product",
    });
  }
};

/* ================= GET ALL PRODUCTS ================= */
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch products",
    });
  }
};

/* ================= GET SINGLE PRODUCT ================= */
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get product by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch product",
    });
  }
};

export const getProductByBarcode = async (req, res) => {
  try {
    const product = await Product.findOne({
      barcode: req.params.barcode,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

/* ================= UPDATE PRODUCT ================= */
export const updateProduct = async (req, res) => {
  try {
    // Barcode is never changed on edit
    delete req.body.barcode;

    // SKU is editable; never regenerated on update
    if (req.body.sku !== undefined) {
      const sku = normalizeSku(req.body.sku);
      if (!sku) {
        return res.status(400).json({
          success: false,
          message: "SKU cannot be empty",
        });
      }
      const duplicate = await Product.findOne({
        sku,
        _id: { $ne: req.params.id },
      });
      if (duplicate) return skuTakenResponse(res);
      req.body.sku = sku;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product updated",
      data: product,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.sku) {
      return skuTakenResponse(res);
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ================= DELETE PRODUCT ================= */
export const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }
    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product",
    });
  }
};