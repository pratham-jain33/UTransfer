const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 5000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

let files = []; // store file metadata

// Middleware
app.use(express.static("public"));
app.use(express.json());

// Multer setup with size limit (500 MB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"))
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});

// Helper: get device info
function getDeviceInfo() {
  const hostname = os.hostname();
  const platform = os.platform();
  const release = os.release();

  let osName;
  if (platform === "win32") osName = "Windows " + release;
  else if (platform === "darwin") osName = "macOS " + release;
  else osName = "Linux " + release;

  return `${hostname} (${osName})`;
}

// Upload route
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    const { pin, nickname } = req.body;
    if (!pin) return res.status(400).json({ error: "PIN is required" });

    if (!req.file) return res.status(400).json({ error: "File is required" });

    const meta = {
      name: req.file.originalname,
      stored: req.file.filename,
      size: req.file.size,
      device: getDeviceInfo(),
      nickname: nickname || "",
      pin,
      time: new Date().toISOString(),
      expiresAt: Date.now() + 10 * 60 * 1000 // expires in 10 minutes
    };

    files.push(meta);

    console.log("📂 New file uploaded:", meta.name);
    io.emit("update", files);
    res.json({ success: true, file: meta });
  } catch (err) {
    console.error("❌ Upload error:", err.message);
    res.status(500).json({ error: "Server error during upload" });
  }
});

// Download route
app.post("/download", (req, res) => {
  const { filename, pin } = req.body;
  const file = files.find(f => f.stored === filename);

  if (!file) return res.status(404).json({ error: "File not found" });
  if (file.pin !== pin) return res.status(403).json({ error: "Invalid PIN" });

  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File missing from server" });

  console.log(`⬇️ Downloaded: ${file.name} by ${file.device}`);
  res.download(filePath, file.name);
});

// Delete route
app.post("/delete", (req, res) => {
  const { filename, pin } = req.body;
  const file = files.find(f => f.stored === filename);

  if (!file) return res.status(404).json({ error: "File not found" });
  if (file.pin !== pin) return res.status(403).json({ error: "Invalid PIN" });

  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  files = files.filter(f => f.stored !== filename);

  console.log(`🗑️ Deleted: ${file.name} by ${file.device}`);
  io.emit("update", files);
  res.json({ success: true });
});

// Background job: delete expired files every minute
setInterval(() => {
  const now = Date.now();
  files.forEach(file => {
    if (file.expiresAt && now > file.expiresAt) {
      const filePath = path.join(UPLOAD_DIR, file.stored);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`⏰ Auto-deleted expired file: ${file.name}`);
      }
      files = files.filter(f => f.stored !== file.stored);
      io.emit("update", files);
    }
  });
}, 60 * 1000);

// Keep-alive bot (pings itself every 5 minutes)
setInterval(async () => {
  try {
    await axios.get(SELF_URL);
    console.log("🤖 Keep-alive ping successful");
  } catch (err) {
    console.error("⚠️ Keep-alive ping failed:", err.message);
  }
}, 5 * 60 * 1000);

// Socket.IO connections
io.on("connection", socket => {
  console.log("🔗 Client connected");
  socket.emit("update", files);
});

// Multer error handler
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large (max 500 MB)" });
  }
  console.error("❌ Unexpected error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 UTransfer running at ${SELF_URL}`);
});
