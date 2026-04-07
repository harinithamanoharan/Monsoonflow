import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "mock-key-for-now");

export class SummarizationAgent {
  constructor() {
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
  }

  async summarizeNotes(rawNotes, objective) {
    console.log(`[SubAgent: Summarization] Analyzing notes for objective: ${objective}`);
    
    const prompt = `
    You are a specialized sub-agent for Summarization.
    Below are some raw notes from the system.
    Please summarize them explicitly based on the user's objective.
    
    Objective: ${objective}
    Raw Notes:
    ${rawNotes}
    `;

    try {
        const result = await this.model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("SubAgent Error:", error);
        return "Summarization failed.";
    }
  }
}

export const summarizationAgent = new SummarizationAgent();
