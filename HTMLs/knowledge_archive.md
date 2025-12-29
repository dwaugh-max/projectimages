# Classroom Sim Architect: Knowledge Archive (v65.27 - synced with codebase)

This document contains the universal HTML/JS shells used by the Classroom Sim Architect.

### **TEMPLATE A: Code.gs (The Archive Brain)**
```javascript
const SHEET_ID = ""; const TEACHER_PIN = "8812";
 
function doGet(e) { 
  if (e.parameter.action === 'fetch_content') {
    const sheet = getContentSheet(); const data = sheet.getDataRange().getValues();
    const id = e.parameter.id || "default";
    for(let i=1; i<data.length; i++) { if(data[i][0] == id) return createJSON({ status: "success", data: JSON.parse(data[i][2]) }); }
    return createJSON({ status: "error", message: "Capsule not found" });
  }
  if (e.parameter.action === 'list_missions') {
    const data = getContentSheet().getDataRange().getValues();
    const missions = data.slice(1).map(r => {
      try {
        const payload = JSON.parse(r[2]);
        return { id: r[0], name: r[1], thumb: (payload.theme && payload.theme.splashHeroURL) ? payload.theme.splashHeroURL : "" };
      } catch(ex) { return null; }
    }).filter(m => m !== null);
    return createJSON({ status: "success", missions: missions });
  }
  return ContentService.createTextOutput("Archive Server Online."); 
}
 
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return createJSON({status:"error", message:"Busy"}); }
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === "fetch_user") {
       var sheet = getStudentSheet(); var rows = sheet.getDataRange().getValues();
       for(var i=1; i<rows.length; i++) { 
         if(rows[i][1].toString().toLowerCase() == data.name.toLowerCase()) {
           if(!rows[i][2]) { 
             sheet.getRange(i+1, 3).setValue(data.pin); sheet.getRange(i+1, 5).setValue(data.classCode || "DEFAULT");
             return createJSON({status: "success", id: rows[i][0], missions: JSON.parse(rows[i][3] || "{}") });
           }
           if(rows[i][2].toString() == data.pin.toString()) return createJSON({status: "success", id: rows[i][0], missions: JSON.parse(rows[i][3] || "{}") });
           return createJSON({status: "error", message: "PIN MISMATCH" });
         }
       }
       var newId = Utilities.getUuid(); sheet.appendRow([newId, data.name, data.pin, "{}", data.classCode || "DEFAULT"]);
       return createJSON({status: "success", id: newId, missions: {} });
    }
    if (data.action === "fetch_progress") {
      if(data.pin != TEACHER_PIN) return createJSON({status: "error", message: "Invalid PIN"});
      var sheet = getStudentSheet(); var rows = sheet.getDataRange().getValues();
      var progress = rows.slice(1).map(r => { 
        var mData = "{}"; try { mData = r[3] || "{}"; } catch(e){}
        return { id: r[0], name: r[1], missionData: JSON.parse(mData), class: r[4] || "UNASSIGNED" }; 
      });
      return createJSON({status: "success", progress: progress });
    }
    if (data.action === "save_state") {
       var sheet = getStudentSheet(); var rows = sheet.getDataRange().getValues();
       for(var i=1; i<rows.length; i++) { 
         if(rows[i][0] == data.id) {
           var mData = JSON.parse(rows[i][3] || "{}"); mData[data.missionId] = data.state;
           sheet.getRange(i+1, 4).setValue(JSON.stringify(mData)); return createJSON({status: "success"});
         }
       }
       return createJSON({status: "error", message: "User not found"});
    }
    if (data.action === "generate_ai_feedback") {
       if(data.pin != TEACHER_PIN) return createJSON({status: "error", message: "Invalid PIN"});
       const feedback = callGemini(data.rationales, data.context);
       return createJSON({status: "success", feedback: feedback});
    }
     if (data.action === "update_content") {
        if(data.pin != TEACHER_PIN) return createJSON({status: "error", message: "Invalid PIN"});
        var sheet = getContentSheet(); var rows = sheet.getDataRange().getValues(); var found = false;
        for(var i=1; i<rows.length; i++) { if(rows[i][0] == data.id) { sheet.getRange(i+1, 3).setValue(JSON.stringify(data.payload)); sheet.getRange(i+1, 2).setValue(data.name); found = true; break; } }
        if(!found) sheet.appendRow([data.id, data.name, JSON.stringify(data.payload)]);
        return createJSON({ status: "success" });
     }
     if (data.action === "delete_content") {
       if(data.pin != TEACHER_PIN) return createJSON({status: "error", message: "Invalid PIN"});
       var sheet = getContentSheet(); var rows = sheet.getDataRange().getValues();
       for(var i=1; i<rows.length; i++) { if(rows[i][0] == data.id) { sheet.deleteRow(i+1); return createJSON({ status: "success" }); } }
       return createJSON({ status: "error", message: "ID not found" });
     }
   } catch (err) { return createJSON({status:"error", message:err.toString()}); } finally { lock.releaseLock(); }
 }
 
function callGemini(rationales, context) {
  const API_KEY = "[[INJECT_GEMINI_KEY]]";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=" + API_KEY;
  const prompt = "You are a professional history educator evaluating a student's performance in a " + context.title + " simulation.\n  Student Rationales: " + JSON.stringify(rationales) + "\n  Evaluate on: 1. Historical Reasoning, 2. Perspective-Taking, 3. Strategic Thinking.\n  Provide a concise assessment (150 words). Format with markdown.";
  try {
    const res = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    return JSON.parse(res.getContentText()).candidates[0].content.parts[0].text;
  } catch(e) { return "AI Feedback failed: " + e.message; }
}

function getStudentSheet() { 
  var doc = SpreadsheetApp.getActiveSpreadsheet(); var sheet = doc.getSheetByName("Students"); 
  if (!sheet) { sheet = doc.insertSheet("Students"); sheet.appendRow(["ID","Name","PIN","MISSION_DATA","Class"]); } 
  return sheet; 
} 
 
function getContentSheet() {
  var doc = SpreadsheetApp.getActiveSpreadsheet(); var sheet = doc.getSheetByName("Content");
  if (!sheet) { sheet = doc.insertSheet("Content"); sheet.appendRow(["MissionID", "MissionName", "JSON_DATA"]); }
  return sheet;
}
function createJSON(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
```

