const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/products/low-stock
// Must be declared before /:id so "low-stock" is not treated as an ID.
router.get("/low-stock", async (req, res, next) => {
  try {
    const lowStockItems = await Product.find({
      $expr: { $lte: ["$quantity", "$reorderLevel"] }
    }).sort({ quantity: 1 });

    res.json({
      count: lowStockItems.length,
      lowStockItems
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/summary
// Category-wise inventory report using MongoDB aggregation.
router.get("/summary", async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalStockValue: { $sum: { $multiply: ["$price", "$quantity"] } },
          avgPrice: { $avg: "$price" }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalItems: 1,
          totalQuantity: 1,
          totalStockValue: { $round: ["$totalStockValue", 2] },
          avgPrice: { $round: ["$avgPrice", 2] }
        }
      }
    ]);

    res.json({
      categories: summary.length,
      summary
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/products - Create a product
router.post("/", async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// GET /api/products - Filtering, sorting and pagination
router.get("/", async (req, res, next) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      sort = "createdAt",
      order = "desc",
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (category) filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { sku: { $regex: safeSearch, $options: "i" } },
        { supplier: { $regex: safeSearch, $options: "i" } }
      ];
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
      if (Object.values(filter.price).some((value) => !Number.isFinite(value) || value < 0)) {
        return res.status(400).json({ message: "minPrice/maxPrice must be valid non-negative numbers" });
      }
    }

    if (inStock === "true") filter.quantity = { $gt: 0 };
    if (inStock === "false") filter.quantity = 0;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const allowedSortFields = ["name", "price", "quantity", "category", "createdAt", "updatedAt"];
    const sortField = allowedSortFields.includes(sort) ? sort : "createdAt";
    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Product.countDocuments(filter)
    ]);

    res.json({
      total,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - Get one product
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id - Update product details (including quantity if supplied)
router.put("/:id", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const allowedFields = ["name", "sku", "category", "price", "quantity", "reorderLevel", "supplier"];
    const updates = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
      context: "query"
    });

    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/products/:id/stock - Safely increase/decrease stock.
// Body: { "change": 10 } to restock; { "change": -3 } for a sale.
router.patch("/:id/stock", async (req, res, next) => {
  try {
    const { change } = req.body;

    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    if (!Number.isInteger(change) || change === 0) {
      return res.status(400).json({ message: "change must be a non-zero integer" });
    }

    // The quantity condition prevents a sale from making stock negative.
    const product = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(change < 0 ? { quantity: { $gte: Math.abs(change) } } : {})
      },
      { $inc: { quantity: change } },
      { new: true, runValidators: true }
    );

    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ message: "Product not found" });
      return res.status(400).json({ message: "Insufficient stock for this sale" });
    }

    res.json({
      message: "Stock updated",
      product
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id - Delete product
router.delete("/:id", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json({
      message: "Product deleted",
      id: product._id
    });
  } catch (error) {
    next(error);
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = router;
