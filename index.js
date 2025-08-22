 const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const login = require("fca-unofficial");

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 10000;

let botConfig = null;
let apiInstance = null;

// Home page
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send(`
    <html>
    <head><title>HenryX Bot</title></head>
    <body style="font-family: Arial; background: #111; color: white; text-align:center;">
      <h1>🤖 Henry-X Bot Panel</h1>
      <form method="POST" action="/start-bot" enctype="multipart/form-data">
        <label>Upload appstate.json:</label><br>
        <input type="file" name="appstate" required><br><br>
        <label>Prefix:</label><br>
        <input type="text" name="prefix" required><br><br>
        <label>Admin UID:</label><br>
        <input type="text" name="adminID" required><br><br>
        <button type="submit">🚀 Start Bot</button>
      </form>
      ${botConfig ? "<p>✅ Bot Running!</p>" : ""}
    </body>
    </html>
  `);
});

// Start bot
app.post("/start-bot", upload.single("appstate"), (req, res) => {
  try {
    const prefix = req.body.prefix.trim();
    const adminID = req.body.adminID.trim();
    const appState = JSON.parse(fs.readFileSync(req.file.path, "utf8"));

    botConfig = { prefix, adminID, appState };
    startBot(botConfig);

    res.redirect("/");
  } catch (e) {
    console.error(e);
    res.send("❌ Invalid appstate.json file.");
  }
});

// Bot Logic
function startBot({ prefix, adminID, appState }) {
  if (apiInstance) return; // Prevent double login

  login({ appState }, (err, api) => {
    if (err) {
      console.error("❌ Login failed:", err);
      return;
    }

    apiInstance = api;
    api.setOptions({ listenEvents: true });
    console.log("✅ Bot logged in and running...");

    api.listenMqtt((err, event) => {
      if (err) return console.error(err);

      if (event.type === "message" && event.body.startsWith(prefix)) {
        const args = event.body.slice(prefix.length).trim().split(" ");
        const command = args[0].toLowerCase();
        const senderID = event.senderID;

        if (senderID !== adminID) {
          return api.sendMessage("❌ You are not admin!", event.threadID);
        }

        // Commands
        if (command === "help") {
          api.sendMessage(
            `📜 HenryX Commands:
- ${prefix}help
- ${prefix}uid
- ${prefix}tid
`,
            event.threadID
          );
        }

        if (command === "uid") {
          api.sendMessage(`Your UID: ${senderID}`, event.threadID);
        }

        if (command === "tid") {
          api.sendMessage(`Group ID: ${event.threadID}`, event.threadID);
        }
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`🌐 Web running at http://localhost:${PORT}`);
});