### **TEMPLATE B: The Universal Carrier (Shell)**
```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>SITUATION ROOM</title>
    <script>const API_URL = "[[INJECT_URL_NOW]]";</script>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/tsparticles@2.11.1/tsparticles.bundle.min.js"></script>
    <style>
        :root {
            --bg: #0c0c0c;
            --accent: #d2b48c;
            --text: #e0e0e0;
            --card: #ffffff;
            --font-p: 'Georgia', serif;
            --font-h: 'Courier New', monospace;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            font-family: var(--font-h);
            background: var(--bg);
            color: var(--text);
            overflow-x: hidden;
        }

        .sidebar {
            width: 145px;
            min-width: 145px;
            background: #000;
            padding: 10px;
            display: flex;
            flex-direction: column;
            border-right: 1px solid #333;
        }

        .nav-container {
            flex: 1;
            overflow-y: auto;
            margin-top: 20px;
        }

        .nav-container::-webkit-scrollbar {
            width: 4px;
        }

        .nav-container::-webkit-scrollbar-thumb {
            background: var(--accent);
        }

        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #111;
            perspective: 1000px;
            padding: 20px;
            position: relative;
            min-height: 100vh;
            overflow-y: auto;
            scroll-behavior: smooth;
        }

        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.95);
            border-top: 1px solid #333;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            font-size: 0.6rem;
            color: #666;
            z-index: 100;
            pointer-events: none;
            backdrop-filter: blur(5px);
        }

        .mission-header {
            font-family: var(--font-h);
            color: #fff;
            font-size: 0.75rem;
            text-transform: uppercase;
            margin-bottom: 5px;
            border-left: 4px solid var(--accent);
            padding-left: 10px;
            line-height: 1.2;
            letter-spacing: 1px;
        }

        .card-container {
            width: 100%;
            max-width: 1100px;
            display: flex;
            flex-direction: column;
            margin: 0;
        }

        .card {
            background: transparent;
            display: none;
            flex-direction: column;
            animation: fadeIn 0.5s ease;
            width: 100%;
        }

        .card.active {
            display: flex;
        }

        /* SPLIT VIEW EXHIBIT */
        .exhibit-frame {
            display: flex;
            background: var(--card);
            color: #000;
            border-radius: 4px;
            min-height: 400px;
            max-height: 450px;
            overflow: hidden;
            border: 1px solid #999;
            box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
        }

        .exhibit-left {
            flex: 0.7;
            background: #000;
            position: relative;
            border-right: 1px solid #ddd;
        }

        .exhibit-left img,
        .exhibit-left iframe,
        .exhibit-left embed {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            border: 0;
        }

        .img-label {
            position: absolute;
            bottom: 15px;
            left: 15px;
            background: rgba(0, 0, 0, 0.8);
            color: var(--accent);
            padding: 6px 10px;
            font-size: 0.55rem;
            text-transform: uppercase;
            border: 1px solid var(--accent);
            letter-spacing: 1px;
            z-index: 10;
        }

        .exhibit-right {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #fff;
            overflow: hidden;
        }

        .tab-bar {
            display: flex;
            background: #f4f4f4;
            border-bottom: 1px solid #ddd;
        }

        .tab {
            flex: 1;
            padding: 10px;
            cursor: pointer;
            text-align: center;
            font-size: 0.6rem;
            border-right: 1px solid #ddd;
            color: #999;
            font-weight: bold;
            transition: 0.2s;
            letter-spacing: 1px;
        }

        .tab.active {
            background: #fff;
            color: #000;
            opacity: 1;
        }

        .tab:hover:not(.active) {
            background: #eee;
            color: #666;
        }

        .tab-content-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            line-height: 1.4;
            font-family: var(--font-p);
            text-align: justify;
            color: #333;
            font-size: 0.8rem;
        }

        .tab-content-scroll h2 {
            font-family: var(--font-h);
            font-size: 0.75rem;
            margin-top: 0;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 2px;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }

        /* INTERACTION AREA */
        .interaction-block {
            background: #222;
            color: #fff;
            border-top: 4px solid var(--accent);
            padding: 15px;
            margin-top: 10px;
            border-radius: 4px;
        }

        .interaction-prompt {
            font-style: italic;
            font-size: 0.85rem;
            color: var(--accent);
            margin-bottom: 10px;
            line-height: 1.4;
            border-left: 3px solid var(--accent);
            padding-left: 12px;
        }

        .btn {
            background: #333;
            color: #fff;
            border: 1px solid #555;
            padding: 10px;
            cursor: pointer;
            font-family: inherit;
            transition: 0.2s;
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .btn:hover {
            background: #444;
            border-color: var(--accent);
        }

        .btn.active {
            background: var(--accent) !important;
            color: #000 !important;
            font-weight: bold;
            border-color: var(--accent);
        }

        .btn.locked {
            opacity: 0.3;
            cursor: not-allowed;
        }

        .choice-row {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .choice-row .btn {
            flex: 1;
            text-align: center;
        }

        #tsparticles {
            position: fixed;
            inset: 0;
            z-index: -1;
            pointer-events: none;
        }

        /* SCROLLABLE SPLASH */
        #splash {
            position: fixed;
            inset: 0;
            background: #000;
            background-size: cover;
            background-position: center;
            z-index: 999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 100px 20px 100px 20px;
            overflow-y: auto;
        }

        #splash-overlay {
            position: fixed;
            inset: 0;
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.9));
            z-index: -1;
        }

        .splash-inner {
            width: 100%;
            max-width: 1200px;
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 10;
            position: relative;
        }

        .briefing-dossier {
            width: 100%;
            max-width: 400px;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #333;
            border-top: 5px solid var(--accent);
            padding: 30px;
            margin-top: 20px;
            max-height: 45vh;
            overflow-y: auto;
            scrollbar-width: thin;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 1);
            color: #eee;
            font-family: var(--font-p);
            line-height: 1.7;
            text-align: justify;
        }

        .briefing-dossier::-webkit-scrollbar {
            width: 4px;
        }

        .briefing-dossier::-webkit-scrollbar-thumb {
            background: var(--accent);
        }

        #ref-modal {
            display: none;
            flex-direction: column;
            align-items: center;
            width: 100%;
        }

        #mission-title-big {
            font-size: 2.5rem;
            text-transform: uppercase;
            letter-spacing: 5px;
            font-weight: bold;
            color: #fff;
            text-shadow: 0 0 40px rgba(0, 0, 0, 0.9);
            margin-bottom: 20px;
            text-align: center;
            line-height: 1.2;
            max-width: 800px;
        }

        #ref-title {
            color: var(--accent);
            font-size: 1rem;
            text-transform: uppercase;
            letter-spacing: 4px;
            margin-bottom: 30px;
            opacity: 0.9;
            font-weight: bold;
        }

        #ref-q {
            margin: 20px 0;
            font-size: 1.1rem;
            color: var(--accent);
            font-weight: bold;
        }

        textarea {
            background: #111;
            color: #fff;
            border: 1px solid #444;
            padding: 15px;
            width: 100%;
            font-family: inherit;
            margin-bottom: 10px;
            box-sizing: border-box;
            outline: none;
            font-size: 0.9rem;
            height: 80px;
            line-height: 1.5;
        }

        .word-count {
            font-size: 0.6rem;
            color: #666;
            text-align: right;
            margin-top: -5px;
            margin-bottom: 15px;
        }

        .mission-item {
            display: flex;
            align-items: center;
            background: #111;
            border: 1px solid #333;
            padding: 15px;
            margin-bottom: 10px;
            cursor: pointer;
            width: 100%;
            box-sizing: border-box;
            transition: 0.2s;
        }

        .mission-item:hover {
            border-color: var(--accent);
            background: #1a1a1a;
        }

        .mission-thumb {
            width: 52px;
            height: 52px;
            border-radius: 4px;
            background-size: cover;
            background-position: center;
            border: 1px solid #333;
            margin-right: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        }

        .mission-item:hover .mission-thumb {
            border-color: var(--accent);
        }

        #glossary-panel {
            display: none;
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            max-height: 85vh;
            background: #000;
            border: 1px solid var(--accent);
            z-index: 9999;
            padding: 25px;
            overflow-y: auto;
            box-shadow: 0 0 30px rgba(0, 0, 0, 1);
        }

        .glossary-term {
            color: var(--accent);
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
            text-transform: uppercase;
            font-size: 0.8rem;
        }

        .glossary-def {
            font-family: var(--font-p);
            font-size: 0.9rem;
            color: #ccc;
            display: block;
            margin-bottom: 15px;
            line-height: 1.4;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .watermark {
            position: fixed;
            bottom: 40px;
            left: 20px;
            font-size: 0.5rem;
            color: var(--accent);
            opacity: 0.3;
            letter-spacing: 2px;
            z-index: 100;
            pointer-events: none;
        }
    </style>
</head>

<body>
    <div class="watermark">SECURE CONNECTION // ENCRYPTED LINK Active</div>
    <div id="tsparticles"></div>
    <div id="loading-screen"
        style="position:fixed; inset:0; background:#000; display:none; flex-direction:column; align-items:center; justify-content:center; color:var(--accent); z-index:1001; font-weight:bold; letter-spacing:5px;">
        SYNCHRONIZING ARCHIVES...</div>

    <div id="glossary-panel">
        <div
            style="display:flex; justify-content:space-between; margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:10px;">
            <span style="color:var(--accent); font-size:0.9rem; font-weight:bold; letter-spacing:2px;">INTELLIGENCE
                GLOSSARY</span>
            <span onclick="toggleGlossary()" style="cursor:pointer; opacity:0.5;">[CLOSE]</span>
        </div>
        <div id="glossary-content"></div>
    </div>

    <div id="splash">
        <div id="splash-overlay"></div>
        <div class="splash-inner">
            <div id="login-step" style="width:380px; text-align:center;">
                <h1 style="color:var(--accent); letter-spacing:8px; font-size:2.2rem; margin-bottom:40px;">SITUATION
                    ROOM</h1>
                <p
                    style="font-size:0.7rem; opacity:0.5; margin-bottom:30px; text-transform:uppercase; letter-spacing:2px;">
                    Credential Verification Required</p>
                <input id="username" placeholder="NAME / CODENAME"><input id="pin" type="password"
                    placeholder="ACCESS PIN">
                <input id="class-code" placeholder="CLASS CODE (e.g. PER-01)">
                <button class="btn"
                    style="text-align:center; background:var(--accent); color:#000; font-weight:bold; width:100%; margin-top:20px;"
                    onclick="login()">AUTHORIZE ACCESS</button>
            </div>

            <div id="lobby-step" style="width:420px; display:none; text-align:left;">
                <h3
                    style="color:var(--accent); letter-spacing:3px; border-bottom:1px solid #333; padding-bottom:10px; margin-bottom:20px;">
                    ACTIVE DOSSIERS</h3>
                <div id="mission-list"></div>
                <div style="margin-top:30px; padding:25px; background:rgba(0,0,0,0.5); border:1px solid #333;">
                    <p
                        style="font-size:0.6rem; color:#666; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px; text-align:center;">
                        Manual Capsule Injection</p>
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <input id="mission-code" placeholder="MISSION CODE"
                            style="flex:1; text-align:center; letter-spacing:5px; margin:0;">
                        <button class="btn" style="background:#fff; color:#000; width:auto; padding:0 20px;"
                            onclick="joinMission()">JOIN</button>
                    </div>
                    <div style="border:1px dashed #444; padding:10px; text-align:center; cursor:pointer;"
                        onclick="document.getElementById('blob-input').click()">
                        <span style="font-size:0.7rem; color:#888;">OR DROP .BLOB FILE HERE</span>
                        <input type="file" id="blob-input" accept=".blob" style="display:none"
                            onchange="ingest(this.files[0])">
                    </div>
                </div>
            </div>

            <div id="ref-modal">
                <div id="mission-title-big">MISSION_ID</div>
                <div id="ref-title">MISSION BRIEFING</div>
                <div class="briefing-dossier">
                    <div id="debrief-panel"
                        style="display:none; background:#000; padding:20px; border-left:4px solid var(--accent); margin-bottom:20px; font-size:0.8rem;">
                    </div>
                    <div id="ref-narrative"></div>
                    <div id="ref-q" style="margin-top:20px; border-top:1px solid #333; padding-top:20px;"></div>
                    <textarea id="ref-a" style="margin-top:10px;"></textarea>
                    <div id="ref-wc" class="word-count"></div>
                </div>
                <button id="ref-btn" class="btn"
                    style="background:var(--accent); color:#000; text-align:center; width:100%; max-width:400px; font-weight:bold; margin-top:30px; padding:20px; box-shadow:0 0 30px rgba(0,0,0,0.5);"
                    onclick="nextRef()">CONFIRM AND LAUNCH</button>
            </div>
        </div>
    </div>

    <nav class="sidebar">
        <div id="m-header" class="mission-header">ARCHIVE LOG</div>
        <div id="p-tracker"
            style="font-size:0.6rem; opacity:0.7; color:var(--accent); letter-spacing:1px; margin-bottom:20px;">0/18
            EVIDENCE POINTS</div>
        <div id="nav-container" class="nav-container"></div>
        <button class="btn" onclick="toggleGlossary()"
            style="margin-top:20px; border-color:var(--accent); font-size:0.7rem; text-align:center; background:transparent;">OPEN
            INTELLIGENCE GLOSSARY</button>
    </nav>
    <main class="main">
        <div id="card-container" class="card-container"></div>
    </main>
    <footer class="footer">
        <div id="f-left" style="cursor:pointer; pointer-events:auto;" onclick="showVersionInfo()">SITUATION ROOM
            PROTOCOL | v65.27</div>
        <div id="f-outcomes-btn" style="cursor:pointer; pointer-events:auto; color:var(--accent); opacity:0.7;"
            onclick="toggleOutcomes()">[VIEW OUTCOMES]</div>
        <div id="f-right" style="pointer-events:auto;">OPEN-SOURCE LICENSE</div>
    </footer>

    <!-- OUTCOMES PANEL -->
    <div id="outcomes-panel"
        style="display:none; position:fixed; bottom:50px; left:50%; transform:translateX(-50%); width:90%; max-width:600px; max-height:40vh; overflow-y:auto; background:rgba(0,0,0,0.95); border:1px solid var(--accent); padding:20px; z-index:999;">
        <div
            style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
            <span id="outcomes-title"
                style="color:var(--accent); font-size:0.8rem; font-weight:bold; letter-spacing:2px;">LEARNING
                OUTCOMES</span>
            <span onclick="toggleOutcomes()" style="cursor:pointer; opacity:0.5;">[CLOSE]</span>
        </div>
        <div id="outcomes-content" style="font-size:0.85rem; color:#ccc; line-height:1.6;"></div>
    </div>

    <!-- VERSION INFO PANEL -->
    <div id="version-panel"
        style="display:none; position:fixed; bottom:50px; left:20px; width:300px; background:rgba(0,0,0,0.95); border:1px solid var(--accent); padding:20px; z-index:999;">
        <div
            style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
            <span style="color:var(--accent); font-size:0.8rem; font-weight:bold; letter-spacing:2px;">VERSION
                INFO</span>
            <span onclick="toggleVersionPanel()" style="cursor:pointer; opacity:0.5;">[CLOSE]</span>
        </div>
        <div id="version-content" style="font-size:0.75rem; color:#ccc; line-height:1.8;"></div>
    </div>

    <!-- HISTORICAL REVEAL PANEL -->
    <div id="historical-panel"
        style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:700px; background:rgba(0,0,0,0.98); border:2px solid var(--accent); padding:30px; z-index:2000; box-shadow: 0 0 50px rgba(0,0,0,0.8);">
        <div
            style="color:var(--accent); font-size:1rem; font-weight:bold; letter-spacing:3px; margin-bottom:20px; text-align:center; text-transform:uppercase;">
            Historical Outcome
        </div>
        <div id="historical-content"
            style="font-size:1rem; color:#eee; line-height:1.6; margin-bottom:30px; font-family:var(--font-p);"></div>
        <div style="text-align:center;">
            <button class="btn" onclick="toggleHistoricalPanel(false)"
                style="background:var(--accent); color:#000; font-weight:bold; padding:10px 30px;">PROCEED</button>
        </div>
    </div>

    <script>
        window.DATA = null; let user = { id: null, name: null, pin: null, missions: {} };
        let currentMission = null; let refMode = "pre"; let refIdx = 0; let missionsAvailable = [];
        let currentLayout = null;

        // LAYOUT PRESETS LIBRARY
        const LAYOUTS = {
            classic: {
                sidebarWidth: "200px",
                sidebarPadding: "15px",
                imageFlex: 1.1,
                textFlex: 1,
                textFontSize: "0.9rem",
                textPadding: "20px",
                textLineHeight: "1.5"
            },
            compact: {
                sidebarWidth: "145px",
                sidebarPadding: "10px",
                imageFlex: 0.7,
                textFlex: 1,
                textFontSize: "0.8rem",
                textPadding: "15px",
                textLineHeight: "1.4"
            },
            immersive: {
                sidebarWidth: "120px",
                sidebarPadding: "8px",
                imageFlex: 1.3,
                textFlex: 1,
                textFontSize: "0.85rem",
                textPadding: "18px",
                textLineHeight: "1.45"
            }
        };

        async function login() {
            const name = document.getElementById('username').value.trim();
            const pin = document.getElementById('pin').value.trim();
            const classCode = document.getElementById('class-code').value.trim().toUpperCase();

            if (!name || !pin || !classCode) return alert("CORRUPT PACKET: ALL CREDENTIALS (NAME, PIN, CLASS CODE) REQUIRED.");
            if (name.includes(" ")) return alert("SECURITY PROTOCOL: SPACES NOT PERMITTED IN CODENAMES.");
            if (pin.length < 4) return alert("SECURITY PROTOCOL: PIN MUST BE 4+ CHARACTERS.");

            document.getElementById('loading-screen').style.display = 'flex';

            // Clean name client side too
            const cleanName = name.replace(/\s+/g, '');

            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'fetch_user', name: cleanName, pin: pin, classCode: classCode }) });
            const j = await res.json();
            if (j.status === "success") {
                user = { id: j.id, name: cleanName, pin: pin, missions: j.missions, class: classCode };
                const mRes = await fetch(API_URL + "?action=list_missions");
                const mData = await mRes.json(); missionsAvailable = mData.missions;
                showLobby();
            } else alert(j.message);
            document.getElementById('loading-screen').style.display = 'none';
        }

        function showLobby() {
            document.getElementById('login-step').style.display = 'none'; document.getElementById('lobby-step').style.display = 'block';
            let h = "";
            missionsAvailable.forEach(m => {
                const thumb = m.thumb || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop";
                h += `<div class="mission-item" onclick="launch('${m.id}')">
                    <div class="mission-thumb" style="background-image:url('${thumb}')"></div>
                    <div><strong style="color:var(--accent);">${m.name}</strong><br><span style="font-size:0.6rem; color:#666;">AUTHORIZATION ID: ${m.id}</span></div>
                </div>`;
            });
            document.getElementById('mission-list').innerHTML = h || "<p style='color:#444; font-size:0.7rem;'>No dossiers found.</p>";
        }

        async function joinMission() { const code = document.getElementById('mission-code').value.trim().toUpperCase(); if (code) launch(code); }

        function ingest(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const j = JSON.parse(e.target.result);
                    processData(j);
                } catch (ex) { alert("INVALID CAPSULE DATA."); }
            };
            reader.readAsText(file);
        }

        function processData(j, idOverride) {
            let data = j.data || j; // Handle wrapped or raw
            // SCHEMA NORMALIZER v60.5
            if (!data.metadata && data.meta) data.metadata = data.meta;
            if (!data.metadata) data.metadata = {};
            if (!data.metadata.id && idOverride) data.metadata.id = idOverride;
            if (!data.metadata.id && data.missionId) data.metadata.id = data.missionId;

            if (data.exhibits && !data.slides) data.slides = data.exhibits;
            if (!data.reflections) data.reflections = { pre: [], post: [], pre_narrative: "MISSION BRIEFING DATA UNAVAILABLE.", post_narrative: "MISSION DEBRIEF DATA UNAVAILABLE." };

            if (!data.theme) data.theme = {};
            if (data.theme.primaryColor && !data.theme.accent) data.theme.accent = data.theme.primaryColor;
            if (!data.theme.accent) data.theme.accent = "#00ffcc";
            if (data.theme.font && !data.theme.fontH) data.theme.fontH = data.theme.font;
            if (!data.theme.fontP) data.theme.fontP = "Georgia, serif";
            if (!data.theme.fontH) data.theme.fontH = "Courier New, monospace";

            if (data.slides) {
                data.slides.forEach(s => {
                    if (!s.shortTitle && s.title) s.shortTitle = s.title;
                    if (!s.longTitle && s.shortTitle) s.longTitle = s.shortTitle;

                    // Normalize Tabs (Array OR Object)
                    let tRaw = s.tabs;
                    if (tRaw && !Array.isArray(tRaw)) {
                        // Convert Object to Normalized Object with 'body'
                        const newTabs = {};
                        Object.keys(tRaw).forEach(k => {
                            const t = tRaw[k];
                            // FIX v65.6: Consolidate all media keys (video, videoURL, media) into mediaURL so they aren't lost
                            newTabs[k.toLowerCase()] = {
                                body: t.content || t.body || "",
                                image: t.imageURL || t.image || "",
                                credit: t.credit || 'FIELD RECORD',
                                mediaType: t.mediaType,
                                mediaURL: t.mediaURL || t.media_url || t.videoURL || t.video || t.media || ""
                            };
                        });
                        s.tabs = newTabs;
                    } else if (Array.isArray(tRaw)) {
                        const newTabs = {};
                        tRaw.forEach((t, idx) => {
                            const labels = ['primary', 'legal', 'intel'];
                            const key = t.label ? t.label.split(":")[0].trim().toLowerCase() : labels[idx] || `tab_${idx}`;
                            newTabs[key] = {
                                body: t.content || t.body || "",
                                image: t.imageURL || t.image || "",
                                credit: t.credit || 'FIELD RECORD',
                                mediaType: t.mediaType,
                                mediaURL: t.mediaURL || t.media_url || t.videoURL || t.video || t.media || ""
                            };
                        });
                        s.tabs = newTabs;
                    }
                });
            }

            window.DATA = data;
            currentMission = data.metadata.id || idOverride || "LOCAL_INJECT";
            user.state = user.missions[currentMission] || { last: 0, ans: {}, dec: {}, rat: {} };
            applyTheme(); initParticles(); renderGlossary();
            if (!user.state.preDone) startRef("pre"); else { document.getElementById('splash').style.display = 'none'; init(); }
        }

        async function launch(id) {
            document.getElementById('loading-screen').style.display = 'flex';
            try {
                const r = await fetch(API_URL + "?action=fetch_content&id=" + id); const j = await r.json();
                if (j.status === "error") throw new Error(j.message);
                processData(j, id);
                document.getElementById('loading-screen').style.display = 'none';
            } catch (e) { console.error(e); alert(e.message); document.getElementById('loading-screen').style.display = 'none'; }
        }

        function applyTheme() {
            const t = window.DATA.theme; document.documentElement.style.setProperty('--accent', t.accent);
            document.documentElement.style.setProperty('--font-p', t.fontP); document.documentElement.style.setProperty('--font-h', t.fontH);
            if (t.splashHeroURL) {
                const s = document.getElementById('splash'); s.style.backgroundImage = `url('${t.splashHeroURL}')`;
                s.style.backgroundSize = "cover"; s.style.backgroundPosition = "center";
            }
            const m = window.DATA.metadata || {};
            document.getElementById('m-header').innerText = m.title || "ARCHIVE LOG";
            document.getElementById('f-left').innerHTML = `${m.title || currentMission} | SITUATION ROOM PROTOCOL v65.27`;

            // Populate the outcomes panel (popup) instead of inline text
            populateOutcomes();

            // APPLY LAYOUT PRESET
            const layoutName = (t.layout || "compact").toLowerCase();
            currentLayout = LAYOUTS[layoutName] || LAYOUTS.compact;
            console.log("[LAYOUT] Applying preset: " + layoutName);

            // Apply sidebar settings
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.width = currentLayout.sidebarWidth;
                sidebar.style.minWidth = currentLayout.sidebarWidth;
                sidebar.style.padding = currentLayout.sidebarPadding;
            }
        }

        function renderGlossary() {
            const g = window.DATA.intelligenceGlossary || window.DATA.glossary || [];
            let h = "";
            const defaultTerms = [
                { term: "SIGINT", definition: "Signals Intelligence; information derived from electronic signals and systems." },
                { term: "HUMINT", definition: "Human Intelligence; information collected from human sources." },
                { term: "SITREP", definition: "Situation Report; a concise update on the current status of an operation." }
            ];
            const finalG = g.length > 0 ? g : defaultTerms;
            finalG.forEach(it => { h += `<div class="glossary-item"><span class="glossary-term">${it.term}</span><span class="glossary-def">${it.definition}</span></div>`; });
            document.getElementById('glossary-content').innerHTML = h;
        }
        function toggleGlossary() { const p = document.getElementById('glossary-panel'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; }

        // OUTCOMES PANEL
        function toggleOutcomes() {
            const p = document.getElementById('outcomes-panel');
            p.style.display = p.style.display === 'block' ? 'none' : 'block';
        }
        function populateOutcomes() {
            const m = window.DATA.metadata || {};
            const outcomes = m.learningOutcomes || m.outcomes || [];
            const title = m.title || 'MISSION';
            document.getElementById('outcomes-title').innerText = title.toUpperCase() + ' OUTCOMES';
            let h = '';
            if (outcomes.length > 0) {
                outcomes.forEach((o, i) => { h += `<div style="margin-bottom:10px; padding-left:15px; border-left:2px solid var(--accent);">${i + 1}. ${o}</div>`; });
            } else {
                h = '<div style="opacity:0.5;">No learning outcomes defined for this mission.</div>';
            }
            document.getElementById('outcomes-content').innerHTML = h;
        }

        // VERSION INFO PANEL
        function toggleVersionPanel() {
            const p = document.getElementById('version-panel');
            p.style.display = p.style.display === 'block' ? 'none' : 'block';
        }
        function showVersionInfo() {
            const m = window.DATA ? window.DATA.metadata : {};
            const blobVersion = m.version || 'Unknown';
            const blobAuthor = m.author || 'Unknown';
            const simVersion = 'v65.27';
            let h = `
                <div><strong style="color:var(--accent);">SIM ENGINE:</strong> ${simVersion}</div>
                <div><strong style="color:var(--accent);">CAPSULE VERSION:</strong> ${blobVersion}</div>
                <div><strong style="color:var(--accent);">CAPSULE AUTHOR:</strong> ${blobAuthor}</div>
                <div style="margin-top:10px; opacity:0.5; font-size:0.65rem;">code.gs: Managed by Classroom Sim Architect</div>
                <button class="btn" style="background:#400; color:#fff; border-color:#800; margin-top:15px; width:100%; font-size: 0.65rem;" onclick="resetAICache()">RESET AI CACHE</button>
            `;
            document.getElementById('version-content').innerHTML = h;
            toggleVersionPanel();
        }


        function startRef(m) { refMode = m; refIdx = 0; document.getElementById('splash').style.display = 'flex'; document.getElementById('lobby-step').style.display = 'none'; document.getElementById('ref-modal').style.display = 'flex'; renderRef(); }
        function renderRef() {
            if (refMode === 'epilogue') { renderEpilogue(); return; }
            const qs = window.DATA.reflections[refMode] || [];
            const narrative = window.DATA.reflections[refMode + "_narrative"] || "NO BRIEFING DATA RECORDED.";
            const mTitle = (window.DATA.metadata && window.DATA.metadata.title) ? window.DATA.metadata.title : currentMission;

            document.getElementById('ref-title').innerText = refMode === 'pre' ? 'INITIAL BRIEFING' : 'MISSION DEBRIEF';
            document.getElementById('mission-title-big').innerText = mTitle;

            if (refMode === 'pre') {
                document.getElementById('ref-q').style.display = 'none';
                document.getElementById('ref-a').style.display = 'none';
                document.getElementById('ref-btn').innerText = 'INITIALIZE MISSION';
            } else {
                document.getElementById('ref-q').style.display = 'block';
                document.getElementById('ref-a').style.display = 'block';
                document.getElementById('ref-btn').innerText = 'SUBMIT TO RECORD';
            }

            document.getElementById('ref-narrative').innerHTML = parseMD(narrative);
            if (refMode === 'post' && refIdx === 0) renderDebrief(); else document.getElementById('debrief-panel').style.display = 'none';

            if (qs.length > 0 && qs[refIdx]) {
                document.getElementById('ref-q').innerText = qs[refIdx];
                document.getElementById('ref-q').style.display = 'block';
            } else if (refMode === 'pre') {
                document.getElementById('ref-q').style.display = 'none';
            } else {
                document.getElementById('ref-q').innerText = "END OF LOG. No further questions required.";
                document.getElementById('ref-a').style.display = 'none';
            }
            document.getElementById('ref-a').value = (user.state.ans && user.state.ans[refMode + "_" + refIdx]) || "";
        }

        function renderEpilogue() {
            const epi = window.DATA.epilogue || {};
            const whatIfs = epi.whatIf || [];
            document.getElementById('ref-title').innerText = 'HISTORICAL COUNTERFACTUALS';
            document.getElementById('ref-q').style.display = 'none';
            document.getElementById('ref-a').style.display = 'none';
            document.getElementById('debrief-panel').style.display = 'none';
            document.getElementById('ref-btn').innerText = 'FINALIZE MISSION';

            let h = `<div style="margin-bottom:20px; opacity:0.8; font-style:italic; font-size:0.9rem;">Historical outcomes are often balanced on a knife-edge. Review these counterfactual assessments based on divergent decisions:</div>`;
            whatIfs.forEach(wi => {
                h += `<div style="background:rgba(210,180,140,0.05); border:1px solid rgba(210,180,140,0.1); padding:20px; margin-bottom:15px; border-radius:4px;">
                        <h4 style="color:var(--accent); margin-top:0; font-size:0.7rem; letter-spacing:1px; text-transform:uppercase;">${wi.scenario}</h4>
                        <div style="font-family:var(--font-p); font-size:0.95rem; line-height:1.5; opacity:0.9;">${parseMD(wi.outcome)}</div>
                      </div>`;
            });
            document.getElementById('ref-narrative').innerHTML = h;
        }

        async function renderDebrief() {
            const d = document.getElementById('debrief-panel'); d.style.display = 'block';
            let h = `<h3 style="color:var(--accent); margin-top:0; font-size:0.7rem; letter-spacing:2px;">INTERNAL LOG SUMMARY</h3>`;
            window.DATA.slides.forEach((s, i) => { h += `<div style="margin-bottom:8px; border-bottom:1px solid #111; padding-bottom:5px;"><strong>${i + 1}</strong>: ${user.state.dec[i] || 'PENDING'}</div>`; });

            // Failsafe Content (Static Fallback)
            const staticContent = (window.DATA.epilogue && window.DATA.epilogue.staticDebrief)
                ? window.DATA.epilogue.staticDebrief
                : "Mission analysis complete. Review your command log above.";

            // AI Feedback Logic
            // CHECK 1: Is AI enabled by the teacher? (Default: FALSE)
            // CHECK 2: Has it already been requested? (One-shot limit)
            const aiEnabled = window.DATA.metadata && window.DATA.metadata.enableAIFeedback;

            // PURGE STALE SIMULATION DATA: If we are on HTTPS but have an old offline simulation string, clear it to force a fresh fetch
            if (user.state.aiFeedback && user.state.aiFeedback.toUpperCase().includes("OFFLINE") && location.protocol !== 'file:') {
                console.warn("Aggressive Purge: Clearing stale AI data from HTTPS session.");
                user.state.aiFeedback = null;
                user.state.aiRequested = false;
                save(); // Force backend sync to clear the 'bad' data
            }

            if (user.state.aiFeedback) {
                h += `<div style="margin-top:20px; border-top:2px solid var(--accent); padding-top:20px;">
                        <h3 style="color:var(--accent); margin-top:0; font-size:0.7rem; letter-spacing:2px;">AI COMMAND ANALYSIS</h3>
                        <div style="font-family:var(--font-p); font-size:0.95rem; line-height:1.6; color:#99ff99; opacity:0.9;">${parseMD(user.state.aiFeedback)}</div>
                      </div>`;
            } else if (aiEnabled) {
                // If AI is enabled but not yet present, show loading state and attempt fetch
                h += `<div id="ai-container" style="margin-top:20px; border-top:1px solid #333; padding-top:20px; opacity:0.8; font-size:0.85rem;">
                        <div id="ai-status" style="text-align:center; color:var(--accent); animation: blink 1s infinite;">ENCRYPTING TRANSMISSION TO ANALYST...</div>
                      </div>`;

                // Attempt to fetch AI feedback via Vercel Proxy
                // Rate limited & Failsafe protected
                if (!user.state.aiRequested) {
                    user.state.aiRequested = true; // prevent double-tap
                    try {
                        const rationales = window.DATA.reflections['pre'].map((q, i) => ({ question: q, answer: user.state.ans['pre_' + i] }));
                        const postQs = window.DATA.reflections['post'] || [];
                        postQs.forEach((q, i) => { rationales.push({ question: q, answer: user.state.ans['post_' + i] }); });

                        // FIX: Ensure rationales is never empty
                        if (rationales.length === 0) rationales.push({ question: "General Performance", answer: "Student provided no specific text rationales." });

                        // LIVE CHECK: Ping Archive to see if AI is currently enabled for this mission
                        // DISABLED FOR LOCAL TESTING
                        // const statusRes = await fetch(URL, { method: 'POST', body: JSON.stringify({ action: 'check_ai_status', id: window.DATA.metadata.id }) });
                        // const statusJson = await statusRes.json();
                        // if (!statusJson.enabled) throw new Error("AI Disabled by Teacher (Live Override)");

                        // Construct Prompt
                        const fullPrompt = `You are a professional history educator evaluating a student's performance in a ${window.DATA.metadata.title} simulation.
