# Classroom Sim Architect: Knowledge Archive (v62.6 AI-Powered Debrief)

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
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + API_KEY;
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
    <meta charset="UTF-8"><title>SITUATION ROOM</title>
    <script>const API_URL = "[[INJECT_URL_NOW]]";</script>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/tsparticles@2.11.1/tsparticles.bundle.min.js"></script>
    <style>
        :root { --bg: #0c0c0c; --accent: #d2b48c; --text: #e0e0e0; --card: #ffffff; --font-p: 'Georgia', serif; --font-h: 'Courier New', monospace; }
        body { margin:0; min-height:100vh; display:flex; font-family:var(--font-h); background:var(--bg); color:var(--text); overflow-x:hidden; }
        .sidebar { width:260px; background:#000; padding:15px; display:flex; flex-direction:column; border-right:1px solid #333; }
        .nav-container { flex:1; overflow-y:auto; margin-top:20px; }
        .nav-container::-webkit-scrollbar { width:4px; }
        .nav-container::-webkit-scrollbar-thumb { background:var(--accent); }
        
        .main { flex:1; display:flex; flex-direction:column; align-items:center; background:#111; perspective:1000px; padding:20px; position:relative; min-height:100vh; overflow-y:auto; scroll-behavior: smooth; }
        .footer { position:fixed; bottom:0; left:0; right:0; background:rgba(0,0,0,0.95); border-top:1px solid #333; padding:10px 20px; display:flex; justify-content:space-between; font-size:0.6rem; color:#666; z-index:100; pointer-events:none; backdrop-filter:blur(5px); }
        .mission-header { font-family:var(--font-h); color:#fff; font-size:1.1rem; text-transform:uppercase; margin-bottom:5px; border-left:4px solid var(--accent); padding-left:10px; line-height:1.2; letter-spacing:2px; }
        
        .card-container { width:100%; max-width:1100px; display:flex; flex-direction:column; margin: 0; }
        .card { background:transparent; display:none; flex-direction:column; animation: fadeIn 0.5s ease; width:100%; }
        .card.active { display:flex; }
        
        /* SPLIT VIEW EXHIBIT */
        .exhibit-frame { display:flex; background:var(--card); color:#000; border-radius:4px; min-height:450px; max-height:500px; overflow:hidden; border:1px solid #999; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        .exhibit-left { flex:1.1; background:#000; position:relative; border-right:1px solid #ddd; }
        .exhibit-left img { width:100%; height:100%; object-fit:cover; display:block; }
        .img-label { position:absolute; bottom:15px; left:15px; background:rgba(0,0,0,0.8); color:var(--accent); padding:6px 10px; font-size:0.55rem; text-transform:uppercase; border:1px solid var(--accent); letter-spacing:1px; z-index:10; }
        
        .exhibit-right { flex:1; display:flex; flex-direction:column; background:#fff; overflow:hidden; }
        .tab-bar { display:flex; background:#f4f4f4; border-bottom:1px solid #ddd; }
        .tab { flex:1; padding:12px; cursor:pointer; text-align:center; font-size:0.65rem; border-right:1px solid #ddd; color:#999; font-weight:bold; transition:0.2s; letter-spacing:1px; }
        .tab.active { background:#fff; color:#000; opacity:1; }
        .tab:hover:not(.active) { background:#eee; color:#666; }
        .tab-content-scroll { flex:1; overflow-y:auto; padding:25px; line-height:1.6; font-family:var(--font-p); text-align:justify; color:#333; font-size:0.95rem; }
        .tab-content-scroll h2 { font-family:var(--font-h); font-size:0.8rem; margin-top:0; color:#888; text-transform:uppercase; letter-spacing:2px; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:15px; }

        /* INTERACTION AREA */
        .interaction-block { background:#222; color:#fff; border-top:4px solid var(--accent); padding:20px; margin-top:10px; border-radius:4px; }
        .interaction-prompt { font-style:italic; font-size:0.9rem; color:var(--accent); margin-bottom:15px; line-height:1.4; border-left:3px solid var(--accent); padding-left:15px; }
        .btn { background:#333; color:#fff; border:1px solid #555; padding:12px; cursor:pointer; font-family:inherit; transition:0.2s; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; }
        .btn:hover { background:#444; border-color:var(--accent); }
        .btn.active { background:var(--accent) !important; color:#000 !important; font-weight:bold; border-color:var(--accent); }
        .btn.locked { opacity:0.3; cursor:not-allowed; }
        .choice-row { display:flex; gap:10px; margin-top:15px; }
        .choice-row .btn { flex:1; text-align:center; }
        
        #tsparticles { position:fixed; inset:0; z-index:-1; pointer-events:none; }
        
        /* SCROLLABLE SPLASH */
        #splash { position:fixed; inset:0; background:#000; background-size:cover; background-position:center; z-index:999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:100px 20px 100px 20px; overflow-y:auto; }
        #splash-overlay { position:fixed; inset:0; background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.9)); z-index:-1; }
        .splash-inner { width:100%; max-width:1200px; display:flex; flex-direction:column; align-items:center; z-index:10; position:relative; }
        
        .briefing-dossier { 
            width:100%; max-width:400px; background:rgba(0,0,0,0.85); border:1px solid #333; border-top:5px solid var(--accent); 
            padding:30px; margin-top:20px; max-height:45vh; overflow-y:auto; scrollbar-width: thin; 
            box-shadow: 0 20px 60px rgba(0,0,0,1); color:#eee; font-family:var(--font-p); line-height:1.7; text-align:justify;
        }
        .briefing-dossier::-webkit-scrollbar { width:4px; }
        .briefing-dossier::-webkit-scrollbar-thumb { background:var(--accent); }
        
        #ref-modal { display:none; flex-direction:column; align-items:center; width:100%; }
        #mission-title-big { font-size: 2.5rem; text-transform:uppercase; letter-spacing:12px; font-weight:bold; color:#fff; text-shadow:0 0 40px rgba(0,0,0,0.9); margin-bottom:10px; text-align:center; line-height:1.1; }
        #ref-title { color:var(--accent); font-size:1.1rem; text-transform:uppercase; letter-spacing:6px; margin-bottom:30px; opacity:0.9; font-weight:bold; }
        
        #ref-q { margin:20px 0; font-size:1.1rem; color:var(--accent); font-weight:bold; }
        textarea { background:#111; color:#fff; border:1px solid #444; padding:15px; width:100%; font-family:inherit; margin-bottom:10px; box-sizing:border-box; outline:none; font-size:0.9rem; height:80px; line-height:1.5; }
        .word-count { font-size: 0.6rem; color: #666; text-align: right; margin-top:-5px; margin-bottom:15px; }
        
        .mission-item { display:flex; align-items:center; background:#111; border:1px solid #333; padding:15px; margin-bottom:10px; cursor:pointer; width:100%; box-sizing:border-box; transition:0.2s; }
        .mission-item:hover { border-color:var(--accent); background:#1a1a1a; }
        .mission-thumb { width:52px; height:52px; border-radius:4px; background-size:cover; background-position:center; border:1px solid #333; margin-right:20px; box-shadow:0 0 10px rgba(0,0,0,0.5); }
        .mission-item:hover .mission-thumb { border-color:var(--accent); }
        
        #glossary-panel { display:none; position:fixed; top:20px; right:20px; width:350px; max-height:85vh; background:#000; border:1px solid var(--accent); z-index:2000; padding:25px; overflow-y:auto; box-shadow:0 0 30px rgba(0,0,0,1); }
        .glossary-term { color:var(--accent); font-weight:bold; display:block; margin-bottom:5px; text-transform:uppercase; font-size:0.8rem; }
        .glossary-def { font-family:var(--font-p); font-size:0.9rem; color:#ccc; display:block; margin-bottom:15px; line-height:1.4; }
        
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .watermark { position:fixed; bottom:40px; left:20px; font-size:0.5rem; color:var(--accent); opacity:0.3; letter-spacing:2px; z-index:100; pointer-events:none; }
    </style>
</head>
<body>
    <div class="watermark">SECURE CONNECTION // ENCRYPTED LINK Active</div>
    <div id="tsparticles"></div>
    <div id="loading-screen" style="position:fixed; inset:0; background:#000; display:none; flex-direction:column; align-items:center; justify-content:center; color:var(--accent); z-index:1001; font-weight:bold; letter-spacing:5px;">SYNCHRONIZING ARCHIVES...</div>
    
    <div id="glossary-panel">
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; border-bottom:1px solid #333; padding-bottom:10px;">
            <span style="color:var(--accent); font-size:0.9rem; font-weight:bold; letter-spacing:2px;">INTELLIGENCE GLOSSARY</span>
            <span onclick="toggleGlossary()" style="cursor:pointer; opacity:0.5;">[CLOSE]</span>
        </div>
        <div id="glossary-content"></div>
    </div>

    <div id="splash">
        <div id="splash-overlay"></div>
        <div class="splash-inner">
            <div id="login-step" style="width:380px; text-align:center;">
                <h1 style="color:var(--accent); letter-spacing:8px; font-size:2.2rem; margin-bottom:40px;">SITUATION ROOM</h1>
                <p style="font-size:0.7rem; opacity:0.5; margin-bottom:30px; text-transform:uppercase; letter-spacing:2px;">Credential Verification Required</p>
                <input id="username" placeholder="NAME / CODENAME"><input id="pin" type="password" placeholder="ACCESS PIN">
                <input id="class-code" placeholder="CLASS CODE (e.g. PER-01)">
                <button class="btn" style="text-align:center; background:var(--accent); color:#000; font-weight:bold; width:100%; margin-top:20px;" onclick="login()">AUTHORIZE ACCESS</button>
            </div>
            
            <div id="lobby-step" style="width:420px; display:none; text-align:left;">
                <h3 style="color:var(--accent); letter-spacing:3px; border-bottom:1px solid #333; padding-bottom:10px; margin-bottom:20px;">ACTIVE DOSSIERS</h3>
                <div id="mission-list"></div>
                <div style="margin-top:30px; padding:25px; background:rgba(0,0,0,0.5); border:1px solid #333;">
                    <p style="font-size:0.6rem; color:#666; text-transform:uppercase; letter-spacing:1px; margin-bottom:15px; text-align:center;">Manual Capsule Injection</p>
                    <input id="mission-code" placeholder="MISSION CODE" style="text-align:center; letter-spacing:5px;"><button class="btn" style="background:#fff; color:#000; width:100%;" onclick="joinMission()">INITIALIZE MISSION</button>
                </div>
            </div>

            <div id="ref-modal">
                <div id="mission-title-big">MISSION_ID</div>
                <div id="ref-title">MISSION BRIEFING</div>
                <div class="briefing-dossier">
                    <div id="debrief-panel" style="display:none; background:#000; padding:20px; border-left:4px solid var(--accent); margin-bottom:20px; font-size:0.8rem;"></div>
                    <div id="ref-narrative"></div>
                    <div id="ref-q" style="margin-top:20px; border-top:1px solid #333; padding-top:20px;"></div>
                    <textarea id="ref-a" style="margin-top:10px;"></textarea>
                    <div id="ref-wc" class="word-count"></div>
                </div>
                <button id="ref-btn" class="btn" style="background:var(--accent); color:#000; text-align:center; width:100%; max-width:400px; font-weight:bold; margin-top:30px; padding:20px; box-shadow:0 0 30px rgba(0,0,0,0.5);" onclick="nextRef()">CONFIRM AND LAUNCH</button>
            </div>
        </div>
    </div>

    <nav class="sidebar">
        <div id="m-header" class="mission-header">ARCHIVE LOG</div>
        <div id="p-tracker" style="font-size:0.6rem; opacity:0.7; color:var(--accent); letter-spacing:1px; margin-bottom:20px;">0/18 EVIDENCE POINTS</div>
        <div id="nav-container" class="nav-container"></div>
        <button class="btn" onclick="toggleGlossary()" style="margin-top:20px; border-color:var(--accent); font-size:0.7rem; text-align:center; background:transparent;">OPEN INTELLIGENCE GLOSSARY</button>
    </nav>
    <main class="main"><div id="card-container" class="card-container"></div></main>
    <footer class="footer">
        <div id="f-left">SITUATION ROOM PROTOCOL | v60.3</div>
        <div id="f-right">CLASSROOM SIM ARCHITECT | OPEN-SOURCE LICENSE</div>
    </footer>

    <script>
        window.DATA = null; let user = { id:null, name:null, pin:null, missions:{} };
        let currentMission = null; let refMode = "pre"; let refIdx = 0; let missionsAvailable = [];

        async function login() {
            const name = document.getElementById('username').value.trim(); 
            const pin = document.getElementById('pin').value.trim();
            const classCode = document.getElementById('class-code').value.trim().toUpperCase() || "DEFAULT";
            if(!name || !pin) return;
            document.getElementById('loading-screen').style.display='flex';
            const res = await fetch(API_URL, { method:'POST', body:JSON.stringify({ action:'fetch_user', name:name, pin:pin, classCode:classCode }) });
            const j = await res.json();
            if(j.status === "success") { 
                user = { id:j.id, name:name, pin:pin, missions:j.missions }; 
                const mRes = await fetch(API_URL + "?action=list_missions");
                const mData = await mRes.json();missionsAvailable = mData.missions;
                showLobby();
            } else alert(j.message);
            document.getElementById('loading-screen').style.display='none';
        }

        function showLobby() {
            document.getElementById('login-step').style.display='none'; document.getElementById('lobby-step').style.display='block';
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

        async function joinMission() { const code = document.getElementById('mission-code').value.trim().toUpperCase(); if(code) launch(code); }

        async function launch(id) {
            document.getElementById('loading-screen').style.display='flex';
            try {
                const r = await fetch(API_URL + "?action=fetch_content&id=" + id); const j = await r.json();
                if(j.status === "error") throw new Error(j.message);
                
                // SCHEMA NORMALIZER v60.4
                // (Normalizer logic handles missing titles, tabs, and fonts)
                let data = j.data;
                if(data.exhibits && !data.slides) data.slides = data.exhibits;
                if(data.meta && !data.metadata) data.metadata = data.meta;
                if(data.theme && data.theme.primaryColor && !data.theme.accent) data.theme.accent = data.theme.primaryColor;
                
                // TAB & TITLE NORMALIZER
                if(data.slides) {
                    data.slides.forEach(s => {
                        if(!s.shortTitle && s.title) s.shortTitle = s.title;
                        if(!s.longTitle && s.shortTitle) s.longTitle = s.shortTitle;
                        if(Array.isArray(s.tabs)) {
                            const newTabs = {};
                            s.tabs.forEach((t, idx) => {
                                const labels = ['primary', 'legal', 'intel'];
                                const key = t.label ? t.label.split(":")[0].trim().toLowerCase() : labels[idx] || `tab_${idx}`;
                                newTabs[key] = { body: t.content || t.body, image: t.imageURL || t.image, credit: t.credit || 'FIELD RECORD' };
                            });
                            s.tabs = newTabs;
                        }
                    });
                }

                window.DATA = data; currentMission = id; user.state = user.missions[id] || { last:0, ans:{}, dec:{}, rat:{} };
                applyTheme(); initParticles(); renderGlossary();
                document.getElementById('loading-screen').style.display='none';
                if(!user.state.preDone) startRef("pre"); else { document.getElementById('splash').style.display='none'; init(); }
            } catch(e) { console.error(e); alert(e.message); document.getElementById('loading-screen').style.display='none'; }
        }

        function applyTheme() {
            const t = window.DATA.theme; document.documentElement.style.setProperty('--accent', t.accent);
            document.documentElement.style.setProperty('--font-p', t.fontP); document.documentElement.style.setProperty('--font-h', t.fontH);
            if(t.splashHeroURL) { 
                const s = document.getElementById('splash'); s.style.backgroundImage = `url('${t.splashHeroURL}')`; 
                s.style.backgroundSize = "cover"; s.style.backgroundPosition = "center";
            }
            const m = window.DATA.metadata || {};
            document.getElementById('m-header').innerText = m.title || "ARCHIVE LOG";
            document.getElementById('f-left').innerText = `${m.title || currentMission} | ${m.author || 'FIELD COMMAND'}`;
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

        function startRef(m) { refMode = m; refIdx = 0; document.getElementById('lobby-step').style.display='none'; document.getElementById('ref-modal').style.display='flex'; renderRef(); }
        function renderRef() {
            const qs = window.DATA.reflections[refMode] || []; 
            const narrative = window.DATA.reflections[refMode + "_narrative"] || "NO BRIEFING DATA RECORDED.";
            const mTitle = (window.DATA.metadata && window.DATA.metadata.title) ? window.DATA.metadata.title : currentMission;
            
            document.getElementById('ref-title').innerText = refMode === 'pre' ? 'INITIAL BRIEFING' : 'MISSION DEBRIEF';
            document.getElementById('mission-title-big').innerText = mTitle;
            
            if(refMode === 'pre') { 
                document.getElementById('ref-q').style.display = 'none';
                document.getElementById('ref-a').style.display = 'none';
                document.getElementById('ref-btn').innerText = 'INITIALIZE MISSION';
            } else { 
                document.getElementById('ref-q').style.display = 'block';
                document.getElementById('ref-a').style.display = 'block';
                document.getElementById('ref-btn').innerText = 'SUBMIT TO RECORD';
            }
            
            document.getElementById('ref-narrative').innerHTML = parseMD(narrative);
            if(refMode === 'post' && refIdx === 0) renderDebrief(); else document.getElementById('debrief-panel').style.display='none';
            
            if(qs.length > 0 && qs[refIdx]) {
                document.getElementById('ref-q').innerText = qs[refIdx];
                document.getElementById('ref-q').style.display = 'block';
            } else if (refMode === 'pre') {
                document.getElementById('ref-q').style.display = 'none';
            } else {
                document.getElementById('ref-q').innerText = "END OF LOG. No further questions required.";
                document.getElementById('ref-a').style.display = 'none';
            }
            document.getElementById('ref-a').value = (user.state.ans && user.state.ans[refMode+"_"+refIdx]) || "";
        }
        
        function renderDebrief() {
            const d = document.getElementById('debrief-panel'); d.style.display='block';
            let h = `<h3 style="color:var(--accent); margin-top:0; font-size:0.7rem; letter-spacing:2px;">INTERNAL LOG SUMMARY</h3>`;
            window.DATA.slides.forEach((s,i) => { h += `<div style="margin-bottom:8px;"><strong>${i+1}</strong>: ${user.state.dec[i] || 'PENDING'}</div>`; });
            d.innerHTML = h;
        }

        async function nextRef() {
            if(refMode === 'post') {
                const a = document.getElementById('ref-a').value; if(!a) return alert("Response required.");
                user.state.ans[refMode+"_"+refIdx] = a; refIdx++;
                if(refIdx >= window.DATA.reflections[refMode].length) { alert("Log finalized."); } else { renderRef(); save(); }
            } else {
                user.state.preDone = true; document.getElementById('splash').style.display='none'; save(); init();
            }
        }

        function init() { 
            if(!window.DATA || !window.DATA.slides) {
                document.getElementById('card-container').innerHTML = "<div style='padding:50px; text-align:center; color:var(--accent); letter-spacing:2px;'>[ERROR] MISSION DATA CORRUPTED OR INCOMPATIBLE.</div>";
                return;
            }
            renderNav(); updateProgress(); 
            let idx = user.state.last || 0; 
            go(idx); 
        }
        function updateProgress() {
            if(!window.DATA || !window.DATA.slides) return;
            let filed = 0; window.DATA.slides.forEach((_,i) => { if(user.state.dec[i]) filed++; });
            document.getElementById('p-tracker').innerText = `${filed}/${window.DATA.slides.length} EVIDENCE POINTS FILED`;
        }
        function renderNav() {
            const c = document.getElementById('nav-container'); c.innerHTML="";
            if(!window.DATA || !window.DATA.slides) return;
            window.DATA.slides.forEach((s,i)=>{
                const isLocked = i > 0 && (!user.state.dec || !user.state.dec[i-1]);
                const b=document.createElement('button'); 
                b.className="btn" + (isLocked ? " locked" : ""); 
                b.style.marginBottom="10px"; b.style.width="100%"; b.style.textAlign="left"; b.style.padding="15px";
                if(user.state.dec && user.state.dec[i]) b.style.borderLeft = "5px solid var(--accent)";
                b.innerHTML=`<span style="opacity:0.4; font-size:0.6em; text-transform:uppercase; letter-spacing:1px;">EXHIBIT 0${i+1}</span><br>${s.shortTitle || 'UNTITLED'}`;
                if(!isLocked) b.onclick=()=>go(i); c.appendChild(b); b.id=`btn-${i}`;
            });
        }

        function go(i) {
            if(!window.DATA || !window.DATA.slides || !window.DATA.slides[i]) return;
            const s = window.DATA.slides[i]; user.state.last = i; updateProgress();
            document.querySelectorAll('.sidebar .btn').forEach(b=>b.classList.remove('active'));
            if(document.getElementById(`btn-${i}`)) document.getElementById(`btn-${i}`).classList.add('active');
            
            document.getElementById('card-container').innerHTML = `
                <div class="card active">
                    <div class="exhibit-frame">
                        <div id="exhibit-left" class="exhibit-left"></div>
                        <div class="exhibit-right">
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
            tab(document.querySelector('.tab'), 'primary');
            renderInteraction(s,i);
            save();
            window.scrollTo({top:0, behavior:'smooth'});
        }

        function parseMD(text) {
            if(!text) return "";
            return text
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
        }

        function tab(el, tName) {
            document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); el.classList.add('active');
            const s = window.DATA.slides[user.state.last]; const c = s.tabs[tName];
            let img = c.image || ""; let credit = c.credit || 'UNREDACTED RECORD';
            if(img.includes(",")) { const p = img.split(","); img = p[0].trim(); credit = p[1].trim(); }
            
            document.getElementById('exhibit-left').innerHTML = img ? `<img src="${img}"><div class="img-label">${credit}</div>` : `<div style="padding:40px; color:#333;">NO IMAGE DATA</div>`;
            document.getElementById('tab-scroll').innerHTML = `<h2>${tName.toUpperCase()} ANALYSIS</h2><div>${parseMD(c.body)}</div>`;
            document.getElementById('tab-scroll').scrollTop = 0;
        }

        function renderInteraction(s,i) {
            const dec = user.state.dec[i], rat = user.state.rat[i];
            let h = `<h3>EXHIBIT 0${i+1} COMMAND PROTOCOL</h3><div class="interaction-prompt">${s.interactionPrompt}</div>`;
            if(rat) {
                h += `<div style="background:rgba(255,255,255,0.05); padding:20px; border-left:4px solid var(--accent); margin-bottom:20px;">
                        <strong style="color:var(--accent); font-size:0.7rem; text-transform:uppercase;">COMMAND LOG DATA</strong><br>
                        <p style="margin-top:10px; font-size:1rem; opacity:0.8; font-family:var(--font-p);">${rat}</p>
                      </div>`;
            } else {
                h += `<strong>FIELD ANALYSIS (Cite evidence):</strong>
                      <textarea id="rat-i" oninput="document.getElementById('wc-i').innerText = (this.value.trim().split(/\\s+/).length) + ' / 50 words'"></textarea>
                      <div id="wc-i" class="word-count">0 / 50 words</div>`;
            }
            h += `<div class="choice-row">`;
            s.options.forEach(o => { 
                const sel = dec === o; 
                h += `<button class="btn ${sel?'active':''}" ${dec?'disabled':''} onclick="decide(${i},'${o}')">${o}</button>`; 
            });
            h += `</div>`;
            document.getElementById('interaction-z').innerHTML = h;
        }

        function decide(i,l) {
            const r = document.getElementById('rat-i')?.value; 
            if(!r || r.trim().split(/\s+/).length < 50) return alert("Formal analysis (min 50 words) required before decision.");
            user.state.rat[i] = r; user.state.dec[i] = l; 
            save(); renderNav(); go(i);
            if(i === window.DATA.slides.length-1) setTimeout(() => startRef("post"), 1000);
        }

        async function save() { if(user.id && currentMission) await fetch(API_URL, { method:'POST', body:JSON.stringify({ action:'save_state', id:user.id, missionId:currentMission, state:user.state }) }); }
        async function initParticles() { await tsParticles.load("tsparticles", { particles: { number: { value: 30 }, size: { value: 2 }, move: { speed: 0.5 }, opacity: { value: 0.3 } } }); }
    </script>
</body>
</html>
```

### **TEMPLATE C: Teacher Mode (teachermode.html)**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"><title>MISSION CONTROL // TEACHER MODE</title>
    <script>const URL = "[[INJECT_URL_NOW]]"; const PIN = "[[INJECT_PIN_NOW]]";</script>
    <style>
        :root { --bg: #f4f4f4; --accent: #222; --success: #28a745; --err: #dc3545; --terminal: #000; --term-txt: #0f0; }
        body { font-family: 'Courier New', monospace; padding: 40px; background: var(--bg); color: #333; margin: 0; }
        #status-bar { background: #1a1a1a; color: #fff; padding: 15px 25px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; border-bottom: 5px solid var(--accent); }
        .status-light { height: 12px; width: 12px; border-radius: 50%; background: #666; display: inline-block; margin-right: 10px; }
        .status-light.online { background: var(--success); box-shadow: 0 0 10px var(--success); }
        .status-light.offline { background: var(--err); box-shadow: 0 0 10px var(--err); }
        h1 { text-transform: uppercase; letter-spacing: 5px; border-bottom: 2px solid var(--accent); padding-bottom: 10px; margin-bottom: 30px; font-size: 1.5rem; }
        #console { background: var(--terminal); color: var(--term-txt); padding: 15px; height: 180px; overflow-y: auto; font-size: 0.8rem; border: 1px solid #333; margin-bottom: 30px; }
        .panel { background: #fff; padding: 30px; border: 1px solid #ddd; border-top: 5px solid var(--accent); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 30px; }
        input, textarea { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ccc; font-family: inherit; box-sizing: border-box; }
        .btn { background: var(--accent); color: #fff; border: none; padding: 15px 25px; cursor: pointer; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; width: 100%; transition: 0.2s; }
        .btn:hover { background: #444; }
        .btn-del { color: var(--err); cursor: pointer; font-weight: bold; font-size: 0.6rem; text-decoration: underline; border: none; background: none; padding: 0; }
        .btn-del:hover { color: #8b0000; }
        table { width:100%; border-collapse:collapse; margin-top:20px; }
        th, td { padding:12px; border-bottom:1px solid #eee; text-align:left; font-size:0.75rem; vertical-align: middle; }
        th { background:var(--accent); color:#fff; text-transform:uppercase; font-size:0.6rem; letter-spacing:1px; }
        .thumb { width:46px; height:46px; background-size:cover; background-position:center; border-radius:4px; border:1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        label { font-size: 0.6rem; color: #888; text-transform: uppercase; margin-bottom: 5px; display: block; font-weight: bold; }
    </style>
</head>
<body>
    <div id="status-bar">
        <div><span id="s-light" class="status-light"></span> <span id="s-text" style="letter-spacing: 2px;">VINTAGE_LINK_OFFLINE</span></div>
        <div style="font-size: 0.7rem; opacity: 0.7;">TEACHER MODE // v59.3</div>
    </div>
    <h1 style="margin: 0 40px 30px 40px;">COMMAND CENTER // MISSION CONTROL</h1>
    <div class="grid" style="grid-template-columns: 1fr 1.5fr 1fr; padding: 0 40px;">
        <div class="panel">
            <h3 style="margin-top:0; letter-spacing:2px; font-size:0.8rem; border-bottom:1px solid #ddd; padding-bottom:10px;">CAPSULE INJECTION</h3>
            <div id="upload-zone" style="border:2px dashed #ccc; padding:20px; text-align:center; margin-bottom:20px; cursor:pointer;" onclick="document.getElementById('file-input').click()">
                <div style="font-size:1.5rem; margin-bottom:5px;">📁</div>
                <div style="font-size:0.5rem; color:#666; font-weight:bold;">LOAD .BLOB CAPSULE</div>
                <input type="file" id="file-input" accept=".blob" style="display:none" onchange="handleFile(this.files[0])">
            </div>
            <label>Mission ID</label><input id="m-id" placeholder="e.g. CUBA62">
            <label>Public Name</label><input id="m-name" placeholder="Operation Anadyr">
            <label>Raw Payload</label><textarea id="json-input" style="height: 60px; font-size:0.6rem;" placeholder="..."></textarea>
            <button class="btn" style="padding:10px; font-size:0.75rem;" onclick="upload()">INITIALIZE ARCHIVE</button>
        </div>

        <div class="panel">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #ddd; padding-bottom:10px; margin-bottom:20px;">
                <h3 style="margin:0; letter-spacing:2px; font-size:0.8rem;">LIVE PROGRESS BOARD</h3>
                <div id="sync-tick" style="font-size:0.55rem; color:#888;">[SYNC_IDLE]</div>
            </div>
            <div style="margin-bottom:15px; display:flex; gap:10px;">
                <select id="class-filter" style="flex:1; padding:8px; font-family:inherit; font-size:0.75rem;" onchange="renderProgress()"><option value="ALL">ALL CLASSES</option></select>
                <button class="btn" style="width:auto; padding:0 15px; font-size:0.6rem;" onclick="fetchProgress()">REFRESH</button>
            </div>
            <div id="progress-list" style="max-height:500px; overflow-y:auto; border:1px solid #eee;"></div>
        </div>

        <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="panel" style="padding:20px; background:var(--terminal); border-top:none;">
                <h3 style="margin-top:0; color:#fff; font-size:0.6rem; letter-spacing:1px; opacity:0.6;">SYSTEM LOG</h3>
                <div id="console" style="height:150px; overflow-y:auto; font-size:0.65rem; color:var(--term-txt);"></div>
            </div>
            <div class="panel" style="flex:1;">
                <h3 style="margin-top:0; letter-spacing:2px; font-size:0.8rem; border-bottom:1px solid #ddd; padding-bottom:10px;">LIVE DIRECTORY</h3>
                <div id="lib-log" style="font-size: 0.55rem; color: #888; margin-bottom: 10px;">Scanning...</div>
                <div id="library-list"></div>
            </div>
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

        function log(m, t="info") {
            const c = document.getElementById('console'); const color = t==="success"?"lime":t==="error"?"red":"#0f0";
            if(!c) return;
            c.innerHTML += `<div style="color:${color}">[${new Date().toLocaleTimeString()}] ${m}</div>`;
            c.scrollTop = c.scrollHeight;
        }
        function setStatus(s, t) { document.getElementById('s-light').className = "status-light "+s; document.getElementById('s-text').innerText = t; }
        
        async function fetchMissions() {
            log("Pinging Archive Server...");
            try {
                const res = await fetchWithTimeout(URL + "?action=list_missions");
                if(!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                const j = await res.json();
                if(j.status === "success") {
                    setStatus("online", "ENCRYPTED_LINK_ACTIVE");
                    renderMissions(j.missions); fetchProgress();
                    log("Handshake successful. Directory synchronized.", "success");
                } else { throw new Error(j.message || "Unknown server error"); }
            } catch(e) { 
                setStatus("offline", "CONNECTION_FAILURE"); 
                log(`CRITICAL: ${e.message}`, "error");
                log("HINT: Ensure the Apps Script URL and TEACHER_PIN are correctly configured.");
                renderMissions([]); // Show empty table so UI isn't empty
            }
        }
        
        async function upload() {
            const id = document.getElementById('m-id').value.toUpperCase().replace(/\s/g, ''), name = document.getElementById('m-name').value, raw = document.getElementById('json-input').value;
            if(!id || !name || !raw) return log("ABORTED: Missing required parameters.", "error");
            log(`Opening stream for Capsule [${id}]...`);
            try {
                const res = await fetch(URL, { method:'POST', body:JSON.stringify({ action:'update_content', pin:PIN, id:id, name:name, payload: JSON.parse(raw) }) });
                const j = await res.json();
                if(j.status === "success") { 
                    log("CAPSULE COMMITTED TO RECORD.", "success"); 
                    document.getElementById('m-id').value = ""; document.getElementById('m-name').value = ""; document.getElementById('json-input').value = "";
                    fetchMissions(); 
                } else log(j.message, "error");
            } catch(e) { log(e.message, "error"); }
        }

        function handleFile(file) {
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    document.getElementById('m-id').value = data.missionId || "";
                    document.getElementById('m-name').value = (data.metadata && data.metadata.title) ? data.metadata.title : "";
                    document.getElementById('json-input').value = e.target.result;
                    log(`Capsule [${file.name}] loaded into staging.`, "success");
                    document.getElementById('upload-zone').style.borderColor = "var(--success)";
                } catch(ex) { log("INVALID CAPSULE: Not a valid .blob/JSON file.", "error"); }
            };
            reader.readAsText(file);
        }

        async function fetchProgress() {
            document.getElementById('sync-tick').innerText = "[SYNC_BUSY]";
            try {
                const res = await fetchWithTimeout(URL, { method:'POST', body:JSON.stringify({ action:'fetch_progress', pin:PIN }) });
                const j = await res.json();
                if(j.status === "success") {
                    allProgress = j.progress;
                    updateClassFilter(); renderProgress();
                    document.getElementById('sync-tick').innerText = "[SYNC_OK]";
                    setTimeout(() => document.getElementById('sync-tick').innerText = "[SYNC_IDLE]", 3000);
                }
            } catch(e) { 
                log("Progress sync failed: " + e.message, "error"); 
                document.getElementById('sync-tick').innerText = "[SYNC_FAIL]";
            }
        }

        function updateClassFilter() {
            const f = document.getElementById('class-filter'); const val = f.value;
            const classes = [...new Set(allProgress.map(p => p.class))].sort();
            let h = `<option value="ALL">ALL CLASSES</option>`;
            classes.forEach(c => { h += `<option value="${c}">${c}</option>`; });
            f.innerHTML = h; if(f.innerHTML.includes(val)) f.value = val;
        }

        function renderProgress() {
            const filter = document.getElementById('class-filter').value;
            const filtered = filter === "ALL" ? allProgress : allProgress.filter(p => p.class === filter);
            let h = "";
            filtered.forEach(p => {
                const missions = Object.keys(p.missionData);
                missions.forEach(mid => {
                    const st = p.missionData[mid]; if(!st) return;
                    const decs = st.dec ? Object.keys(st.dec).length : 0;
                    const pre = st.preDone ? "✓" : "×";
                    h += `<div style="padding:10px; border-bottom:1px solid #eee; font-size:0.7rem;">
                            <div style="display:flex; justify-content:space-between;">
                                <strong>${p.name}</strong> <span style="color:#888;">${p.class}</span>
                            </div>
                            <div style="color:#666; margin-top:5px;">MISSION: ${mid} | STEP: ${decs} | BRIEF: ${pre}</div>
                          </div>`;
                });
            });
            document.getElementById('progress-list').innerHTML = h || "<p style='color:#ccc; padding:20px;'>No student data detected.</p>";
        }

        async function deleteMission(id) {
            if(!confirm(`PERMANENT DELETION: Are you sure you want to scrub mission [${id}] from the record?`)) return;
            log(`DELETING CAPSULE [${id}]...`);
            try {
                const res = await fetch(URL, { method:'POST', body:JSON.stringify({ action:'delete_content', pin:PIN, id:id }) });
                const j = await res.json();
                if(j.status === "success") { log("CAPSULE DELETED.", "success"); fetchMissions(); } else log(j.message, "error");
            } catch(e) { log(e.message, "error"); }
        }
        
        function renderMissions(ms) {
            document.getElementById('lib-log').innerText = `${ms.length} Capsules Detected.`;
            let h = "<table><tr><th>Visual</th><th>Dossier Name</th><th>ID</th><th>Action</th></tr>";
            ms.forEach(m => { 
                const thumb = m.thumb || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1000&auto=format&fit=crop";
                h += `<tr>
                        <td><div class="thumb" style="background-image:url('${thumb}')"></div></td>
                        <td><strong>${m.name}</strong></td>
                        <td><code>${m.id}</code></td>
                        <td><button class="btn-del" onclick="deleteMission('${m.id}')">SCRUB RECORD</button></td>
                      </tr>`; 
            });
            document.getElementById('library-list').innerHTML = (ms.length > 0) ? h + "</table>" : "<p style='color:#ccc; padding:20px;'>No missions found.</p>";
        }
        
        // FAILSAFE: Ensure UI renders even if handshake is slow
        window.onload = () => {
            log("BOOT SEQUENCE INITIATED...");
            fetchMissions();
            setInterval(fetchProgress, 30000);
        };
    </script>
</body>
</html>
```
