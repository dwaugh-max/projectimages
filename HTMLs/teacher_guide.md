# Teacher's Guide: Decision Desk (v48.0 Knowledge-First)

Welcome to the **"Situation Room"** platform. This guide explains the shift to high-rigor inquiry and how to manage your simulations.

## 🏛️ The Situation Room Standard: Inquiry First
We have retired the "game" model in favor of an **Administrative Investigation** model. 
- **Knowledge-First Architecture**: Baseline code is now separated from mission content. The system retrieves master templates from a central Knowledge Archive, ensuring maximum stability and future-proof updates.
- **The DBQ Core Loop**: Every mission is a digital "Document-Based Question." Students analyze evidence across three tabs (**Primary Source**, **Legal Context**, **Intelligence Brief**) to cross-reference facts and identify contradictions.
- **Evidence Filing**: Students don't just "play." They are required to "file" a **50-100 word rationale** for every decision, citing specific evidentiary points from the archives to advance.
- **Authentication Hardening**: Student logins are protected by Teacher-Provisioned **6-digit PINs**, managed directly through your roster dashboard.
- **The Sentinel Protocol (Stage-Locking)**: Students cannot skip ahead. Every decision must be filed and rationale provided before the next exhibit unlocks.
- **QA Mode (Test Mode)**: Teachers can toggle "QA MODE" in the capsule manager to preview simulations without saving data to the student performance stream.
- **Exhibit Preview**: Instantly view the structure and interaction prompts of a Mission Capsule before initialization.

## 🎓 The Student Experience: Three-Stage Flow
1. **Identification (Login)**: Students log in with their Name and PIN.
2. **The Lobby (Active Missions)**: A persistent hub where students manage multiple active roles simultaneously.
3. **The Simulation (Investigation)**: The high-fidelity dossier interface where students acting as historical officials (e.g., commanders, ministers) make decisions "for the record."

## 🚀 Deployment: Sheets-First Protocol
The platform is hosted via **Google Sheets** for maximum ease of management.
1. **The Brain (Backend)**:
   - Create a New Google Sheet.
   - Go to **Extensions > Apps Script**.
   - Paste the provided `Code.gs`.
   - Click **Deploy > New Deployment > Web App**.
   - Copy the **Web App URL**.
2. **One Server, Many Stories**:
   - You only need to perform the backend setup **once**.
   - Your single Archive Sheet can host **unlimited missions**.
   - When the Gem asks, simply provide your existing Web App URL to skip the technical setup and proceed directly to research.
3. **The Shell (Frontend)**:
   - Host the provided `index.html` and `teacher_admin.html` (e.g., via GitHub Pages or local server).
   - Enter your Web App URL and Teacher PIN into the dashboard.

## 🛠️ Mission Control: Your Dashboard
Your `teacher_admin.html` dashboard provides:
1. **Capsule Manager**: Import/Export missions instantly.
2. **Active Missions**: See your library of 8-letter join codes.
3. **Student Roster**: Manage 6-digit PINs and reset student access.
4. **Student Stream**: Live feed of rationales and decisions.

## 🤖 AI Feedback Setup (Optional)
The platform supports **AI-powered debrief analysis** using Google's Gemini API (free tier).

### Getting Your API Key (5 minutes)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **"Get API Key"** in the left sidebar
4. Click **"Create API Key"** → Select any project
5. Copy the key

### Installing the Key
1. Open your Google Sheet → **Extensions > Apps Script**
2. Find line 84: `const API_KEY = "[[INJECT_GEMINI_KEY]]";`
3. Replace `[[INJECT_GEMINI_KEY]]` with your actual key
4. Save and redeploy

### Free Tier Limits
| Limit | Amount |
|-------|--------|
| Requests/minute | 15 |
| Requests/day | 1,500 |

This is ample for classroom use (30 students × 3 analyses = 90 requests/period).

**Your classroom is now an Archive of Decision.** 🦾🏛️⚖️