Student Rationales: ${JSON.stringify(rationales)}
Evaluate on: 1. Historical Reasoning, 2. Perspective-Taking, 3. Strategic Thinking.
Provide a concise assessment (150 words). Format with markdown.`;

                        // Call Vercel Proxy (Direct User Endpoint)
                        const TARGET_URL = 'https://nextjs-basic-lemon-one.vercel.app/api/chat';
                        let res;
                        try {
                            // ATTEMPT 1: Direct Connection
                            res = await fetch(TARGET_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ message: fullPrompt })
                            });
                        } catch (directErr) {
                            console.log("Direct AI Connection Failed (likely CORS). Attempting Proxy...");
                            // ATTEMPT 2: CORS Proxy (Bypass Browser Security)
                            try {
                                res = await fetch('https://corsproxy.io/?' + encodeURIComponent(TARGET_URL), {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ message: fullPrompt })
                                });
                            } catch (proxyErr) {
                                throw new Error(`Connection Failed: ${directErr.message} / Proxy: ${proxyErr.message}`);
                            }
                        }

                        const data = await res.json();

                        // Handle OpenRouter / Proxy response structure
                        const reply = data.choices ? (data.choices[0]?.message?.content) : data.reply;

                        if (reply) {
                            user.state.aiFeedback = reply;
                            save();
                            renderDebrief(); // Re-render with feedback
                        } else {
                            // LOG DEBUG INFO
                            console.warn("AI Structure Error:", data);
                            throw new Error("No feedback returned (Invalid structure). See log.");
                        }
                    } catch (err) {
                        console.log("AI Service Unavailable.", err);

                        // LOCAL DEV BYPASS: Only trigger if running from a local file (file:///)
                        if (location.protocol === 'file:' && err.message.includes("Failed to fetch")) {
                            user.state.aiFeedback = "***[OFFLINE SIMULATION]***\n\n" + staticContent + "\n\n*(Note: Live AI unavailable in local file mode.)*";
                            user.state.aiRequested = true;
                            save();
                            renderDebrief();
                            return;
                        }

                        // Real Failure (Server Down / CORS / Structure Error)
                        user.state.aiRequested = false;
                        save();

                        h += `<div style="margin-top:20px; border-top:1px solid #333; padding-top:20px;">
                                <h3 style="color:var(--accent); margin-top:0; font-size:0.7rem; letter-spacing:2px;">COMMAND DEBRIEF (SYSTEM OFFLINE)</h3>
                                <div style="font-family:var(--font-p); font-size:0.95rem; line-height:1.6; opacity:0.9;">${parseMD(staticContent)}</div>
                              </div>
                              
                              <div style="background:#200; padding:15px; font-family:monospace; font-size:0.7rem; color:#ff9999; margin-top:20px; border:1px solid #500; border-radius:4px;">
                                <div style="margin-bottom:5px; border-bottom:1px solid #500; padding-bottom:5px; font-weight:bold;">NETWORK_DEBUG_LOG</div>
                                <strong>ERROR:</strong> ${err.message}<br>
                                <strong>TARGET:</strong> https://nextjs-basic-lemon-one.vercel.app/api/chat<br>
                                <strong>PROTOCOL:</strong> ${location.protocol}<br>
                                <strong>VER:</strong> v65.27<br>
                                <strong>STEPS:</strong> 1. Direct fetch failed. 2. Proxy fetch failed (or internal error).
                              </div>`;
                    }
                }
            } else {
                // AI DISABLED: Show Static Debrief immediately
                h += `<div style="margin-top:20px; border-top:1px solid #333; padding-top:20px;">
                        <h3 style="color:var(--accent); margin-top:0; font-size:0.7rem; letter-spacing:2px;">COMMAND DEBRIEF</h3>
                        <div style="font-family:var(--font-p); font-size:0.95rem; line-height:1.6; opacity:0.9;">${parseMD(staticContent)}</div>
                      </div>`;
            }
            d.innerHTML = h;
        }

        async function nextRef() {
            if (refMode === 'post') {
                const qs = window.DATA.reflections[refMode] || [];
                const a = document.getElementById('ref-a').value;
                if (qs.length > 0 && refIdx < qs.length) {
                    if (!a) return alert("Response required.");
                    user.state.ans[refMode + "_" + refIdx] = a;
                }
                refIdx++;
                if (refIdx < qs.length) { renderRef(); save(); }
                else if (window.DATA.epilogue && window.DATA.epilogue.whatIf && window.DATA.epilogue.whatIf.length > 0) { startRef('epilogue'); }
                else { alert("Log finalized."); document.getElementById('ref-modal').style.display = 'none'; document.getElementById('lobby-step').style.display = 'block'; save(); }
            } else if (refMode === 'epilogue') {
                alert("Mission Complete. Log Archived.");
                document.getElementById('ref-modal').style.display = 'none'; document.getElementById('lobby-step').style.display = 'block';
            } else {
                user.state.preDone = true; document.getElementById('splash').style.display = 'none'; save(); init();
            }
        }

        function init() {
            if (!window.DATA || !window.DATA.slides) {
                document.getElementById('card-container').innerHTML = "<div style='padding:50px; text-align:center; color:var(--accent); letter-spacing:2px;'>[ERROR] MISSION DATA CORRUPTED OR INCOMPATIBLE.</div>";
                return;
            }
            renderNav(); updateProgress();
            let idx = user.state.last || 0;
            go(idx);
        }
        function updateProgress() {
            if (!window.DATA || !window.DATA.slides) return;
            let filed = 0; window.DATA.slides.forEach((_, i) => { if (user.state.dec[i]) filed++; });
            document.getElementById('p-tracker').innerText = `${filed}/${window.DATA.slides.length} EVIDENCE POINTS FILED`;
        }
        function renderNav() {
            const c = document.getElementById('nav-container'); c.innerHTML = "";
            if (!window.DATA || !window.DATA.slides) return;
            window.DATA.slides.forEach((s, i) => {
                const isLocked = i > 0 && (!user.state.dec || !user.state.dec[i - 1]);
                const b = document.createElement('button');
                b.className = "btn" + (isLocked ? " locked" : "");
                b.style.marginBottom = "8px"; b.style.width = "100%"; b.style.textAlign = "left"; b.style.padding = "10px"; b.style.fontSize = "0.65rem";
                if (user.state.dec && user.state.dec[i]) b.style.borderLeft = "4px solid var(--accent)";
                b.innerHTML = `<span style="color:#fff; font-size:0.9em; text-transform:uppercase; letter-spacing:1px;">EXHIBIT 0${i + 1}</span><br><span style="white-space: normal; line-height: 1.2; display: block; margin-top: 3px; font-size: 0.7rem;">${s.shortTitle || 'UNTITLED'}</span>`;
                if (!isLocked) b.onclick = () => go(i); c.appendChild(b); b.id = `btn-${i}`;
            });
        }

        function go(i) {
            if (!window.DATA || !window.DATA.slides || !window.DATA.slides[i]) return;
            const s = window.DATA.slides[i]; user.state.last = i; updateProgress();
            document.querySelectorAll('.sidebar .btn').forEach(b => b.classList.remove('active'));
            if (document.getElementById(`btn-${i}`)) document.getElementById(`btn-${i}`).classList.add('active');

            document.getElementById('card-container').innerHTML = `
                <div class="card active">
                    <div class="exhibit-frame">
                        <div id="exhibit-left" class="exhibit-left"></div>
                        <div id="exhibit-right" class="exhibit-right">
                            <div class="tab-bar">
                                <div class="tab active" onclick="tab(this,'primary')">PRIMARY</div>
                                <div class="tab" onclick="tab(this,'legal')">LEGAL</div>
                                <div class="tab" onclick="tab(this,'intel')">INTEL</div>
                            </div>
                            <div id="tab-scroll" class="tab-content-scroll"></div>
                        </div>
                    </div>
                    <div id="interaction-z" class="interaction-block"></div>
                </div>`;

            // APPLY LAYOUT TO EXHIBIT PANELS
            if (currentLayout) {
                const left = document.getElementById('exhibit-left');
                const right = document.getElementById('exhibit-right');
                const tabScroll = document.getElementById('tab-scroll');
                if (left) left.style.flex = currentLayout.imageFlex;
                if (right) right.style.flex = currentLayout.textFlex;
                if (tabScroll) {
                    tabScroll.style.fontSize = currentLayout.textFontSize;
                    tabScroll.style.padding = currentLayout.textPadding;
                    tabScroll.style.lineHeight = currentLayout.textLineHeight;
                }
            }

            tab(document.querySelector('.tab'), 'primary');
            renderInteraction(s, i);
            save();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function parseMD(text) {
            if (!text) return "";
            return text
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        }

        function tab(el, tName) {
            document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
            if (el) el.classList.add('active');

            if (!window.DATA || !window.DATA.slides) return;
            const s = window.DATA.slides[user.state.last];
            if (!s || !s.tabs) return;

            const c = s.tabs[tName];
            if (!c) {
                document.getElementById('exhibit-left').innerHTML = `<div style="padding:40px; color:#333; text-align:center;">TAB DATA MISSING</div>`;
                document.getElementById('tab-scroll').innerHTML = `<div>[DATA REDACTED]</div>`;
                return;
            }

            // Expanded key support for maximum compatibility
            let url = (c.image || c.mediaURL || c.media_url || c.videoURL || c.video || c.media || "").trim();
            let type = c.mediaType || (url ? "image" : "none");
            let credit = c.credit || 'FIELD RECORD';

            // Handle comma-separated credits (Legacy support)
            if (url.includes(",")) {
                const p = url.split(",");
                url = p[0].trim();
                if (p[1]) credit = p[1].trim();
            }

            let h = "";
            const lowerUrl = url.toLowerCase();
            const isYouTube = lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be");

            if (isYouTube) {
                // Extract Video ID using robust regex to handle shorts, watch, embed, etc.
                let vidId = "";
                const watchMatch = url.match(/(?:\?v=|\/embed\/|\/watch\?v=|\?feature=player_embedded&v=|&v=)([a-zA-Z0-9_-]{11})/);
                const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);

                vidId = (watchMatch && watchMatch[1]) || (shortMatch && shortMatch[1]) || (shortsMatch && shortsMatch[1]) || "";

                if (vidId) {
                    h = `<iframe src="https://www.youtube.com/embed/${vidId}?rel=0&origin=https://www.youtube.com" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;" referrerpolicy="no-referrer"></iframe>`;
                } else {
                    // Fallback to original URL but as iframe since it's YouTube
                    h = `<iframe src="${url}" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>`;
                }
            } else if (type === "pdf" || lowerUrl.endsWith(".pdf")) {
                h = `<embed src="${url}" type="application/pdf" style="width:100%;height:100%;">`;
            } else if (type === "video" || lowerUrl.endsWith(".mp4") || lowerUrl.endsWith(".webm") || lowerUrl.endsWith(".mov")) {
                h = `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#000;">
                        <video controls src="${url}" style="width:100%;height:100%;outline:none;border:none;"></video>
                     </div>`;
            } else if (type === "audio" || lowerUrl.endsWith(".mp3") || lowerUrl.endsWith(".wav")) {
                h = `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#000;"><audio controls src="${url}"></audio></div>`;
            } else if (url) {
                h = `<img src="${url}">`;
            } else {
                h = `<div style="padding:40px; color:#333; text-align:center;">NO MEDIA DATA</div>`;
            }

            document.getElementById('exhibit-left').innerHTML = h + (url ? `<div class="img-label">${credit}</div>` : "");

            // FAILSAFE RENDERER
            let rawTxt = c.body || c.content || "";
            let finalHtml = parseMD(rawTxt);
            if (!finalHtml && rawTxt) finalHtml = `<div style="white-space:pre-wrap; font-family:var(--font-p);">${rawTxt}</div>`;
            if (!finalHtml) finalHtml = `<div style="padding:20px; opacity:0.5;">[DATA REDACTED]</div>`;

            document.getElementById('tab-scroll').innerHTML = `<h2>${tName.toUpperCase()} ANALYSIS</h2><div>${finalHtml}</div>`;
            document.getElementById('tab-scroll').scrollTop = 0;
        }

        function renderInteraction(s, i) {
            const dec = user.state.dec[i], rat = user.state.rat[i];
            const prompt = s.interactionPrompt || "[NO COMMAND PROTOCOL SPECIFIED]";
            const options = s.options || ["PROCEED"];

            let h = `<h3>EXHIBIT 0${i + 1} RECOMMENDATION PROTOCOL</h3><div class="interaction-prompt">${prompt}</div>`;
            if (rat) {
                h += `<div style="background:rgba(255,255,255,0.05); padding:20px; border-left:4px solid var(--accent); margin-bottom:20px;">
                        <strong style="color:var(--accent); font-size:0.7rem; text-transform:uppercase;">RECOMMENDATION LOG</strong><br>
                        <p style="margin-top:10px; font-size:1rem; opacity:0.8; font-family:var(--font-p);">${rat}</p>
                      </div>`;
            } else {
                h += `<strong>FIELD ANALYSIS (Cite evidence):</strong>
                      <textarea id="rat-i" oninput="document.getElementById('wc-i').innerText = (this.value.trim().split(/\\s+/).length) + ' / 50 words'"></textarea>
                      <div id="wc-i" class="word-count">0 / 50 words</div>`;
            }
            h += `<div class="choice-row">`;
            options.forEach(o => {
                const sel = dec === o;
                h += `<button class="btn ${sel ? 'active' : ''}" ${dec ? 'disabled' : ''} onclick="decide(${i},'${o}')">${o}</button>`;
            });
            h += `</div>`;

            // Manual Debrief Trigger (Safety Net)
            if (dec && i === window.DATA.slides.length - 1) {
                h += `<div style="margin-top:30px; border-top:1px solid #333; padding-top:20px; text-align:center;">
                        <button class="btn" style="background:var(--accent); color:#000; font-weight:bold; width:100%; padding:15px;" onclick="startRef('post')">ACCESS MISSION DEBRIEF</button>
                      </div>`;
            }
            document.getElementById('interaction-z').innerHTML = h;
        }

        function decide(i, l) {
            const r = document.getElementById('rat-i')?.value;
            if (!r || r.trim().split(/\s+/).length < 50) return alert("Formal analysis (min 50 words) required before decision.");
            user.state.rat[i] = r; user.state.dec[i] = l;
            save(); renderNav(); go(i);

            // HISTORICAL REVEAL LOGIC
            const s = window.DATA.slides[i];
            if (s.historicalOutcome) {
                toggleHistoricalPanel(true, parseMD(s.historicalOutcome));
            }

            if (i === window.DATA.slides.length - 1 && !s.historicalOutcome) setTimeout(() => startRef("post"), 1000);
        }

        function toggleHistoricalPanel(show, content) {
            const p = document.getElementById('historical-panel');
            if (show && content) {
                document.getElementById('historical-content').innerHTML = content;
                p.style.display = 'block';
            } else {
                p.style.display = 'none';
                // Check if this was the last slide to trigger debrief
                const i = user.state.last;
                if (i === window.DATA.slides.length - 1) setTimeout(() => startRef("post"), 500);
            }
        }

        async function save() { if (user.id && currentMission) await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'save_state', id: user.id, missionId: currentMission, state: user.state }) }); }
        async function initParticles() { await tsParticles.load("tsparticles", { particles: { number: { value: 30 }, size: { value: 2 }, move: { speed: 0.5 }, opacity: { value: 0.3 } } }); }

        function resetAICache() {
            if (!confirm("CLEAR AI FEEDBACK? This will force a fresh fetch from the server.")) return;
            user.state.aiFeedback = null;
            user.state.aiRequested = false;
            save();
            location.reload();
        }
    </script>

    <!-- DEBUG MODAL (DEPRECATED) -->
    <div id="debug-modal" class="modal" style="display:none;"></div>
