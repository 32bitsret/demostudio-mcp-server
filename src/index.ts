#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'

const BASE_URL = process.env.DEMOSTUDIO_BASE_URL ?? 'https://demostudio.xyz'
const API_KEY = process.env.DEMOSTUDIO_API_KEY ?? ''

if (!API_KEY) {
  process.stderr.write(
    'Error: DEMOSTUDIO_API_KEY environment variable is required.\n' +
    'Get your API key at https://demostudio.xyz/settings\n'
  )
  process.exit(1)
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(options.headers ?? {}),
    },
  })
  const json = await res.json() as { data: any; error: string | null }
  if (!res.ok || json.error) {
    throw new McpError(ErrorCode.InternalError, json.error ?? `HTTP ${res.status}`)
  }
  return json.data
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'generate_video',
    description:
      'Generate a short-form demo video (Instagram Reel / TikTok / YouTube Shorts) from a text prompt. ' +
      'DemoStudio writes the script, renders each scene with AI video or motion-graphic templates, ' +
      'adds voiceover and music, and returns a project URL where the user can preview and export. ' +
      'Use this when the user wants to create a promotional video, product demo, or UGC-style ad.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description:
            'Full creative brief. Include: product description, target audience, tone, ' +
            'key features to highlight, CTA, any scene-by-scene instructions, ' +
            'preferred music mood (hype / uplifting / calm), and whether to include subtitles. ' +
            'The richer the brief, the better the output.',
        },
        product_url: {
          type: 'string',
          description:
            'Optional. A URL to the product website. DemoStudio will crawl it for brand colors, ' +
            'logo, and description to enrich the video automatically.',
        },
        music_mood: {
          type: 'string',
          enum: ['hype', 'uplifting', 'calm'],
          description: 'Background music mood. Defaults to auto-selected based on prompt.',
        },
        subtitles: {
          type: 'boolean',
          description: 'Whether to burn subtitles onto voiceover scenes. Default: true.',
        },
        voice_gender: {
          type: 'string',
          enum: ['male', 'female'],
          description: 'Preferred voiceover gender. Default: auto-selected.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'get_video_status',
    description:
      'Check the status of a video project by its ID. Returns current status, scene build progress, ' +
      'and the final exported video URL once export is complete.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'The project UUID returned by generate_video.',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'list_capabilities',
    description:
      'List all scene types and Remotion motion-graphic templates available in DemoStudio. ' +
      'Call this before writing a detailed prompt so you can reference the correct scene types and template names. ' +
      'Returns all 5 scene types (cinematic, canvas, slideshow, remotion, video) and all 17 Remotion templates.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'create_schedule',
    description:
      'Set up the DemoStudio Agent to automatically generate and export a new video on a recurring schedule ' +
      '(daily, weekly, biweekly, or monthly) from a brand Knowledge Base. ' +
      'The Agent varies the hook angle and structure each run to avoid repetition.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'biweekly', 'monthly'],
          description: 'How often to generate a new video.',
        },
        run_day_of_week: {
          type: 'number',
          description:
            'Day of week for the run (0 = Sunday … 6 = Saturday). Only applies to weekly/biweekly/monthly.',
        },
        brand_description: {
          type: 'string',
          description:
            'Text description of the brand to add to the Knowledge Base as the first entry. ' +
            'Describe the product, audience, tone, and goals.',
        },
        product_url: {
          type: 'string',
          description:
            'Optional product URL to crawl and add to the Knowledge Base. Brand colors and ' +
            'logo will be extracted automatically.',
        },
        music_mood: {
          type: 'string',
          enum: ['hype', 'uplifting', 'calm'],
          description: 'Default music mood for automated runs.',
        },
      },
      required: ['frequency'],
    },
  },
]

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleGenerateVideo(args: Record<string, any>) {
  const { prompt, product_url, music_mood, subtitles, voice_gender } = args

  // Build the prompt string — include optional hints as structured text
  const fullPrompt = [
    prompt,
    product_url ? `Product URL: ${product_url}` : null,
    music_mood ? `Music mood: ${music_mood}` : null,
    subtitles === false ? 'No subtitles.' : 'Add subtitles to voiceover scenes.',
    voice_gender ? `Preferred voice: ${voice_gender}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  // Step 1: Create a project shell
  const project = await apiFetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ title: 'MCP Generated Video' }),
  })

  // Step 2: Generate the breakdown (script + scene build queue)
  const breakdown = await apiFetch('/api/generate/breakdown', {
    method: 'POST',
    body: JSON.stringify({
      prompt: fullPrompt,
      projectId: project.id,
      global: {
        ...(music_mood ? { musicMood: music_mood } : {}),
        ...(voice_gender ? { voiceGender: voice_gender } : {}),
        enableSubtitles: subtitles !== false,
      },
    }),
  })

  const projectUrl = `${BASE_URL}/editor/${project.id}`

  return [
    `**Video generation started!**`,
    ``,
    `Project: ${breakdown.inferredAppName ?? 'Your Video'}`,
    `Scenes: ${breakdown.scenes?.length ?? '?'} scenes · ~${breakdown.totalDuration ?? '?'}s`,
    `Music: ${breakdown.selectedTrackId ?? 'auto-selected'}`,
    `Subtitles: ${breakdown.enableSubtitles ? 'on' : 'off'}`,
    ``,
    `**Preview & export:** ${projectUrl}`,
    `**Project ID:** \`${project.id}\``,
    ``,
    `Scenes are building now (usually 1–3 minutes). ` +
    `Use \`get_video_status\` with the project ID to check when they're ready, ` +
    `or open the link above to watch progress live and export the final MP4.`,
  ].join('\n')
}

