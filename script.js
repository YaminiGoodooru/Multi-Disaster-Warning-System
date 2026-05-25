const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Correct MongoDB connection
mongoose.connect("mongodb://Dms-kb:Balaji123@ac-2rvfuzv-shard-00-00.stwuolm.mongodb.net:27017,ac-2rvfuzv-shard-00-01.stwuolm.mongodb.net:27017,ac-2rvfuzv-shard-00-02.stwuolm.mongodb.net:27017/MyDb?ssl=true&replicaSet=atlas-12qyk1-shard-0&authSource=admin&retryWrites=true&w=majority")
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ Error:", err));
// Schema
const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  location: String
});

const User = mongoose.model("User", userSchema, "Users");

// API
app.post("/add-user", async (req, res) => {
  try {
    const { name, phone, location } = req.body;
    const newUser = new User({ name, phone, location });
    await newUser.save();

    res.send("User added successfully");
  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.get("/users", async (req, res) => {
  try {
    const users = await User.find(); // fetch all users from DB
    res.json(users);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
