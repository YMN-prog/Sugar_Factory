
import "dotenv/config";
import { Pool } from "pg";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const db = new Pool();

const server = new McpServer({
  name: "sanjivani-farmer-server",
  version: "1.0.0",
});

server.registerTool(
  "get_farmer_data",
  {
    description:
      "Get farmer records, village names, sugarcane supplied, amount paid, and pending payments.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const result = await db.query(`
        SELECT
          id,
          name,
          village,
          sugarcane_tons,
          amount_paid,
          payment_pending
        FROM farmers
        ORDER BY sugarcane_tons DESC
      `);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              error instanceof Error
                ? error.message
                : "Database query failed",
          },
        ],
      };
    }
  }
);

void serveStdio(() => server);
