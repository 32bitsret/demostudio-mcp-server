# @demostudio/mcp-server

MCP server for [DemoStudio](https://demostudio.xyz) — lets any MCP-compatible AI assistant (Claude Code, Cursor, Windsurf, etc.) generate short-form video ads directly from a conversation.

## What it does

- **`generate_video`** — Turn a text brief into a rendered Instagram Reel / TikTok / YouTube Short
- **`get_video_status`** — Check build progress and get the exported video URL
- **`list_templates`** — Show all 17 available motion-graphic templates
- **`create_schedule`** — Set up the Agent to auto-generate videos on a recurring schedule

## Requirements

- Node.js 18+
- A DemoStudio API key — get one at [demostudio.xyz/settings](https://demostudio.xyz/settings)

## Installation

### Claude Code

```bash
claude mcp add --transport stdio \
  --env DEMOSTUDIO_API_KEY=your_api_key_here \
  demostudio \
  -- npx -y @demostudio/mcp-server
```

### Cursor / Windsurf

Add to your MCP config file (`~/.cursor/mcp.json` or `~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "demostudio": {
      "command": "npx",
      "args": ["-y", "@demostudio/mcp-server"],
      "env": {
        "DEMOSTUDIO_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "demostudio": {
      "command": "npx",
      "args": ["-y", "@demostudio/mcp-server"],
      "env": {
        "DEMOSTUDIO_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage examples

Once installed, just talk to your AI assistant naturally:

```
Generate a 30-second Instagram Reel for my SaaS product.
It's an AI inbox tool called Clearbox. Target: busy founders.
Tone: confident, direct. End with "Try it free at getclearbox.com".
Music: uplifting. Add subtitles.
```

```
What Remotion templates does DemoStudio support?
```

```
Check the status of project abc-123.
```

```
Set up a weekly automated video for my brand.
Product: Kova — project management for remote teams.
URL: https://getkova.com. Calm music. Run every Monday.
```

## Tools reference

### `generate_video`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | ✓ | Full creative brief — product, audience, tone, scenes, CTA |
| `product_url` | string | | URL to crawl for brand colors, logo, description |
| `music_mood` | `hype` \| `uplifting` \| `calm` | | Background music mood |
| `subtitles` | boolean | | Burn subtitles onto voiceover scenes (default: true) |
| `voice_gender` | `male` \| `female` | | Preferred voiceover gender |

Returns a project URL to preview and export the video.

### `get_video_status`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | ✓ | Project UUID from `generate_video` |

### `list_templates`

No parameters. Returns all 17 Remotion templates with descriptions.

### `create_schedule`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `frequency` | `daily` \| `weekly` \| `biweekly` \| `monthly` | ✓ | How often to generate |
| `run_day_of_week` | number (0–6) | | Day of week (0=Sun). Applies to weekly/biweekly/monthly |
| `brand_description` | string | | Text brief added to the Knowledge Base |
| `product_url` | string | | URL to crawl and add to the Knowledge Base |
| `music_mood` | `hype` \| `uplifting` \| `calm` | | Default music for automated runs |

## Pricing

DemoStudio is credit-based. New accounts get **500 free credits** (enough for ~1 full video).
Active accounts receive up to **500 bonus credits** every month.

- Scene generation: 10 credits
- Video export: 400 credits
- Automated run: ~700 credits

[View pricing →](https://demostudio.xyz/pricing)

## License

MIT