</body>

</html>
```

### **TEMPLATE C: Teacher Mode (teachermode.html)**
```html
<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>MISSION CONTROL // TEACHER MODE</title>
    <script>const URL = "[[INJECT_URL_NOW]]"; const PIN = "[[INJECT_PIN_NOW]]";</script>
    <style>
        :root {
            --bg: #f4f4f4;
            --accent: #222;
            --success: #28a745;
            --err: #dc3545;
            --terminal: #000;
            --term-txt: #0f0;
        }

        body {
            font-family: 'Courier New', monospace;
            padding: 40px;
            background: var(--bg);
            color: #333;
            margin: 0;
        }

        #status-bar {
            background: #1a1a1a;
            color: #fff;
            padding: 15px 25px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 5px solid var(--accent);
        }

        .status-light {
            height: 12px;
            width: 12px;
            border-radius: 50%;
            background: #666;
            display: inline-block;
            margin-right: 10px;
        }

        .status-light.online {
            background: var(--success);
            box-shadow: 0 0 10px var(--success);
        }

        .status-light.offline {
            background: var(--err);
            box-shadow: 0 0 10px var(--err);
        }

        h1 {
            text-transform: uppercase;
            letter-spacing: 5px;
            border-bottom: 2px solid var(--accent);
            padding-bottom: 10px;
            margin-bottom: 30px;
            font-size: 1.5rem;
        }

        #console {
            background: var(--terminal);
            color: var(--term-txt);
            padding: 15px;
            height: 180px;
            overflow-y: auto;
            font-size: 0.8rem;
            border: 1px solid #333;
            margin-bottom: 30px;
        }

        .panel {
            background: #fff;
            padding: 30px;
            border: 1px solid #ddd;
            border-top: 5px solid var(--accent);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .grid {
            display: grid;
            grid-template-columns: 1fr 1.2fr;
            gap: 30px;
        }

        input,
        textarea {
            width: 100%;
            padding: 12px;
            margin-bottom: 15px;
            border: 1px solid #ccc;
            font-family: inherit;
            box-sizing: border-box;
        }

        .btn {
            background: var(--accent);
            color: #fff;
            border: none;
            padding: 15px 25px;
            cursor: pointer;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            width: 100%;
            transition: 0.2s;
        }

        .btn:hover {
            background: #444;
        }

        .btn-del {
            color: var(--err);
            cursor: pointer;
            font-weight: bold;
            font-size: 0.6rem;
            text-decoration: underline;
            border: none;
            background: none;
            padding: 0;
        }

        .btn-del:hover {
            color: #8b0000;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        th,
        td {
            padding: 12px;
            border-bottom: 1px solid #eee;
            text-align: left;
            font-size: 0.75rem;
            vertical-align: middle;
        }

        th {
            background: var(--accent);
            color: #fff;
            text-transform: uppercase;
            font-size: 0.6rem;
            letter-spacing: 1px;
        }

        .thumb {
            width: 46px;
            height: 46px;
            background-size: cover;
            background-position: center;
            border-radius: 4px;
            border: 1px solid #ddd;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        label {
            font-size: 0.6rem;
            color: #888;
            text-transform: uppercase;
            margin-bottom: 5px;
            display: block;
            font-weight: bold;
        }

        /* PROJECTOR MODE */
        #projector-view {
            display: none;
            position: fixed;
            inset: 0;
            background: #050505;
            z-index: 2000;
            padding: 40px;
            overflow-y: auto;
        }

        #projector-view.active {
            display: block;
        }

        .proj-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #d2b48c;
            padding-bottom: 20px;
            margin-bottom: 40px;
        }

        .proj-header h1 {
            margin: 0;
            letter-spacing: 8px;
            font-size: 2rem;
            color: #d2b48c;
            text-transform: uppercase;
        }

        .proj-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
        }

        .proj-card {
            background: #111;
            border: 1px solid #333;
            padding: 8px;
            transition: 0.3s;
        }

        .proj-card.active {
            border-color: #d2b48c;
            box-shadow: 0 0 20px rgba(210, 180, 140, 0.1);
        }

        .proj-name {
            font-size: 0.85rem;
            font-weight: bold;
            color: #d2b48c;
            margin-bottom: 4px;
            text-transform: uppercase;
        }

        .proj-class {
            font-size: 0.55rem;
            color: #d2b48c;
            opacity: 0.8;
            margin-bottom: 8px;
        }

        .proj-stats {
            display: flex;
            justify-content: space-between;
            font-size: 0.65rem;
            border-top: 1px solid #333;
            padding-top: 6px;
        }

        .proj-bar {
            height: 3px;
            background: #222;
            margin-top: 8px;
        }

        .proj-fill {
            height: 100%;
            background: #d2b48c;
            transition: width 1s ease;
        }
    </style>
