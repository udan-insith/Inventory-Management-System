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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
	session({
		name: "connect.sid",
		secret:
			process.env.SESSION_SECRET ||
			"gift-storage-secret-change-me-in-production",
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			maxAge: 8 * 60 * 60 * 1000, // 8 hour session
		},
	}),
);

// ---- API routes -------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/letters", lettersRoutes);
app.use("/api/requests", require("./routes/requests"));
app.use("/api/reset", require("./routes/reset"));

// A tiny "am I an admin" helper the frontend can call for UI decisions.
app.get("/api/me", requireLogin, (req, res) => {
	res.json({ user: req.session.user });
});

// ---- Static frontend ----------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));
app.use("/item-images", express.static(require("./config").ITEM_IMAGE_DIR));

app.get("/", (req, res) => {
	res.redirect("/login.html");
});
