import express from 'express';
import cors from 'cors';
import { coordinator } from './src/agents/coordinator.js';
import "dotenv/config";
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Mock DB paths
const USERS_FILE = path.join(process.cwd(), 'users.json');
const TASKS_FILE = path.join(process.cwd(), 'tasks.json');

// Helper to read/write JSON files
const readJSON = (file, defaultVal = []) => {
    if (!fs.existsSync(file)) return defaultVal;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const writeJSON = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

app.use(cors());
app.use(express.json());

// Serve static frontend files (index.html, style.css, app.js)
app.use(express.static(process.cwd()));

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'login.html'));
});

// Authentication Endpoints
app.post('/api/auth/signup', (req, res) => {
    const { email, password, fullName } = req.body;
    const users = readJSON(USERS_FILE);
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: "User already exists" });
    }

    const newUser = { id: Date.now(), email, password, fullName, sensitivity: 'medium' };
    users.push(newUser);
    writeJSON(USERS_FILE, users);
    
    res.json({ success: true, user: { id: newUser.id, email, fullName } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    
    res.json({ success: true, user: { id: user.id, email: user.email, fullName: user.fullName, sensitivity: user.sensitivity } });
});

// User Settings Update
app.post('/api/user/settings', (req, res) => {
    const { userId, sensitivity } = req.body;
    const users = readJSON(USERS_FILE);
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) return res.status(404).json({ error: "User not found" });
    
    users[userIndex].sensitivity = sensitivity;
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

// Tasks Endpoints (User-specific)
app.get('/api/tasks/:userId', (req, res) => {
    const { userId } = req.params;
    const allTasks = readJSON(TASKS_FILE, {});
    res.json(allTasks[userId] || []);
});

app.post('/api/tasks/:userId', (req, res) => {
    const { userId } = req.params;
    const task = { ...req.body, id: Date.now() };
    const allTasks = readJSON(TASKS_FILE, {});
    
    if (!allTasks[userId]) allTasks[userId] = [];
    allTasks[userId].push(task);
    
    writeJSON(TASKS_FILE, allTasks);
    res.json(task);
});

app.delete('/api/tasks/:userId/:taskId', (req, res) => {
    const { userId, taskId } = req.params;
    const allTasks = readJSON(TASKS_FILE, {});
    
    if (allTasks[userId]) {
        allTasks[userId] = allTasks[userId].filter(t => t.id != taskId);
        writeJSON(TASKS_FILE, allTasks);
    }
    res.json({ success: true });
});

app.post('/api/tasks/seed', (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "No userId provided" });

    const allTasks = readJSON(TASKS_FILE, {});
    
    allTasks[userId] = [
        { id: Date.now() + 1, title: "Field Visit: MTH Road Construction", timeSlot: "morning", priority: "high", location: "outdoor", category: "Work", statusNote: "Requires clear skies" },
        { id: Date.now() + 2, title: "Outdoor Safety Inspection", timeSlot: "afternoon", priority: "medium", location: "outdoor", category: "Work" },
        { id: Date.now() + 3, title: "Internal Team Briefing", timeSlot: "morning", priority: "medium", location: "indoor", category: "Work" },
        { id: Date.now() + 4, title: "Grocery Stockup (Pre-Rain)", timeSlot: "evening", priority: "high", location: "outdoor", category: "Personal" },
        { id: Date.now() + 5, title: "Exercise & Wellness Hub", timeSlot: "morning", priority: "low", location: "indoor", category: "Health" },
    ];
    
    writeJSON(TASKS_FILE, allTasks);
    res.json({ success: true, message: "Database seeded successfully!" });
});

// Notes Endpoint (Simple fallback for historical context)
app.get('/api/notes', (req, res) => {
    res.json([
        "Heavy rain often causes delays on MTH Road.",
        "Outdoor activities are best planned for early morning in July.",
        "Monsoon winds usually pick up after 4 PM in the city center."
    ]);
});

app.delete('/api/tasks/clear/:userId', (req, res) => {
    const { userId } = req.params;
    const allTasks = readJSON(TASKS_FILE, {});
    
    if (allTasks[userId]) {
        allTasks[userId] = [];
        writeJSON(TASKS_FILE, allTasks);
    }
    
    res.json({ success: true, message: "Schedule wiped clean." });
});

// Main Agent Execution Endpoint
app.post('/api/agents/execute', async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: "Missing 'prompt' in request body." });
    }

    try {
        console.log(`[API] Triggered execution: ${prompt}`);
        const agentResponse = await coordinator.executeTask(prompt);
        res.json({ status: "success", response: agentResponse });
    } catch (error) {
        console.error("[API] Execution error:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});

// Start the server
const server = app.listen(PORT, () => {
    console.log(`[API] Multi-Agent System running at http://localhost:${PORT}`);
});

// We need an unhandled rejection handler to gracefully collapse things
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
