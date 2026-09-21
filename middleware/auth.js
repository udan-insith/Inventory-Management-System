function requireLogin(req, res, next) {
	if (req.session && req.session.user) {
		return next();
	}
	return res.status(401).json({ error: "Please log in to continue." });
}

function requireAdmin(req, res, next) {
	if (req.session && req.session.user && req.session.user.role === "admin") {
		return next();
	}
	return res.status(403).json({ error: "Only admins can do this." });
}

module.exports = { requireLogin, requireAdmin };
