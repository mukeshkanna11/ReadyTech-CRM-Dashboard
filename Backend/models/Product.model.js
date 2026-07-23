import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: true,
        trim: true,
    },

    description: {
        type: String,
        default: "",
        trim: true,
    },

    category: {
        type: String,
        default: "General",
        trim: true,
    },

    sku: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
    },

    price: {
        type: Number,
        default: 0,
        min: 0,
    },

    costPrice: {
        type: Number,
        default: 0,
        min: 0,
    },

    stockQuantity: {
        type: Number,
        default: 0,
        min: 0,
    },

    unit: {
        type: String,
        default: "pcs",
    },

    lowStockLimit: {
        type: Number,
        default: 10,
        min: 0,
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
},
{
    timestamps: true,
});

const Product =
    mongoose.models.Product ||
    mongoose.model("Product", productSchema);

export default Product;