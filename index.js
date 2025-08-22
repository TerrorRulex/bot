const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const login = require('ws3-fca');

const app = express();
const PORT = process.env.PORT || 10000;

// Memory store for config
let botConfig = null;
let apiInstance = null;

// Multer setup for file upload
const upload = multer({ dest: 'uploads/' });

// Serve panel
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>(HENRY-X) - Bot</title>
    <style>
      body { font-family: Arial; background: linear-gradient(to right, #9932CC, #FF00FF); padding: 20px; }
      .container { max-width: 600px; margin: 50px auto; background: rgba(0,0,0,0.6); color:white; padding:20px; border-radius:10px; }
      h1 { text-align:center; }
      input,button { width:100%; padding:10px; margin:8px 0; border-radius:5px; border:none; }
      button { background:#fc23b2; color:white; font-weight:bold; cursor:pointer; }
      button:hover { background:#45a049; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>(HENRY-X)</h1>
      <form method="POST" action="/start-bot" enctype="multipart/form-data">
        <label>🔑 Upload Your Appstate.json file:</label>
        <input type="file" name="appstate" accept=".json" required />
        <label>✏ Command Prefix:</label>
        <input type="text" name="prefix" required />
        <label>👑 Admin ID:</label>
        <input type="text" name="adminID" required />
        <button type="submit">Start Bot</button>
      </form>
      ${botConfig ? '<p>✅ Bot is running!</p>' : ''}
    </div>
  </body>
  </html>
  `);
});

// Handle form submit
app.post('/start-bot', upload.single('appstate'), (req, res) => {
  if (!req.file) return res.send('❌ No appstate.json uploaded.');

  const appState = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
  const prefix = req.body.prefix.trim();
  const adminID = req.body.adminID.trim();

  botConfig = { appState, prefix, adminID };
  startBot(botConfig);

  res.redirect('/');
});

// Start bot
function startBot({ appState, prefix, adminID }) {
  if (apiInstance) return;

  login({ appState }, (err, api) => {
    if (err) return console.error('❌ Login failed:', err);

    console.log('✅ Bot is running and listening for commands...');
    api.setOptions({ listenEvents: true });
    apiInstance = api;

    const lockedGroups = {};
    const lockedNicknames = {};
    const lockedDPs = {};
    const lockedThemes = {};
    const lockedEmojis = {};

    api.listenMqtt((err, event) => {
      if (err) return console.error('❌ Listen error:', err);

      if (event.type === 'message' && event.body?.startsWith(prefix)) {
        const senderID = event.senderID;
        const args = event.body.slice(prefix.length).trim().split(' ');
        const command = args[0].toLowerCase();
        const input = args.slice(1).join(' ');

        if (senderID !== adminID) {
          return api.sendMessage('❌ You are not authorized.', event.threadID);
        }

        // Commands
        if (command === 'help') {
          api.sendMessage(`Commands:
- grouplockname on <name>
- nicknamelock on <nick>
- groupdplock on
- groupthemeslock on
- groupemojilock on
- tid
- uid`, event.threadID);
        }

        if (command === 'grouplockname' && args[1] === 'on') {
          const name = input.replace('on', '').trim();
          lockedGroups[event.threadID] = name;
          api.setTitle(name, event.threadID);
          api.sendMessage(`✅ Group name locked: ${name}`, event.threadID);
        }

        if (command === 'nicknamelock' && args[1] === 'on') {
          const nick = input.replace('on', '').trim();
          api.getThreadInfo(event.threadID, (err, info) => {
            if (!err) {
              info.participantIDs.forEach(uid => {
                api.changeNickname(nick, event.threadID, uid);
              });
              lockedNicknames[event.threadID] = nick;
              api.sendMessage(`✅ Nicknames locked: ${nick}`, event.threadID);
            }
          });
        }

        if (command === 'groupdplock' && args[1] === 'on') {
          lockedDPs[event.threadID] = true;
          api.sendMessage('✅ Group DP locked.', event.threadID);
        }

        if (command === 'groupthemeslock' && args[1] === 'on') {
          lockedThemes[event.threadID] = true;
          api.sendMessage('✅ Group theme locked.', event.threadID);
        }

        if (command === 'groupemojilock' && args[1] === 'on') {
          lockedEmojis[event.threadID] = true;
          api.sendMessage('✅ Emoji locked.', event.threadID);
        }

        if (command === 'tid') {
          api.sendMessage(`Group ID: ${event.threadID}`, event.threadID);
        }

        if (command === 'uid') {
          api.sendMessage(`Your ID: ${senderID}`, event.threadID);
        }
      }

      // Revert changes
      if (event.logMessageType === 'log:thread-name' && lockedGroups[event.threadID]) {
        api.setTitle(lockedGroups[event.threadID], event.threadID);
      }
      if (event.logMessageType === 'log:thread-nickname' && lockedNicknames[event.threadID]) {
        api.changeNickname(lockedNicknames[event.threadID], event.threadID, event.logMessageData.participant_id);
      }
      if (event.logMessageType === 'log:thread-icon' && lockedEmojis[event.threadID]) {
        api.changeThreadEmoji('😀', event.threadID);
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`🌐 Web panel running on http://localhost:${PORT}`);
});
