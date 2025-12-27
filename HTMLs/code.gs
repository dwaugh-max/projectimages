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
  const prompt = `You are a professional history educator evaluating a student's performance in a ${context.title} simulation.
  Student Rationales: ${JSON.stringify(rationales)}
  Evaluate on: 1. Historical Reasoning, 2. Perspective-Taking, 3. Strategic Thinking. 
  Provide a concise assessment (150 words). Format with markdown.`;
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