async function handleGetVideoStatus(args: Record<string, any>) {
  const { project_id } = args

  const data = await apiFetch(`/api/projects/${project_id}/load`)
  const project = data.project
  const scenes: any[] = data.scenes ?? []

  const done = scenes.filter((s) => s.generation_status === 'done').length
  const total = scenes.length
  const hasErrors = scenes.some((s) => s.generation_status === 'error')

  const lines = [
    `**Project:** ${project.title ?? project_id}`,
    `**Status:** ${project.status}`,
    `**Scenes:** ${done}/${total} built${hasErrors ? ' (some errors — regenerate in editor)' : ''}`,
  ]

  if (project.status === 'exported' && project.exported_video_url) {
    lines.push(`**Exported video:** ${project.exported_video_url}`)
  } else if (done === total && total > 0) {
    lines.push(`All scenes ready. Open the editor to export: ${BASE_URL}/editor/${project_id}`)
  } else {
    lines.push(`Still building. Check back in a minute or open: ${BASE_URL}/editor/${project_id}`)
  }

  return lines.join('\n')
}

function handleListCapabilities() {
  const sceneTypes = [
    { type: 'cinematic', desc: 'AI-generated video clip (Runway Gen4.5 or Google Veo 3.1). Best for product visuals, lifestyle shots, abstract backgrounds. Includes voiceover. Supports Act-One lip sync when a frontal face image is provided.' },
    { type: 'canvas',    desc: 'Animated text + gradient/color background. No AI video — fast to render, zero Runway cost. Best for hooks, stats, CTAs, and punchy one-liners.' },
    { type: 'slideshow', desc: 'Sequence of uploaded images or screenshots with Ken Burns / zoom animations. Best for showing UI, screenshots, or photo galleries.' },
    { type: 'remotion',  desc: 'React-based motion-graphic template (see template list below). Pixel-perfect branded cards. Best for structured data like reviews, pricing, how-it-works.' },
    { type: 'video',     desc: 'Uploaded video clip dropped directly into the timeline. Use for existing footage, screen recordings, or UGC clips.' },
  ]

  const templates = [
    { id: 'kinetic-text',      duration: '3–8s',   use: 'Word-by-word animated text reveal. Hooks, punchy statements, bold claims.' },
    { id: 'app-mockup',        duration: '4–10s',  use: 'iPhone frame with scrolling/zooming mobile screenshot.' },
    { id: 'desktop-mockup',    duration: '4–10s',  use: 'Browser window with desktop/web app screenshot.' },
    { id: 'saas-screencast',   duration: '4–10s',  use: 'Browser window playing a landscape SaaS screen recording.' },
    { id: 'app-screencast',    duration: '4–10s',  use: 'iPhone frame playing a portrait mobile app screen recording.' },
    { id: 'ugc-video',         duration: '3–10s',  use: 'Person speaking to camera — testimonial, UGC ad, face-to-camera demo.' },
    { id: 'feature-callout',   duration: '3–6s',   use: 'Emoji icon + headline + description card. Feature highlights.' },
    { id: 'stat-reveal',       duration: '3–6s',   use: 'Number counts up from zero. Social proof stats, metrics.' },
    { id: 'testimonial-card',  duration: '4–8s',   use: 'Quote card with name and star rating. Customer testimonials.' },
    { id: 'split-screen',      duration: '4–8s',   use: 'Two panels with animated divider. Before/after, problem/solution.' },
    { id: 'logo-reveal',       duration: '2–5s',   use: 'Brand logo entrance animation. Openers and closers.' },
    { id: 'countdown',         duration: '3–6s',   use: '3-2-1 countdown with CTA reveal. Urgency, limited-time offers.' },
    { id: 'review-card',       duration: '4–8s',   use: 'App store / Trustpilot / G2 review UI card with platform badge.' },
    { id: 'pricing-card',      duration: '5–10s',  use: 'Animated price count-up, feature checklist, CTA button.' },
    { id: 'how-it-works',      duration: '5–10s',  use: 'Numbered steps with emoji icons and connector line.' },
    { id: 'app-store-badge',   duration: '4–8s',   use: 'App icon + star rating + download count + store badge.' },
    { id: 'podcast-reel',      duration: '6–45s',  use: 'Landscape podcast/interview video auto-cropped to portrait.' },
    { id: 'dynamic-ugc',       duration: '5–60s',  use: 'Speaker audio plays while background swaps between product shots, stats, testimonials — timed to speech.' },
  ]

  const lines = [
    '## DemoStudio Scene Types',
    '',
    'Each scene in a video has a type. Mix types freely within one video.',
    '',
    ...sceneTypes.map((s) => `**${s.type}** — ${s.desc}`),
    '',
    '## Remotion Templates (scene type: remotion)',
    '',
    'Reference these by template name when specifying a remotion scene.',
    '',
    ...templates.map((t) => `**${t.id}** (${t.duration}) — ${t.use}`),
    '',
    '## Act-One Lip Sync',
    '',
    'When the product URL contains a frontal face photo (founder, spokesperson, brand character), DemoStudio auto-detects it and can animate the face with emotionally-crafted speech:',
    '- Uses Runway Act-One: a ghost driver video (anonymous person) transfers facial performance onto the real face',
    '- Audio is generated by ElevenLabs v3 turbo from a specially-formatted emotional script (support for [with conviction], [softly], <break time="0.4s"/>, etc.)',
    '- All other scene features apply: background music, sound effects, subtitles, onScreenText',
    '- Mention "lip sync" or "animate the founder" in your prompt to suggest this path',
    '',
    'Tip: A typical high-converting Reel mixes cinematic scenes for visuals, canvas for the hook and CTA, remotion templates for structured proof (reviews, stats, pricing), and an Act-One lip sync scene for a direct-to-camera spokesperson moment.',
  ]

  return lines.join('\n')
}

