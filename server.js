require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const productRoutes = require("./routes/productRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json());

// Simple health/root route
app.get("/", (req, res) => {
  res.json({ message: "Inventory Management API is running" });
});

app.use("/api/products", productRoutes);

// Unknown endpoint handler
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is missing. Add it to your .env file.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
