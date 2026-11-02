
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const Food = require("./models/Food");
const Order = require("./models/Order");
const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired login." });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

app.get("/", (req, res) => {
  res.send("Delicious Food API is running!");
});

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({
        message: "Enter your name, email and password (at least 6 characters)."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: "user"
    });

    res.status(201).json({ message: "Account created. Please log in." });
  } catch (error) {
    res.status(500).json({ message: "Registration failed." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Incorrect email or password." });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch {
    res.status(500).json({ message: "Login failed." });
  }
});

// Foods
app.get("/api/foods", async (req, res) => {
  try {
    res.json(await Food.find().sort({ name: 1 }));
  } catch {
    res.status(500).json({ message: "Failed to fetch foods." });
  }
});

app.post("/api/foods", authenticate, adminOnly, async (req, res) => {
  try {
    const { name, price, image, category } = req.body;
    if (!name?.trim() || !Number.isFinite(Number(price)) ||
        Number(price) <= 0 || !image?.trim()) {
      return res.status(400).json({ message: "Enter valid food details." });
    }

    const food = await Food.create({
      name: name.trim(),
      price: Number(price),
      image: image.trim(),
      category: category?.trim() || "Food"
    });

    res.status(201).json(food);
  } catch {
    res.status(500).json({ message: "Could not add food." });
  }
});

app.delete("/api/foods/:id", authenticate, adminOnly, async (req, res) => {
  try {
    const food = await Food.findByIdAndDelete(req.params.id);
    if (!food) return res.status(404).json({ message: "Food not found." });
    res.json({ message: "Food deleted." });
  } catch {
    res.status(400).json({ message: "Invalid food ID." });
  }
});

// Place order
app.post("/api/orders", authenticate, async (req, res) => {
  try {
    const { items, customerName, phone, address } = req.body;

    if (!Array.isArray(items) || !items.length ||
        !customerName?.trim() || !phone?.trim() || !address?.trim()) {
      return res.status(400).json({
        message: "Enter your delivery details and select food."
      });
    }

    const orderItems = [];

    for (const item of items) {
      if (!mongoose.isValidObjectId(item.foodId)) {
        return res.status(400).json({ message: "Invalid food ID." });
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return res.status(400).json({ message: "Invalid quantity." });
      }

      const food = await Food.findById(item.foodId);
      if (!food) return res.status(400).json({ message: "Food not found." });

      orderItems.push({
        foodId: food._id,
        name: food.name,
        price: food.price,
        quantity
      });
    }

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity, 0
    );

    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      totalAmount,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      status: "Placed"
    });

    res.status(201).json({ message: "Order placed successfully!", order });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Could not place order." });
  }
});

// Customer sees only their orders
app.get("/api/orders/my", authenticate, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch {
    res.status(500).json({ message: "Could not load order history." });
  }
});

// Admin sees all orders
app.get("/api/orders", authenticate, adminOnly, async (req, res) => {
  try {
    res.json(await Order.find().sort({ createdAt: -1 }));
  } catch {
    res.status(500).json({ message: "Could not load orders." });
  }
});

app.patch("/api/orders/:id/status", authenticate, adminOnly, async (req, res) => {
  const allowed = ["Placed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];

  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ message: "Invalid order status." });
  }

  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json(order);
  } catch {
    res.status(400).json({ message: "Could not update order." });
  }
});

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully!");
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
  }
}

startServer();
