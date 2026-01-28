# LinkedIn Sales & Navigator MCP Server

An MCP (Model Context Protocol) server that provides AI assistants with access to LinkedIn and LinkedIn Sales Navigator through cookie-based authentication.

## Features

### Profile Tools
- **get_own_profile** — Get your own LinkedIn profile
- **get_profile** — Get any profile by public identifier
- **get_profile_details** — Full profile with experience, education, skills
- **get_profile_contact_info** — Email, phone, websites
- **get_profile_skills** — Skills list
- **get_profile_experience** — Work experience

### Search Tools
- **search_people** — Search LinkedIn members with filters (keywords, company, industry, location, title, school, network depth)
- **search_companies** — Search companies with filters (keywords, industry, region, size)

### Sales Navigator Tools
- **sales_search_leads** — Search leads with Sales Navigator filters (title, company, geography, industry, seniority, function)
- **sales_search_accounts** — Search accounts/companies via Sales Navigator
- **get_sales_profile** — Get a lead profile from Sales Navigator
- **get_saved_leads** — Retrieve your saved leads
- **get_lead_lists** — List all lead lists
- **get_lead_list_members** — Get leads in a specific list
- **get_lead_recommendations** — AI-recommended leads

### Messaging Tools
- **send_message** — Send a message or InMail to a member
- **get_conversations** — List recent conversation threads
- **get_conversation_messages** — Read messages in a conversation

### Connection Tools
- **send_connection_request** — Send a connection request with optional note
- **get_pending_connections** — View pending outgoing requests

### Utility
- **validate_session** — Check if your session cookie is still active

## Prerequisites

- Node.js 18+
- A LinkedIn account (Sales Navigator subscription for Sales Nav features)
- Your `li_at` session cookie from LinkedIn

## Getting Your LinkedIn Cookie

1. Log in to [LinkedIn](https://www.linkedin.com) in your browser
2. Open Developer Tools (`F12` or `Cmd+Shift+I`)
3. Go to **Application** → **Cookies** → `https://www.linkedin.com`
4. Find the `li_at` cookie and copy its value
5. (Optional) Also copy the `JSESSIONID` cookie value for the CSRF token

> **Note:** The `li_at` cookie expires periodically. If you get authentication errors, you'll need to refresh it.

## Installation

```bash
# Clone the repo
git clone https://github.com/aditya-ai-architect/Lindin-Sales-and-Navigator-MCP.git
cd Lindin-Sales-and-Navigator-MCP

# Install dependencies
npm install

# Build
npm run build
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LI_AT_COOKIE` | Yes | Your LinkedIn `li_at` session cookie |
| `JSESSIONID` | No | Your LinkedIn `JSESSIONID` cookie (auto-generated if not provided) |

### Claude Desktop

Add this to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "linkedin-sales-navigator": {
      "command": "node",
      "args": ["/path/to/Lindin-Sales-and-Navigator-MCP/dist/index.js"],
      "env": {
        "LI_AT_COOKIE": "your_li_at_cookie_value_here"
      }
    }
  }
}
```

### Claude Code (CLI)

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "linkedin-sales-navigator": {
      "command": "node",
      "args": ["/path/to/Lindin-Sales-and-Navigator-MCP/dist/index.js"],
      "env": {
        "LI_AT_COOKIE": "your_li_at_cookie_value_here"
      }
    }
  }
}
```

### Running Directly

```bash
LI_AT_COOKIE="your_cookie" node dist/index.js
```

## Usage Examples

Once configured, you can ask your AI assistant:

- *"Search for VP of Engineering at fintech companies in San Francisco"*
- *"Get the profile details for john-doe-123"*
- *"Show me my saved leads in Sales Navigator"*
- *"Send a connection request to urn:li:fsd_profile:ACoAAB... with a note about our shared interest in AI"*
- *"Search Sales Navigator for directors at companies in the healthcare industry"*
- *"Show my recent LinkedIn conversations"*

## Important Notes

- **Rate Limits:** LinkedIn enforces rate limits. Avoid making too many requests in a short period to prevent temporary blocks.
- **Cookie Expiry:** The `li_at` cookie expires. If tools return authentication errors, refresh the cookie from your browser.
- **Sales Navigator:** Sales Navigator tools require an active Sales Navigator subscription on your LinkedIn account.
- **Terms of Service:** Use responsibly and in accordance with LinkedIn's terms of service.

## License

MIT
