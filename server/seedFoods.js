
const mongoose = require("mongoose");
require("dotenv").config();

const Food = require("./models/Food");

const foods = [
  { name: "Pizza", price: 150, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591", category: "Fast Food" },
  { name: "Biryani", price: 180, image: "https://images.unsplash.com/photo-1512058564366-18510be2db19", category: "Indian" },
  { name: "Pasta", price: 120, image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601", category: "Italian" },
  { name: "Burger", price: 80, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd", category: "Fast Food" },
  { name: "French Fries", price: 60, image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877", category: "Snacks" },
  { name: "Ice Cream", price: 60, image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb", category: "Dessert" },
  { name: "Noodles", price: 90, image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624", category: "Chinese" },
  { name: "Fried Rice", price: 100, image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b", category: "Chinese" }
];

async function seedFoods() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Food.deleteMany({});
    await Food.insertMany(foods);
    console.log("Food items added successfully!");
  } catch (error) {
    console.error(error.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedFoods();
