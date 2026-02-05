# LinkedIn Sales Navigator MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blueviolet)](https://modelcontextprotocol.io)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)

A [Model Context Protocol](https://modelcontextprotocol.io) server for LinkedIn Sales Navigator -- automate lead generation, profile research, and outreach workflows through AI assistants.

---

## Features

- **Lead search** -- search LinkedIn Sales Navigator with filters for title, company, location, industry
- **Profile enrichment** -- extract detailed profile data including experience, education, skills
- **Company research** -- get company details, employee counts, recent updates
- **Connection management** -- send connection requests with personalized messages
- **InMail automation** -- draft and send InMail messages via AI
- **Cookie-based auth** -- uses your browser session, no LinkedIn API partnership required
- **Stealth browsing** -- Puppeteer with stealth plugin to avoid detection
- **MCP standard** -- works with Claude Desktop, Claude Code, and any MCP-compatible client

---

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **LinkedIn Sales Navigator** subscription with active browser session

---

## Installation

```bash
git clone https://github.com/aditya-ai-architect/Lindin-Sales-and-Navigator-MCP.git
cd Lindin-Sales-and-Navigator-MCP
npm install
npm run build
```

---

## Getting Your LinkedIn Cookies

1. Open [linkedin.com](https://www.linkedin.com) and log in
2. Open **Developer Tools** (F12)
3. Go to **Application** > **Cookies** > `https://www.linkedin.com`
4. Copy the `li_at` cookie value

| Cookie | Description |
|--------|-------------|
| `li_at` | LinkedIn session authentication token |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LINKEDIN_SESSION_COOKIE` | Yes | The `li_at` cookie value |

Create a `.env` file:

```env
LINKEDIN_SESSION_COOKIE=your_li_at_cookie_here
```

### Claude Desktop

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/absolute/path/to/Lindin-Sales-and-Navigator-MCP/build/index.js"],
      "env": {
        "LINKEDIN_SESSION_COOKIE": "your_li_at_cookie_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add linkedin -- node /absolute/path/to/Lindin-Sales-and-Navigator-MCP/build/index.js
```

---

## Usage Examples

**Search for leads:**
```
Find VP of Engineering at Series B startups in San Francisco
```

**Research a company:**
```
Get company details and recent updates for Anthropic
```

**Outreach:**
```
Send a connection request to [profile] with a personalized note about their recent post on AI agents
```

---

## Project Structure

```
Lindin-Sales-and-Navigator-MCP/
  src/
    index.ts              # MCP server setup and tool registration
    linkedin-client.ts    # LinkedIn API client
  build/                  # Compiled output
  package.json
  tsconfig.json
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Auth errors | Cookie expired -- extract fresh `li_at` from browser |
| Rate limiting | LinkedIn limits requests; add delays between operations |
| Profile not found | Check if the profile URL or username is correct |
| Detection/block | Clear cookies, wait 24h, then use fresh session |

---

## Tech Stack

- **Runtime:** Node.js (ES2022)
- **Language:** TypeScript 5.x
- **MCP SDK:** @modelcontextprotocol/sdk
- **Browser:** Puppeteer + puppeteer-extra-plugin-stealth
- **Validation:** Zod

---

## Disclaimer

This tool uses LinkedIn's internal APIs via session cookies. Automated access may violate LinkedIn's Terms of Service. Use responsibly for personal and educational purposes only.

---

## License

ISC

---

**Built by [Aditya Gaurav](https://github.com/aditya-ai-architect)**
