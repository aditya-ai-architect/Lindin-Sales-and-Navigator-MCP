# LinkedIn Sales & Navigator MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that connects AI assistants to LinkedIn and LinkedIn Sales Navigator using cookie-based authentication. Provides 17 tools for viewing profiles, searching people & companies, messaging, managing connections, and full Sales Navigator access — all through LinkedIn's internal Voyager API.

Built with TypeScript, `@modelcontextprotocol/sdk`, Zod, `undici`, and Puppeteer with stealth plugin.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Your LinkedIn Cookie](#getting-your-linkedin-cookie)
- [Configuration](#configuration)
  - [Claude Desktop](#claude-desktop)
  - [Claude Code (CLI)](#claude-code-cli)
  - [Environment Variables](#environment-variables)
- [Tools Reference](#tools-reference)
  - [Profile Tools](#profile-tools)
  - [Search Tools](#search-tools)
  - [Company Tools](#company-tools)
  - [Sales Navigator Tools](#sales-navigator-tools)
  - [Messaging Tools](#messaging-tools)
  - [Connection Tools](#connection-tools)
  - [Utility](#utility)
- [Architecture](#architecture)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Features

- **17 tools** — Profiles, search, companies, messaging, connections, and full Sales Navigator
- **Cookie-based auth** — No LinkedIn Developer account or OAuth app required
- **Dual-engine architecture** — Fast HTTP (undici) for reads, headless Puppeteer with stealth plugin for messaging & Sales Navigator
- **Anti-bot bypass** — Puppeteer-extra with StealthPlugin bypasses LinkedIn's automation detection
- **Clean responses** — Deeply nested LinkedIn Voyager API responses are parsed into readable JSON
- **Type-safe** — Written in strict TypeScript with Zod schema validation on all tool inputs
- **MCP standard** — Works with any MCP-compatible client (Claude Desktop, Claude Code, etc.)

---

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- A **LinkedIn account** with an active session in your browser
- A **Sales Navigator subscription** (for Sales Navigator tools only)

---

## Installation

```bash
# Clone the repository
git clone https://github.com/aditya-ai-architect/Lindin-Sales-and-Navigator-MCP.git
cd Lindin-Sales-and-Navigator-MCP

# Install dependencies
npm install

# Build
npm run build
```

---

## Getting Your LinkedIn Cookie

The server authenticates using the `li_at` cookie from your logged-in LinkedIn session:

1. Open [linkedin.com](https://www.linkedin.com) in your browser and log in
2. Open **Developer Tools** (`F12` or `Ctrl+Shift+I`)
3. Go to the **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
4. In the left sidebar, expand **Cookies** and click on `https://www.linkedin.com`
5. Find and copy the `li_at` cookie value

| Cookie | Required | Description |
|--------|----------|-------------|
| `li_at` | Yes | Your session authentication token |
| `JSESSIONID` | No | CSRF token (auto-generated if not provided) |

> **Important:** The `li_at` cookie expires periodically. If you get authentication errors, extract a fresh cookie from your browser.

---

## Configuration

### Claude Desktop

Add to your Claude Desktop config file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "linkedin-sales-navigator": {
      "command": "node",
      "args": ["/absolute/path/to/Lindin-Sales-and-Navigator-MCP/dist/index.js"],
      "env": {
        "LI_AT_COOKIE": "your_li_at_cookie_value_here"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add linkedin-sales-navigator -- node /absolute/path/to/Lindin-Sales-and-Navigator-MCP/dist/index.js
```

Set the environment variable before launching, or use a `.env` file.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LI_AT_COOKIE` | Yes | Your LinkedIn `li_at` session cookie |
| `JSESSIONID` | No | Your LinkedIn `JSESSIONID` cookie (auto-generated if not provided) |

### Running Directly

```bash
LI_AT_COOKIE="your_cookie" node dist/index.js
```

---

## Tools Reference

### Profile Tools

#### `validate_session`
Validate that the LinkedIn session cookie is still active.

#### `get_own_profile`
Get the authenticated user's own LinkedIn profile information.

#### `get_profile`
Get a LinkedIn profile by public identifier (vanity URL slug).

| Parameter | Type | Description |
|-----------|------|-------------|
| `public_identifier` | string | The LinkedIn vanity URL slug (e.g. `john-doe-123`) |

#### `get_profile_details`
Get detailed profile information including experience, education, and skills.

| Parameter | Type | Description |
|-----------|------|-------------|
| `public_identifier` | string | The LinkedIn vanity URL slug |

#### `get_profile_contact_info`
Get contact information for a LinkedIn profile.

| Parameter | Type | Description |
|-----------|------|-------------|
| `public_identifier` | string | The LinkedIn vanity URL slug |

> **Note:** LinkedIn has deprecated the contact info API. Returns basic profile info with a note about the deprecation.

#### `get_profile_skills`
Get the skills listed on a LinkedIn profile.

| Parameter | Type | Description |
|-----------|------|-------------|
| `public_identifier` | string | The LinkedIn vanity URL slug |

> **Note:** LinkedIn no longer includes skill entities in the Voyager API. Returns profile summary which may mention skills.

#### `get_profile_experience`
Get work experience (positions) from a LinkedIn profile.

| Parameter | Type | Description |
|-----------|------|-------------|
| `public_identifier` | string | The LinkedIn vanity URL slug |

---

### Search Tools

#### `search_people`
Search for people on LinkedIn with various filters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `keywords` | string? | Search keywords |
| `current_company` | string[]? | Filter by current company IDs |
| `past_company` | string[]? | Filter by past company IDs |
| `industries` | string[]? | Filter by industry codes |
| `regions` | string[]? | Filter by geo region URNs |
| `schools` | string[]? | Filter by school IDs |
| `title` | string? | Filter by job title |
| `network_depths` | ("F"\|"S"\|"O")[]? | Network depth: F=1st, S=2nd, O=3rd+ |
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 10) |

#### `search_companies`
Search for companies on LinkedIn.

| Parameter | Type | Description |
|-----------|------|-------------|
| `keywords` | string? | Search keywords |
| `industries` | string[]? | Filter by industry codes |
| `regions` | string[]? | Filter by geo region URNs |
| `company_size` | string[]? | Filter by company size codes |
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 10) |

---

### Company Tools

#### `get_company`
Get detailed information about a company by its universal name.

| Parameter | Type | Description |
|-----------|------|-------------|
| `universal_name` | string | Company vanity URL slug (e.g. `google`) |

---

### Sales Navigator Tools

> **Requires an active LinkedIn Sales Navigator subscription.**

#### `sales_search_leads`
Search for leads using Sales Navigator. Uses Puppeteer browser to scrape Sales Navigator UI.

| Parameter | Type | Description |
|-----------|------|-------------|
| `keywords` | string? | Search keywords |
| `title` | string? | Filter by job title |
| `company` | string? | Filter by company name |
| `geography` | string? | Filter by location |
| `industry` | string? | Filter by industry |
| `seniority_level` | string? | Filter by seniority (VP, Director, Manager) |
| `function_area` | string? | Filter by department (Engineering, Sales) |
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 25) |

#### `sales_search_accounts`
Search for accounts (companies) using Sales Navigator.

| Parameter | Type | Description |
|-----------|------|-------------|
| `keywords` | string? | Search keywords |
| `geography` | string? | Filter by location |
| `industry` | string? | Filter by industry |
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 25) |

#### `get_sales_profile`
Get a lead's profile from Sales Navigator.

| Parameter | Type | Description |
|-----------|------|-------------|
| `lead_id` | string | The Sales Navigator lead/profile ID |

#### `get_saved_leads`
Get your saved leads from Sales Navigator.

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 25) |

#### `get_lead_lists`
Get all lead lists from Sales Navigator.

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 25) |

#### `get_lead_list_members`
Get leads within a specific lead list.

| Parameter | Type | Description |
|-----------|------|-------------|
| `list_id` | string | The lead list ID |
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 25) |

#### `get_lead_recommendations`
Get AI-recommended leads from Sales Navigator.

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 25) |

---

### Messaging Tools

#### `send_message`
Send a message to a LinkedIn member. Uses Puppeteer browser.

| Parameter | Type | Description |
|-----------|------|-------------|
| `recipient_urn` | string | Profile URN (e.g. `urn:li:fsd_profile:ACoAAB...`) |
| `body` | string | The message body text |
| `subject` | string? | Message subject (required for InMail) |

#### `get_conversations`
Get recent conversation threads from the LinkedIn inbox. Uses Puppeteer browser.

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 20) |

#### `get_conversation_messages`
Get messages from a specific conversation thread. Uses Puppeteer browser.

| Parameter | Type | Description |
|-----------|------|-------------|
| `conversation_id` | string | The conversation thread ID |
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 20) |

---

### Connection Tools

#### `send_connection_request`
Send a connection request with an optional personalized message.

| Parameter | Type | Description |
|-----------|------|-------------|
| `profile_urn` | string | Profile URN (e.g. `urn:li:fsd_profile:ACoAAB...`) |
| `message` | string? | Optional personalized message (max 300 chars) |

#### `get_pending_connections`
Get pending outgoing connection requests.

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | number? | Pagination start (default 0) |
| `count` | number? | Results per page (default 20) |

---

## Architecture

```
┌─────────────────┐     stdio      ┌─────────────────┐
│   MCP Client    │ <────────────> │  linkedin-mcp   │
│ (Claude, etc.)  │   JSON-RPC     │  MCP Server     │
└─────────────────┘                └────────┬────────┘
                                            │
                              ┌─────────────┴─────────────┐
                              │                           │
                      ┌───────▼───────┐          ┌────────▼────────┐
                      │  undici HTTP  │          │   Puppeteer +   │
                      │  (Read ops)   │          │   Stealth       │
                      │  Fast, direct │          │   (Write ops)   │
                      └───────┬───────┘          └────────┬────────┘
                              │                           │
                              └─────────────┬─────────────┘
                                            │
                                   ┌────────▼────────┐
                                   │  LinkedIn       │
                                   │  Voyager API    │
                                   └─────────────────┘
```

**How it works:**

The server uses a **dual-engine approach** to handle LinkedIn's API restrictions:

- **HTTP engine (undici):** Profile lookups, people/company search, company details, connections, and session validation use fast direct HTTP requests. Uses `undici` instead of native `fetch` because Node.js blocks the `Cookie` header as a "forbidden header" in native fetch.

- **Puppeteer engine (stealth):** Messaging and Sales Navigator tools use a headless Chromium browser with `puppeteer-extra-plugin-stealth` to bypass automation detection. LinkedIn has locked down the messaging and Sales Navigator API endpoints, but the browser UI still works.

The stealth browser launches lazily on the first messaging or Sales Navigator call and stays alive for subsequent operations.

**Key technical details:**
- LinkedIn's Voyager API uses `decorationId` parameters to control what data is returned
- Search uses REST-li format: `search/dash/clusters?decorationId=...&q=all&query=(...)`
- Profile data uses: `identity/dash/profiles?decorationId=...&q=memberIdentity&memberIdentity=...`
- Sales Navigator results are scraped using `data-anonymize` attribute selectors for stability

---

## Development

```bash
# Watch mode
npm run dev

# Build once
npm run build

# Run directly
npm start

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

### Project Structure

```
linkedin-mcp/
├── src/
│   ├── index.ts              # MCP server entry, tool registration
│   └── linkedin-client.ts    # LinkedIn API client (HTTP + Puppeteer dual-engine)
├── dist/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
└── README.md
```

---

## Troubleshooting

### "LI_AT_COOKIE environment variable is required"
The `LI_AT_COOKIE` env var must be set. Check your Claude Desktop config or shell environment.

### HTTP 401 / 403 errors
Your cookie has expired. Extract a fresh `li_at` cookie from your browser.

### Profile returns 403 "This profile can't be accessed"
Some profiles have privacy restrictions that block API access. This is a LinkedIn-side restriction, not a bug.

### Sales Navigator returns "SALES_SEAT_REQUIRED"
Your LinkedIn account needs an active Sales Navigator subscription. The tool will automatically fall back to Puppeteer browser scraping if the API returns this error.

### Browser launch failures
The first messaging or Sales Navigator call launches a Chromium browser. Ensure you have enough memory and that Puppeteer's bundled Chromium was downloaded during `npm install`. On Linux servers, you may need additional system libraries — see [Puppeteer troubleshooting](https://pptr.dev/troubleshooting).

### Navigation timeout
LinkedIn's pages are heavy with background requests. The server uses `domcontentloaded` instead of `networkidle2` and waits for specific content selectors to appear.

### Skills / Contact Info returning empty
LinkedIn has permanently removed skills and contact info from their Voyager API. The tools return informative notes about this deprecation.

### Server won't start in Claude Desktop
- Ensure the path in your config uses **absolute paths**
- On Windows, use forward slashes (`C:/Users/...`) or escaped backslashes (`C:\\Users\\...`)
- Check Claude Desktop logs for error messages

---

## Disclaimer

This server uses LinkedIn's internal, undocumented Voyager API through cookie-based session authentication. This is **not** the official LinkedIn API.

- LinkedIn may change endpoints, decorationIds, or authentication requirements at any time
- Automated use of LinkedIn via cookies may violate LinkedIn's Terms of Service
- Use at your own risk and responsibility
- This project is intended for personal use and educational purposes

---

## License

MIT
