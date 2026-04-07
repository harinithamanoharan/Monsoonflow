import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// Real DB paths
import fs from 'fs';
import path from 'path';
const TASKS_FILE = path.join(process.cwd(), 'tasks.json');

const readTasks = () => {
    if (!fs.existsSync(TASKS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    } catch (e) { return {}; }
};

const writeTasks = (data) => {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
};

const server = new Server(
  {
    name: "monsoonflow-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_tasks",
        description: "Retrieve all tasks from the database.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "add_task",
        description: "Add a new task to the database.",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title or description of the task",
            },
            userId: {
              type: "string",
              description: "The ID of the user (optional, defaults to first user)",
            }
          },
          required: ["title"],
        },
      },
      {
        name: "get_calendar_events",
        description: "Retrieve calendar events for today (mock tool).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_live_weather",
        description: "Fetch live weather data from open-meteo API for a given location",
        inputSchema: {
          type: "object",
          properties: {
             city: {
                type: "string",
                description: "Name of the city (e.g. 'Bangalore', 'Mumbai')"
             }
          },
          required: ["city"]
        },
      },
      {
        name: "add_note",
        description: "Add a note to the workspace.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The content of the note",
            },
          },
          required: ["content"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const allTasks = readTasks();
  // For this demo, we'll assume the first user in the system if not specified
  // In a real multi-user system, we'd pass the userId through the context
  const getFirstUserId = () => Object.keys(allTasks)[0] || "demo-user";

  switch (request.params.name) {
    case "get_tasks": {
      const userId = getFirstUserId();
      const tasks = allTasks[userId] || [];
      return {
        content: [
          {
            type: "text",
            text: `Tasks for user ${userId}: ` + JSON.stringify(tasks, null, 2),
          },
        ],
      };
    }
    case "add_task": {
      const { title, userId: providedUid } = request.params.arguments;
      const userId = providedUid || getFirstUserId();
      if (typeof title !== "string") {
        throw new McpError(ErrorCode.InvalidParams, "Invalid title");
      }
      const newTask = { 
          id: Date.now(), 
          title, 
          location: "indoor", 
          priority: "medium", 
          timeSlot: "afternoon",
          category: "Work"
      };
      
      if (!allTasks[userId]) allTasks[userId] = [];
      allTasks[userId].push(newTask);
      writeTasks(allTasks);

      return {
        content: [
          {
            type: "text",
            text: `Task added for user ${userId}: ${JSON.stringify(newTask)}`,
          },
        ],
      };
    }
    case "get_calendar_events": {
      const events = [
        { time: "10:00 AM", event: "Morning Standup" },
        { time: "02:00 PM", event: "Project Sync" },
      ];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(events, null, 2),
          },
        ],
      };
    }
    case "get_live_weather": {
      const { city } = request.params.arguments;
      try {
            // Default to Bangalore coords if asking for simple city forecast
            let lat = 12.9716, lon = 77.5946;
           if (city.toLowerCase() === 'mumbai') { lat = 19.0760; lon = 72.8777; }
           else if (city.toLowerCase() === 'delhi') { lat = 28.7041; lon = 77.1025; }

           const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation_probability`);
           const data = await response.json();
           const weather = data.current_weather;
           // Find max rain probability
           const maxRainProb = Math.max(...(data.hourly.precipitation_probability.slice(0, 12)));

           return {
             content: [
               {
                 type: "text",
                 text: `Live Weather for ${city}: ${weather.temperature}°C, Wind ${weather.windspeed} km/h. Max rain probability in next 12h is ${maxRainProb}%.`
               }
             ]
           };
      } catch (err) {
           return { content: [{ type: "text", text: `Error fetching weather: ${err.message}` }] };
      }
    }
    case "add_note": {
      const { content } = request.params.arguments;
      // Normally we'd save this to a note table. For simplicity, we just log it or return a mock success string.
      return {
        content: [
          {
            type: "text",
            text: `Note correctly stored: ${content}`,
          },
        ],
      };
    }
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
  }
});

process.on('uncaughtException', (err) => {
  console.error("UNCAUGHT EXCEPTION:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error("UNHANDLED REJECTION:", JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2));
  process.exit(1);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MonsoonFlow MCP Server running on stdio");
}

main().catch(err => {
    console.error("MAIN CATCH:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
});