</head>

<div id="projector-view">
    <header class="proj-header">
        <h1>COMMAND PROGRESS BOARD</h1>
        <div style="display:flex; gap:15px; align-items:center;">
            <select id="proj-class-filter" onchange="renderProjectorBoard()"
                style="padding:8px 12px; font-family:inherit; font-size:0.7rem; background:#222; color:#d2b48c; border:1px solid #444;">
                <option value="ALL">ALL CLASSES</option>
            </select>
            <select id="proj-mission-filter" onchange="renderProjectorBoard()"
                style="padding:8px 12px; font-family:inherit; font-size:0.7rem; background:#222; color:#d2b48c; border:1px solid #444;">
                <option value="ALL">ALL MISSIONS</option>
            </select>
            <span id="proj-sync" style="font-size:0.7rem; color:#888; letter-spacing:2px;">[SYNCING]</span>
            <button onclick="toggleProjector()"
                style="background:#d2b48c; color:#000; border:none; padding:8px 15px; cursor:pointer; font-weight:bold; letter-spacing:1px; font-size:0.7rem;">EXIT
                PROJECTOR</button>
        </div>
    </header>
    <div id="proj-board" class="proj-grid"></div>
</div>

<div id="status-bar">
    <div><span id="s-light" class="status-light"></span> <span id="s-text"
            style="letter-spacing: 2px;">VINTAGE_LINK_OFFLINE</span></div>
    <div style="display:flex; gap:20px; align-items:center;">
        <button onclick="toggleProjector()"
            style="background:#333; color:#d2b48c; font-size:0.6rem; border:1px solid #d2b48c; padding:6px 15px; border-radius:3px; cursor:pointer; font-weight:bold; letter-spacing:1px;">ðŸ“º
            PROJECTOR VIEW</button>
        <a href="projector.html" target="_blank"
            style="color:var(--accent); font-size:0.6rem; text-decoration:none; border:1px solid var(--accent); padding:5px 10px; border-radius:3px;">NEW
            WINDOW</a>
        <button onclick="toggleLibrary()"
            style="background:var(--accent); color:#fff; font-size:0.6rem; border:none; padding:6px 15px; border-radius:3px; cursor:pointer; font-weight:bold; letter-spacing:1px;">ðŸ“š
            OPEN COMMUNITY HUB</button>
        <div style="font-size: 0.7rem; opacity: 0.7;">TEACHER MODE // v63.7</div>
    </div>
