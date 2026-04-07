import "dotenv/config";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { mcpClient } from "../mcp/mcpClient.js";

// Ensure Gemini API key is set
if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY in .env");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "mock-key-for-now");

// Define Gemini tool declarations mapping to our MCP tools
const schedulerTools = [
  {
    name: "get_tasks",
    description: "Retrieve all tasks from the database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "add_task",
    description: "Add a new task to the database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: "The title or description of the task",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "get_live_weather",
    description: "Fetch live weather data from open-meteo API for a given location",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        city: {
          type: SchemaType.STRING,
          description: "Name of the city (e.g. 'Bangalore', 'Mumbai')"
        }
      },
      required: ["city"]
    }
  },
  {
    name: "get_calendar_events",
    description: "Retrieve calendar events for today.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "add_note",
    description: "Add a note to the workspace.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        content: {
          type: SchemaType.STRING,
          description: "The content of the note",
        },
      },
      required: ["content"],
    },
  }
];

export class CoordinatorAgent {
  constructor() {
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [{ functionDeclarations: schedulerTools }]
    });
  }

  async executeTask(userPrompt) {
    console.log(`[Coordinator] Received request: ${userPrompt}`);
    await mcpClient.connect();

    const chat = this.model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: "You are the primary coordinator agent of the MonsoonFlow Scheduler. You manage tasks and calendar events using external tools." }]
            },
            {
                role: "model",
                parts: [{ text: "I am ready." }]
            }
        ]
    });

    try {
        let result = await chat.sendMessage(userPrompt);
        let response = result.response;
        
        // Handle multi-step workflow via tool calls
        let maxLoops = 5;
        let loopCount = 0;

        while (response.functionCalls() && loopCount < maxLoops) {
            const calls = response.functionCalls();
            const functionResponses = [];

            for (const call of calls) {
                console.log(`[Coordinator] Calling MCP tool: ${call.name} with args:`, call.args);
                try {
                    // Call the actual underlying MCP Tool
                    const toolResult = await mcpClient.callTool(call.name, call.args);
                    functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: { result: toolResult }
                        }
                    });
                } catch (error) {
                    console.error(`Error calling ${call.name}:`, error);
                    functionResponses.push({
                         functionResponse: {
                             name: call.name,
                             response: { result: "Error executing tool: " + error.message }
                         }
                    });
                }
            }

            console.log(`[Coordinator] Sending tool responses back to Gemini...`);
            result = await chat.sendMessage(functionResponses);
            response = result.response;
            loopCount++;
        }

        console.log(`[Coordinator] Final Answer: ${response.text()}`);
        return response.text();

    } catch (e) {
        console.error("Agent execution failed:", e?.status, e?.message, e);
        return "Internal Error: Unable to process task. " + (e?.message || "");
    }
  }
}

export const coordinator = new CoordinatorAgent();