async function handleCreateSchedule(args: Record<string, any>) {
  const { frequency, run_day_of_week = 1, brand_description, product_url, music_mood } = args

  // Create the schedule
  const schedule = await apiFetch('/api/schedules', {
    method: 'POST',
    body: JSON.stringify({
      frequency,
      runDayOfWeek: run_day_of_week,
      globalSettings: music_mood ? { musicMood: music_mood } : undefined,
    }),
  })

  // Add brand description to Knowledge Base
  if (brand_description) {
    await apiFetch(`/api/schedules/${schedule.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        addEntry: { type: 'text', content: brand_description },
      }),
    })
  }

  // Add product URL to Knowledge Base (triggers brand asset extraction + crawl)
  if (product_url) {
    await apiFetch(`/api/schedules/${schedule.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        addEntry: { type: 'url', content: product_url },
      }),
    })
  }

  const agentUrl = `${BASE_URL}/agent`
  const freqLabel: Record<string, string> = {
    daily: 'every day',
    weekly: `every week`,
    biweekly: 'every two weeks',
    monthly: 'once a month',
  }

  return [
    `**Automated video schedule created!**`,
    ``,
    `Frequency: ${freqLabel[frequency] ?? frequency}`,
    `Schedule ID: \`${schedule.id}\``,
    ``,
    brand_description ? `Brand brief added to Knowledge Base.` : '',
    product_url ? `Product URL queued for crawl — brand colors and logo will be extracted automatically.` : '',
    ``,
    `The Agent will generate and export a new video ${freqLabel[frequency] ?? frequency}. ` +
    `Each run uses ~700 credits. You can add more Knowledge Base entries (images, videos, notes) at:`,
    agentUrl,
  ]
    .filter((l) => l !== '')
    .join('\n')
}

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'demostudio', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params

  try {
    let text: string

    switch (name) {
      case 'generate_video':
        text = await handleGenerateVideo(args)
        break
      case 'get_video_status':
        text = await handleGetVideoStatus(args)
        break
      case 'list_capabilities':
        text = handleListCapabilities()
        break
      case 'create_schedule':
        text = await handleCreateSchedule(args)
        break
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }

    return { content: [{ type: 'text', text }] }
  } catch (err) {
    if (err instanceof McpError) throw err
    throw new McpError(
      ErrorCode.InternalError,
      err instanceof Error ? err.message : String(err)
    )
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
