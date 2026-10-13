
import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const app = express();
const port = Number(process.env.PORT || 3000);

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing from .env");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "20kb" }));

const mcp = new Client({
  name: "sanjivani-farmer-client",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "server.ts"],
});

type Farmer = {
  id: number;
  name: string;
  village: string;
  sugarcane_tons: number | string;
  amount_paid: number | string;
  payment_pending: number | string;
};

async function getFarmers(): Promise<Farmer[]> {
  const result = await mcp.callTool({
    name: "get_farmer_data",
    arguments: {},
  });

  if (result.isError) {
    const message = result.content
      .map((item) => ("text" in item ? item.text : ""))
      .join("\n");

    throw new Error(message || "MCP tool failed");
  }

  const output = result.content
    .map((item) => ("text" in item ? item.text : ""))
    .join("\n");

  const data: unknown = JSON.parse(output);

  if (!Array.isArray(data)) {
    throw new Error("MCP returned an unexpected data format");
  }

  return data as Farmer[];
}

function makeReport(farmers: Farmer[]) {
  const total = (key: keyof Farmer) =>
    farmers.reduce(
      (sum, farmer) => sum + Number(farmer[key] || 0),
      0
    );

  const highestSupply = [...farmers].sort(
    (a, b) =>
      Number(b.sugarcane_tons) - Number(a.sugarcane_tons)
  )[0];

  const highestPending = [...farmers].sort(
    (a, b) =>
      Number(b.payment_pending) - Number(a.payment_pending)
  )[0];

  return {
    farmerRecordCount: farmers.length,
    totalSugarcaneTons: total("sugarcane_tons"),
    totalPaymentDone: total("amount_paid"),
    totalPaymentPending: total("payment_pending"),
    highestSupply: highestSupply ?? null,
    highestPending: highestPending ?? null,
    pendingFarmers: [...farmers]
      .filter((farmer) => Number(farmer.payment_pending) > 0)
      .sort(
        (a, b) =>
          Number(b.payment_pending) - Number(a.payment_pending)
      ),
  };
}

// Test whether the backend is running.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Return farmer records from PostgreSQL through MCP.
app.get("/api/farmers", async (_req, res) => {
  try {
    const farmers = await getFarmers();
    res.json(farmers);
  } catch (error) {
    console.error("Farmer retrieval failed:", error);
    res.status(500).json({
      error: "Could not load farmer records",
    });
  }
});

// Return totals and payment report.
app.get("/api/report/pending", async (_req, res) => {
  try {
    const farmers = await getFarmers();
    res.json(makeReport(farmers));
  } catch (error) {
    console.error("Pending report failed:", error);
    res.status(500).json({
      error: "Could not load pending report",
    });
  }
});

// Ask a question about farmer records using OpenAI.
app.post("/api/ask", async (req, res) => {
  try {
    const question = req.body?.question;

    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.length > 1000
    ) {
      res.status(400).json({
        error: "Enter a question of up to 1000 characters",
      });
      return;
    }

    const farmers = await getFarmers();
    const report = makeReport(farmers);

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      instructions:
        "You are the Sanjivani Sugar Factory farmer-data assistant. " +
        "Answer only from the supplied database records and calculated report. " +
        "Use Indian rupees for payment amounts and tons for sugarcane. " +
        "Explain that totals count database rows, not necessarily unique farmers. " +
        "Do not assume repeated farmer names are duplicate records. " +
        "Do not invent missing data. Keep answers clear and concise.",
      input:
        `Question: ${question.trim()}\n\n` +
        `Farmer records: ${JSON.stringify(farmers)}\n\n` +
        `Calculated report: ${JSON.stringify(report)}`,
    });

    res.json({
      answer: response.output_text,
      report,
    });
  } catch (error) {
    console.error("AI request failed:", error);

    res.status(500).json({
      error:
        "The AI request failed. Check the backend terminal and API configuration.",
    });
  }
});

async function main() {
  await mcp.connect(transport);

  const { tools } = await mcp.listTools();

  console.log(
    "Available MCP tools:",
    tools.map((tool) => tool.name)
  );

  if (!tools.some((tool) => tool.name === "get_farmer_data")) {
    throw new Error("MCP tool get_farmer_data was not found");
  }

  app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error("Backend startup failed:", error);
  process.exitCode = 1;
});