</div>
<h1 style="margin: 0 40px 30px 40px;">COMMAND CENTER // MISSION CONTROL</h1>
<div class="grid" style="grid-template-columns: 1fr 1.5fr 1fr; padding: 0 40px;">
    <div class="panel">
        <h3
            style="margin-top:0; letter-spacing:2px; font-size:0.8rem; border-bottom:1px solid #ddd; padding-bottom:10px;">
            CAPSULE INJECTION</h3>
        <div id="upload-zone"
            style="border:2px dashed #ccc; padding:20px; text-align:center; margin-bottom:20px; cursor:pointer;"
            onclick="document.getElementById('file-input').click()">
            <div style="font-size:1.5rem; margin-bottom:5px;">ðŸ“</div>
            <div style="font-size:0.5rem; color:#666; font-weight:bold;">LOAD .BLOB CAPSULE</div>
            <input type="file" id="file-input" accept=".blob" style="display:none" onchange="handleFile(this.files[0])">
        </div>
        <label>Mission ID</label><input id="m-id" placeholder="e.g. CUBA62">
        <label>Public Name</label><input id="m-name" placeholder="Operation Anadyr">
        <label>Raw Payload</label><textarea id="json-input" style="height: 60px; font-size:0.6rem;"
            placeholder="..."></textarea>
        <button class="btn" style="padding:10px; font-size:0.75rem;" onclick="upload()">INITIALIZE ARCHIVE</button>
    </div>

    <div class="panel">
        <div
            style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:20px;">
            <h3 style="margin:0; letter-spacing:2px; font-size:0.8rem;">LIVE PROGRESS BOARD</h3>
            <div id="sync-tick" style="font-size:0.55rem; color:#888;">[SYNC_IDLE]</div>
        </div>
        <div style="margin-bottom:15px; display:flex; gap:10px;">
            <select id="class-filter" style="flex:1; padding:8px; font-family:inherit; font-size:0.75rem;"
                onchange="renderProgress()">
                <option value="ALL">ALL CLASSES</option>
            </select>
            <button class="btn" style="width:auto; padding:0 15px; font-size:0.6rem;"
                onclick="fetchProgress()">REFRESH</button>
        </div>
        <div id="progress-list" style="max-height:500px; overflow-y:auto; border:1px solid #eee;"></div>
    </div>

    <div style="display:flex; flex-direction:column; gap:20px;">
        <div class="panel" style="flex:1;">
            <h3
                style="margin-top:0; letter-spacing:2px; font-size:0.8rem; border-bottom:1px solid #ddd; padding-bottom:10px;">
                LIVE DIRECTORY</h3>
            <div id="lib-log" style="font-size: 0.55rem; color: #888; margin-bottom: 10px;">Scanning...</div>
            <div id="library-list"></div>
        </div>
        <div class="panel" style="padding:20px; background:var(--terminal); border-top:none;">
            <h3 style="margin-top:0; color:#fff; font-size:0.6rem; letter-spacing:1px; opacity:0.6;">SYSTEM LOG</h3>
            <div id="console" style="height:150px; overflow-y:auto; font-size:0.65rem; color:var(--term-txt);">
            </div>
        </div>
    </div>
