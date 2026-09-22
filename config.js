const path = require("path");

// Where uploaded files live. Fine as local folders for a VPS or local use;
// on a host that gives you one persistent volume mounted at a fixed path
// (Northflank, Railway, Fly, etc.), point UPLOAD_DIR at it, e.g.:
//   UPLOAD_DIR=/data/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

module.exports = {
	UPLOAD_DIR,
	ITEM_IMAGE_DIR: path.join(UPLOAD_DIR, "items"),
	REQUEST_FILE_DIR: path.join(UPLOAD_DIR, "requests"),
};
