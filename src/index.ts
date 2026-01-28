#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LinkedInClient } from "./linkedin-client.js";

// ─── Configuration ─────────────────────────────────────────────────

const LI_AT_COOKIE = process.env.LI_AT_COOKIE;
const JSESSIONID = process.env.JSESSIONID;

if (!LI_AT_COOKIE) {
  console.error(
    "Error: LI_AT_COOKIE environment variable is required.\n" +
      "Set it to your LinkedIn li_at session cookie value.\n" +
      "You can find it in your browser's developer tools under Application > Cookies > linkedin.com"
  );
  process.exit(1);
}

const client = new LinkedInClient({
  li_at: LI_AT_COOKIE,
  jsessionid: JSESSIONID,
});

// ─── Server Setup ──────────────────────────────────────────────────

const server = new McpServer({
  name: "linkedin-sales-navigator",
  version: "1.0.0",
});

// ─── Helper ────────────────────────────────────────────────────────

function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ─── Tools ─────────────────────────────────────────────────────────

// -- Session --

server.tool(
  "validate_session",
  "Validate that the LinkedIn session cookie is still active and working",
  {},
  async () => {
    const valid = await client.validateSession();
    return {
      content: [
        {
          type: "text",
          text: valid
            ? "Session is valid. The LinkedIn cookie is active."
            : "Session is invalid. The LinkedIn cookie may have expired. Please update LI_AT_COOKIE.",
        },
      ],
    };
  }
);

// -- Profile --