</div>

<div id="library-hub"
    style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:3000; padding:60px; overflow-y:auto;">
    <div
        style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--accent); padding-bottom:20px; margin-bottom:40px;">
        <h1 style="margin:0; color:var(--accent); letter-spacing:5px; border-bottom:none;">COMMUNITY ARCHIVE HUB
        </h1>
        <button onclick="toggleLibrary()"
            style="background:transparent; border:1px solid #666; color:#666; padding:10px 20px; cursor:pointer; font-family:inherit;">[CLOSE_HUB]</button>
    </div>
    <div id="hub-grid" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
        <div style="grid-column:1/-1; text-align:center; padding:100px; opacity:0.5; color:#fff;">LOADING MISSION
            CATALOG...</div>
    </div>
</div>
<script>
    let allProgress = [];
    const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id); return response;
    };

    function log(m, t = "info") {
        const c = document.getElementById('console'); const color = t === "success" ? "lime" : t === "error" ? "red" : "#0f0";
        if (!c) return;
        c.innerHTML += `<div style="color:${color}">[${new Date().toLocaleTimeString()}] ${m}</div>`;
        c.scrollTop = c.scrollHeight;
    }
    function setStatus(s, t) { document.getElementById('s-light').className = "status-light " + s; document.getElementById('s-text').innerText = t; }

    // COMMUNITY HUB LOGIC
    const LIB_URL = "https://raw.githubusercontent.com/dwaugh-edsim/projectimages/main/capsule-library/index.json";
    function toggleLibrary() {
        const h = document.getElementById('library-hub');
        const show = h.style.display === 'none';
        h.style.display = show ? 'block' : 'none';
        if (show) fetchLibrary();
    }
    async function fetchLibrary() {
        try {
            const res = await fetch(LIB_URL);
            if (!res.ok) throw new Error("Catalog not found.");
            const j = await res.json(); renderLibrary(j.capsules);
        } catch (e) { document.getElementById('hub-grid').innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red; padding:100px;">CONNECTION_ERROR: Failed to fetch Community Archive.</div>`; }
    }
    function renderLibrary(caps) {
        let h = "";
        caps.forEach(c => {
            h += `<div class="panel" style="border-top-color:#666;">
                    <div style="height:150px; background-image:url('${c.thumb}'); background-size:cover; background-position:center; margin-bottom:15px; border-radius:4px; border:1px solid #333;"></div>
                    <h4 style="margin:0; letter-spacing:1px; font-size:0.85rem;">${c.title}</h4>
                    <div style="font-size:0.6rem; color:#888; margin-bottom:15px; text-transform:uppercase;">AUTHOR: ${c.author}</div>
                    <p style="font-size:0.7rem; height:45px; overflow:hidden; opacity:0.7; line-height:1.4;">${c.description}</p>
                    <button class="btn" onclick="importMission('${c.downloadUrl}', '${c.id}', '${c.title}')" style="background:transparent; border:1px solid var(--accent); color:var(--accent); padding:8px; font-size:0.6rem; width:100%; margin-top:10px;">IMPORT TO ARCHIVE</button>
                </div>`;
        });
        document.getElementById('hub-grid').innerHTML = h || "<div style='grid-column:1/-1; text-align:center; opacity:0.5; padding:100px; color:#fff;'>NO MISSIONS IN CATALOG.</div>";
    }
    async function importMission(url, id, name) {
        log(`Syncing Remote Capsule [${id}]...`);
        try {
            const res = await fetch(url); const payload = await res.json();
            const res2 = await fetch(URL, { method: 'POST', body: JSON.stringify({ action: 'update_content', pin: PIN, id: id, name: name, payload: payload }) });
            const j = await res2.json();
            if (j.status === "success") { log(`Remote Capsule [${id}] committed to local record.`, "success"); fetchMissions(); alert(`Mission [${name}] successfully imported!`); }
            else log(j.message, "error");
        } catch (e) { log(`Import failed: ${e.message}`, "error"); }
    }

    async function fetchMissions() {
        log("Pinging Archive Server...");
        try {
            const res = await fetchWithTimeout(URL + "?action=list_missions");
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            const j = await res.json();
            if (j.status === "success") {
                setStatus("online", "ENCRYPTED_LINK_ACTIVE");
                renderMissions(j.missions); fetchProgress();
                log("Handshake successful. Directory synchronized.", "success");
            } else { throw new Error(j.message || "Unknown server error"); }
        } catch (e) {
            setStatus("offline", "CONNECTION_FAILURE");
            log(`CRITICAL: ${e.message}`, "error");
            log("HINT: Ensure the Apps Script URL and TEACHER_PIN are correctly configured.");
            renderMissions([]); // Show empty table so UI isn't empty
        }
    }

    async function upload() {
        const id = document.getElementById('m-id').value.toUpperCase().replace(/\s/g, ''), name = document.getElementById('m-name').value, raw = document.getElementById('json-input').value;
        if (!id || !name || !raw) return log("ABORTED: Missing required parameters.", "error");
        log(`Opening stream for Capsule [${id}]...`);
        try {
            const res = await fetch(URL, { method: 'POST', body: JSON.stringify({ action: 'update_content', pin: PIN, id: id, name: name, payload: JSON.parse(raw) }) });
            const j = await res.json();
            if (j.status === "success") {
                log("CAPSULE COMMITTED TO RECORD.", "success");
                document.getElementById('m-id').value = ""; document.getElementById('m-name').value = ""; document.getElementById('json-input').value = "";
                fetchMissions();
            } else log(j.message, "error");
        } catch (e) { log(e.message, "error"); }
    }

    function handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // SCHEMA v1.0 SUPPORT
                const id = (data.metadata && data.metadata.id) ? data.metadata.id : data.missionId || "";
                const name = (data.metadata && data.metadata.title) ? data.metadata.title : (data.meta && data.meta.title) ? data.meta.title : "";

                document.getElementById('m-id').value = id;
                document.getElementById('m-name').value = name;
                document.getElementById('json-input').value = e.target.result;

                log(`Capsule [${file.name}] loaded into staging.`, "success");
                document.getElementById('upload-zone').style.borderColor = "var(--success)";
            } catch (ex) { log("INVALID CAPSULE: Not a valid .blob/JSON file.", "error"); }
        };
        reader.readAsText(file);
    }

    async function fetchProgress() {
        document.getElementById('sync-tick').innerText = "[SYNC_BUSY]";
        try {
            const res = await fetchWithTimeout(URL, { method: 'POST', body: JSON.stringify({ action: 'fetch_progress', pin: PIN }) });
            const j = await res.json();
            if (j.status === "success") {
                allProgress = j.progress;
                updateClassFilter(); renderProgress();
                document.getElementById('sync-tick').innerText = "[SYNC_OK]";
                setTimeout(() => document.getElementById('sync-tick').innerText = "[SYNC_IDLE]", 3000);
            }
        } catch (e) {
            log("Progress sync failed: " + e.message, "error");
            document.getElementById('sync-tick').innerText = "[SYNC_FAIL]";
        }
    }

    function updateClassFilter() {
        const f = document.getElementById('class-filter'); const val = f.value;
        const classes = [...new Set(allProgress.map(p => p.class))].sort();
        let h = `<option value="ALL">ALL CLASSES</option>`;
        classes.forEach(c => { h += `<option value="${c}">${c}</option>`; });
        f.innerHTML = h; if (f.innerHTML.includes(val)) f.value = val;
    }

    function renderProgress() {
        const filter = document.getElementById('class-filter').value;
        const filtered = filter === "ALL" ? allProgress : allProgress.filter(p => p.class === filter);
        let h = "";
        filtered.forEach(p => {
            const missions = Object.keys(p.missionData || {});
            missions.forEach(mid => {
                const st = p.missionData[mid]; if (!st) return;
                const decs = st.dec ? Object.keys(st.dec).length : 0;
                const pre = st.preDone ? "âœ“" : "Ã—";

                h += `<div style="padding:6px 10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:0.7rem; font-weight:bold;">${p.name} <span style="color:#888; font-weight:normal; font-size:0.65rem;">${p.class}</span></div>
                            <div style="color:#666; font-size:0.6rem; margin-top:2px;">MISSION: ${mid} | STEP: ${decs} | BRIEF: ${pre}</div>
                        </div>
                        <button class="btn" style="padding:5px 10px; font-size:0.6rem; background:#c00; color:#fff; white-space:nowrap; flex-shrink:0; width:auto !important;" onclick="deleteStudent('${p.id}', '${p.name}')">DELETE</button>
                      </div>`;
            });
        });
        document.getElementById('progress-list').innerHTML = h || "<p style='color:#ccc; padding:20px; font-size:0.65rem;'>No student data detected.</p>";
    }

    async function deleteStudent(id, name) {
        if (!confirm(`DELETE STUDENT: ${name}?\n\nThis will permanently remove all progress data. This action cannot be undone.`)) return;
        log(`Deleting student [${name}]...`);
        try {
            const res = await fetch(URL, { method: 'POST', body: JSON.stringify({ action: 'delete_student', pin: PIN, id: id }) });
            const j = await res.json();
            if (j.status === "success") {
                log(`Student [${name}] deleted.`, "success");
                fetchProgress();
            } else log(j.message, "error");
        } catch (e) { log(e.message, "error"); }
    }

    async function runAI(uid, mid) {
        log(`Initiating AI Analysis for Archive [${uid}]...`);
        // Find student data
        const student = allProgress.find(p => p.id === uid); if (!student) return log("User not found", "error");
        const mData = student.missionData[mid]; if (!mData) return log("Mission data not found", "error");

        try {
            const res = await fetch(URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'generate_ai_feedback',
                    pin: PIN,
                    rationales: mData.rat,
                    context: { title: mid }
                })
            });
            const j = await res.json();
            if (j.status === "success") {
                log("AI Feedback generated successfully.", "success");
                // Save feedback back to student state
                mData.aiFeedback = j.feedback;
                await fetch(URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'save_state',
                        id: uid,
                        missionId: mid,
                        state: mData
                    })
                });
                log("Feedback committed to student record.", "success");
                fetchProgress();
            } else log(j.message, "error");
        } catch (e) { log(e.message, "error"); }
    }

    async function toggleAI(id, state) {
        log(`Updating AI Protocols for [${id}]...`);
        try {
            // SHOTGUN APPROACH: Send multiple property names to try and hit the correct backend handler
            const res = await fetch(URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'toggle_ai',
                    pin: PIN,
                    id: id,
                    state: state,       // boolean
                    enabled: state,     // alias
                    val: state ? 1 : 0  // numeric
                })
            });
            const j = await res.json();
            if (j.status === "success") {
                log(`Classroom AI for [${id}] updated.`, "success");
                await fetchMissions();
            } else {
                log(`Backend Error: ${j.message}`, "error");
                alert("Remote toggle failed. Please update 'enableAIFeedback' in your .blob file and re-upload.");
                fetchMissions(); // Revert
            }
        } catch (e) { log(e.message, "error"); fetchMissions(); }
    }

    async function deleteMission(id) {
        if (!confirm(`PERMANENT DELETION: Are you sure you want to scrub mission [${id}] from the record?`)) return;
        log(`DELETING CAPSULE [${id}]...`);
        try {
            const res = await fetch(URL, { method: 'POST', body: JSON.stringify({ action: 'delete_content', pin: PIN, id: id }) });
            const j = await res.json();
            if (j.status === "success") { log("CAPSULE DELETED.", "success"); fetchMissions(); } else log(j.message, "error");
        } catch (e) { log(e.message, "error"); }
    }

    function renderMissions(missions) {
        console.log("DEBUG: Missions Payload:", missions); // DEBUG INSPECTION
        const list = document.getElementById('library-list');
        if (!missions || missions.length === 0) {
            list.innerHTML = "<div style='color:#ccc; padding:20px; font-size:0.65rem;'>No missions in archive.</div>";
            document.getElementById('lib-log').innerText = "Archive empty.";
            return;
        }
        document.getElementById('lib-log').innerText = `${missions.length} mission(s) loaded.`;

        let h = `<table style="width:100%; font-size:0.65rem; border-collapse:collapse;">
                    <thead><tr style="border-bottom:1px solid #ddd; text-align:left;">
                        <th style="padding:8px; width:50px;">VISUAL</th>
                        <th style="padding:8px;">ID</th>
                        <th style="padding:8px;">NAME</th>
                    <th style="padding:8px; text-align:center;">AI Qs</th>
                        <th style="padding:8px; text-align:center;">ACTION</th>
                    </tr></thead><tbody>`;

        missions.forEach(m => {
            const thumb = m.thumb || "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200&auto=format&fit=crop";

            h += `<tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px;">
                        <div style="width:40px; height:25px; background-image:url('${thumb}'); background-size:cover; background-position:center; border-radius:2px; border:1px solid #ccc;"></div>
                    </td>
                    <td style="padding:8px; font-weight:bold;">${m.id}</td>
                    <td style="padding:8px;">${m.name}</td>
                    <td style="padding:8px; text-align:center;">
                        <label style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center;">
                            <input type="checkbox" ${m.aiEnabled ? 'checked' : ''} onchange="toggleAI('${m.id}', this.checked)" style="cursor:pointer; transform:scale(1.2);">
                        </label>
                    </td>
                    <td style="padding:8px; text-align:center;">
                        <button class="btn-del" onclick="deleteMission('${m.id}')" style="font-size:0.6rem; padding:4px 8px; background:none; border:1px solid #c00; color:#c00; cursor:pointer;">DEL</button>
                    </td>
                  </tr>`;
        });
        h += `</tbody></table>`;
        list.innerHTML = h;
    }

    // FAILSAFE: Ensure UI renders even if handshake is slow
    window.onload = () => {
        log("BOOT SEQUENCE INITIATED...");
        fetchMissions();
        setInterval(fetchProgress, 30000);
    };

    // PROJECTOR VIEW
    function toggleProjector() {
        const pv = document.getElementById('projector-view');
        pv.classList.toggle('active');
        if (pv.classList.contains('active')) renderProjectorBoard();
    }

    function renderProjectorBoard() {
        const board = document.getElementById('proj-board');
        const classFilter = document.getElementById('proj-class-filter');
        const missionFilter = document.getElementById('proj-mission-filter');
        document.getElementById('proj-sync').innerText = "[LOG_ACTIVE]";

        // Build entries list
        const entries = [];
        const allClasses = new Set();
        const allMissions = new Set();

        allProgress.forEach(p => {
            Object.keys(p.missionData || {}).forEach(mid => {
                const st = p.missionData[mid];
                if (st) {
                    entries.push({ name: p.name, class: p.class, mission: mid, steps: st.dec ? Object.keys(st.dec).length : 0, brief: st.preDone ? "READY" : "BRIEFING" });
                    allClasses.add(p.class);
                    allMissions.add(mid);
                }
            });
        });

        // Populate filter dropdowns (preserve selection)
        const currentClass = classFilter.value;
        const currentMission = missionFilter.value;

        classFilter.innerHTML = '<option value="ALL">ALL CLASSES</option>';
        [...allClasses].sort().forEach(c => {
            classFilter.innerHTML += `<option value="${c}" ${c === currentClass ? 'selected' : ''}>${c}</option>`;
        });

        missionFilter.innerHTML = '<option value="ALL">ALL MISSIONS</option>';
        [...allMissions].sort().forEach(m => {
            missionFilter.innerHTML += `<option value="${m}" ${m === currentMission ? 'selected' : ''}>${m}</option>`;
        });

        // Apply filters
        let filtered = entries;
        if (classFilter.value !== 'ALL') {
            filtered = filtered.filter(e => e.class === classFilter.value);
        }
        if (missionFilter.value !== 'ALL') {
            filtered = filtered.filter(e => e.mission === missionFilter.value);
        }

        // Sort and render
        filtered.sort((a, b) => (a.class > b.class) ? 1 : (a.name > b.name) ? 1 : -1);

        let h = "";
        filtered.forEach(e => {
            const pct = (e.steps / 18) * 100;
            h += `<div class="proj-card ${e.steps > 0 ? 'active' : ''}">
                <div class="proj-name">${e.name}</div>
                <div class="proj-class">${e.class} // ${e.mission}</div>
                <div class="proj-stats">
                    <div><div style="color:#d2b48c; font-size:0.5rem; text-transform:uppercase; margin-bottom:2px;">Exhibit</div><div style="font-size:0.75rem; color:#fff;">${e.steps}</div></div>
                    <div><div style="color:#d2b48c; font-size:0.5rem; text-transform:uppercase; margin-bottom:2px;">Status</div><div style="font-size:0.65rem; color:${e.brief === 'READY' ? '#0f0' : '#ff0'};">${e.brief}</div></div>
                </div>
                <div class="proj-bar"><div class="proj-fill" style="width:${pct}%"></div></div>
            </div>`;
        });

        document.getElementById('proj-sync').innerText = `[${filtered.length} AGENTS]`;
        board.innerHTML = h || "<div style='grid-column:1/-1; text-align:center; opacity:0.3; padding:100px; color:#d2b48c;'>WAITING FOR FIELD AGENTS...</div>";
    }

    // BATCH AI ANALYSIS
    async function analyzeAll() {
        const candidates = [];
        allProgress.forEach(p => {
            Object.keys(p.missionData || {}).forEach(mid => {
                const st = p.missionData[mid];
                if (st && st.preDone && !st.aiFeedback) candidates.push({ uid: p.id, mid: mid, name: p.name });
            });
        });
        if (candidates.length === 0) return log("No students ready for AI analysis.", "info");
        if (!confirm(`Generate AI feedback for ${candidates.length} student(s)? This may take 1-2 minutes.`)) return;

        log(`Starting batch AI analysis for ${candidates.length} students...`);
        let processed = 0;
        for (const c of candidates) {
            await runAI(c.uid, c.mid);
            processed++;
            log(`Progress: ${processed}/${candidates.length} (${c.name})`, "info");
            if (processed < candidates.length) await new Promise(r => setTimeout(r, 4000)); // Rate limit: 15 RPM
        }
        log(`Batch complete. ${processed} students analyzed.`, "success");
        fetchProgress();
    }
</script>
</body>

</html>
```
