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


/* ================= CREATE PRODUCT ================= */
export const createProduct = async (req, res) => {
  try {
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
    delete req.body.barcode;
    delete req.body.sku;

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