server.tool(
  "get_own_profile",
  "Get the authenticated user's own LinkedIn profile information",
  {},
  async () => {
    const result = await client.getOwnProfile();
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "get_profile",
  "Get a LinkedIn profile by public identifier (vanity URL slug, e.g. 'john-doe-123')",
  {
    public_identifier: z
      .string()
      .describe("The LinkedIn public identifier / vanity URL slug"),
  },
  async ({ public_identifier }) => {
    const result = await client.getProfile(public_identifier);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "get_profile_details",
  "Get detailed profile information including experience, education, and skills",
  {
    public_identifier: z
      .string()
      .describe("The LinkedIn public identifier / vanity URL slug"),
  },
  async ({ public_identifier }) => {
    const result = await client.getProfileDetails(public_identifier);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "get_profile_contact_info",
  "Get contact information (email, phone, websites) for a LinkedIn profile",
  {
    public_identifier: z
      .string()
      .describe("The LinkedIn public identifier / vanity URL slug"),
  },
  async ({ public_identifier }) => {
    const result = await client.getProfileContactInfo(public_identifier);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "get_profile_skills",
  "Get the skills listed on a LinkedIn profile",
  {
    public_identifier: z
      .string()
      .describe("The LinkedIn public identifier / vanity URL slug"),
  },
  async ({ public_identifier }) => {
    const result = await client.getProfileSkills(public_identifier);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "get_profile_experience",
  "Get the work experience listed on a LinkedIn profile",
  {
    public_identifier: z
      .string()
      .describe("The LinkedIn public identifier / vanity URL slug"),
  },
  async ({ public_identifier }) => {
    const result = await client.getProfileExperience(public_identifier);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

// -- People Search --

server.tool(
  "search_people",
  "Search for people on LinkedIn with various filters (keywords, company, industry, location, title, school, network depth)",
  {
    keywords: z.string().optional().describe("Search keywords"),
    current_company: z
      .array(z.string())
      .optional()
      .describe("Filter by current company IDs"),
    past_company: z
      .array(z.string())
      .optional()
      .describe("Filter by past company IDs"),
    industries: z
      .array(z.string())
      .optional()
      .describe("Filter by industry codes"),
    regions: z
      .array(z.string())
      .optional()
      .describe("Filter by geo region URNs"),
    schools: z
      .array(z.string())
      .optional()
      .describe("Filter by school IDs"),
    title: z.string().optional().describe("Filter by job title"),
    network_depths: z
      .array(z.enum(["F", "S", "O"]))
      .optional()
      .describe("Network depth: F=1st, S=2nd, O=3rd+"),
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z.number().optional().describe("Number of results (default 10)"),
  },
  async (params) => {
    const result = await client.searchPeople({
      keywords: params.keywords,
      currentCompany: params.current_company,
      pastCompany: params.past_company,
      industries: params.industries,
      regions: params.regions,
      schools: params.schools,
      title: params.title,
      networkDepths: params.network_depths,
      start: params.start,
      count: params.count,
    });
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

// -- Company --

server.tool(
  "get_company",
  "Get detailed information about a company by its universal name (vanity URL slug)",
  {
    universal_name: z
      .string()
      .describe("The company's universal name / vanity URL (e.g. 'google')"),
  },
  async ({ universal_name }) => {
    const result = await client.getCompany(universal_name);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "search_companies",
  "Search for companies on LinkedIn by keywords, industry, region, or size",
  {
    keywords: z.string().optional().describe("Search keywords"),
    industries: z
      .array(z.string())
      .optional()
      .describe("Filter by industry codes"),
    regions: z
      .array(z.string())
      .optional()
      .describe("Filter by geo region URNs"),
    company_size: z
      .array(z.string())
      .optional()
      .describe("Filter by company size codes"),
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z.number().optional().describe("Number of results (default 10)"),
  },
  async (params) => {
    const result = await client.searchCompanies({
      keywords: params.keywords,
      industries: params.industries,
      regions: params.regions,
      companySize: params.company_size,
      start: params.start,
      count: params.count,
    });
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

// -- Sales Navigator --
// Note: Sales Navigator tools require an active Sales Navigator subscription.

function salesNavError(toolName: string, error: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  const msg = error instanceof Error ? error.message : String(error);
  const isSeatRequired = msg.includes("403") || msg.includes("SALES_SEAT") || msg.includes("402");
  return {
    content: [{
      type: "text" as const,
      text: isSeatRequired
        ? `${toolName} requires an active LinkedIn Sales Navigator subscription. Error: ${msg}`
        : `${toolName} failed: ${msg}`,
    }],
    isError: true,
  };
}

server.tool(
  "sales_search_leads",
  "Search for leads using LinkedIn Sales Navigator (requires Sales Navigator subscription)",
  {
    keywords: z.string().optional().describe("Search keywords"),
    title: z.string().optional().describe("Filter by job title"),
    company: z.string().optional().describe("Filter by company name"),
    geography: z.string().optional().describe("Filter by geography/location"),
    industry: z.string().optional().describe("Filter by industry"),
    seniority_level: z
      .string()
      .optional()
      .describe("Filter by seniority level (e.g. 'VP', 'Director', 'Manager')"),
    function_area: z
      .string()
      .optional()
      .describe("Filter by function/department (e.g. 'Engineering', 'Sales')"),
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z
      .number()
      .optional()
      .describe("Number of results (default 25)"),
  },
  async (params) => {
    try {
      const result = await client.salesSearchLeads({
        keywords: params.keywords,
        title: params.title,
        company: params.company,
        geography: params.geography,
        industry: params.industry,
        seniorityLevel: params.seniority_level,
        functionParam: params.function_area,
        start: params.start,
        count: params.count,
      });
      return {
        content: [{ type: "text", text: formatResult(result) }],
      };
    } catch (error) {
      return salesNavError("sales_search_leads", error);
    }
  }
);

server.tool(
  "sales_search_accounts",
  "Search for accounts (companies) using LinkedIn Sales Navigator (requires Sales Navigator subscription)",
  {
    keywords: z.string().optional().describe("Search keywords"),
    geography: z.string().optional().describe("Filter by geography/location"),
    industry: z.string().optional().describe("Filter by industry"),
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z
      .number()
      .optional()
      .describe("Number of results (default 25)"),
  },
  async (params) => {
    try {
      const result = await client.salesSearchAccounts({
        keywords: params.keywords,
        geography: params.geography,
        industry: params.industry,
        start: params.start,
        count: params.count,
      });
      return {
        content: [{ type: "text", text: formatResult(result) }],
      };
    } catch (error) {
      return salesNavError("sales_search_accounts", error);
    }
  }
);

server.tool(
  "get_sales_profile",
  "Get a lead's profile from Sales Navigator (requires Sales Navigator subscription)",
  {
    lead_id: z
      .string()
      .describe(
        "The Sales Navigator lead/profile ID"
      ),
  },
  async ({ lead_id }) => {
    try {
      const result = await client.getSalesProfile(lead_id);
      return {
        content: [{ type: "text", text: formatResult(result) }],
      };
    } catch (error) {
      return salesNavError("get_sales_profile", error);
    }
  }
);

server.tool(
  "get_saved_leads",
  "Get your saved leads from Sales Navigator (requires Sales Navigator subscription)",
  {
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z
      .number()
      .optional()
      .describe("Number of results (default 25)"),
  },
  async ({ start, count }) => {
    try {
      const result = await client.getSavedLeads(start, count);
      return {
        content: [{ type: "text", text: formatResult(result) }],
      };
    } catch (error) {
      return salesNavError("get_saved_leads", error);
    }
  }
);

server.tool(
  "get_lead_lists",
  "Get all lead lists from Sales Navigator (requires Sales Navigator subscription)",
  {
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z
      .number()
      .optional()
      .describe("Number of results (default 25)"),
  },
  async ({ start, count }) => {
    try {
      const result = await client.getLeadLists(start, count);
      return {
        content: [{ type: "text", text: formatResult(result) }],
      };
    } catch (error) {
      return salesNavError("get_lead_lists", error);
    }
  }
);

server.tool(
  "get_lead_list_members",
  "Get the leads within a specific Sales Navigator lead list (requires Sales Navigator subscription)",
  {
    list_id: z.string().describe("The lead list ID"),
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z
      .number()
      .optional()
      .describe("Number of results (default 25)"),
  },
  async ({ list_id, start, count }) => {
    try {
      const result = await client.getLeadListMembers(list_id, start, count);
      return {
        content: [{ type: "text", text: formatResult(result) }],
      };
    } catch (error) {
      return salesNavError("get_lead_list_members", error);
    }
  }
);

server.tool(
  "get_lead_recommendations",
  "Get lead recommendations from Sales Navigator (requires Sales Navigator subscription)",
  {
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z
      .number()
      .optional()
      .describe("Number of results (default 25)"),
  },
  async ({ start, count }) => {
    try {
      const result = await client.getLeadRecommendations(start, count);
      return {
        content: [{ type: "text", text: formatResult(result) }],
      };
    } catch (error) {
      return salesNavError("get_lead_recommendations", error);
    }
  }
);

// -- Messaging --

server.tool(
  "send_message",
  "Send a message to a LinkedIn member. For InMail, include a subject. The recipient URN should be in the format 'urn:li:fsd_profile:MEMBER_ID'",
  {
    recipient_urn: z
      .string()
      .describe(
        "The recipient's profile URN (e.g. 'urn:li:fsd_profile:ACoAAB...')"
      ),
    body: z.string().describe("The message body text"),
    subject: z
      .string()
      .optional()
      .describe("Message subject (required for InMail)"),
  },
  async ({ recipient_urn, body, subject }) => {
    const result = await client.sendMessage({
      recipientUrn: recipient_urn,
      body,
      subject,
    });
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "get_conversations",
  "Get recent conversation threads from the LinkedIn inbox",
  {
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z.number().optional().describe("Number of results (default 20)"),
  },
  async ({ start, count }) => {
    const result = await client.getConversations(start, count);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "get_conversation_messages",
  "Get messages from a specific LinkedIn conversation thread",
  {
    conversation_id: z.string().describe("The conversation thread ID"),
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z.number().optional().describe("Number of results (default 20)"),
  },
  async ({ conversation_id, start, count }) => {
    const result = await client.getConversationMessages(
      conversation_id,
      start,
      count
    );
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

// -- Connections --

server.tool(
  "send_connection_request",
  "Send a connection request to a LinkedIn member with an optional personalized message (max 300 characters)",
  {
    profile_urn: z
      .string()
      .describe(
        "The profile URN (e.g. 'urn:li:fsd_profile:ACoAAB...')"
      ),
    message: z
      .string()
      .optional()
      .describe("Optional personalized message (max 300 chars)"),
  },
  async ({ profile_urn, message }) => {
    const result = await client.sendConnectionRequest(profile_urn, message);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

server.tool(
  "get_pending_connections",
  "Get pending outgoing connection requests",
  {
    start: z.number().optional().describe("Pagination start index (default 0)"),
    count: z.number().optional().describe("Number of results (default 20)"),
  },
  async ({ start, count }) => {
    const result = await client.getPendingConnections(start, count);
    return {
      content: [{ type: "text", text: formatResult(result) }],
    };
  }
);

// ─── Start Server ──────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LinkedIn Sales Navigator MCP server is running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
