require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");

const db = require("./database"); // ensures schema + seed run on boot (async — see db.ready below)

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const itemRoutes = require("./routes/items");
const transactionRoutes = require("./routes/transactions");
const historyRoutes = require("./routes/history");
const lettersRoutes = require("./routes/letters");
const { requireLogin } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3000;
