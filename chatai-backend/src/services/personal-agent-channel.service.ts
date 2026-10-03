import crypto from 'crypto'
import { db } from '../db'
import { logger } from './logger.service'
import { personalAgentService } from './personal-agent.service'

export interface EmailInPayload {
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  body?: string
  messageId?: string
  attachments?: Array<{ filename: string; contentType: string; size: number }>
}

export interface EmailInResult {
  success: boolean
  tenantId: string
  personalAgentId: string
  agentName: string
  userMessageId: string
  assistantMessageId: string
  subject: string
  responseSummary: string
  emailReplyDraft: {
    to: string
    from: string
    subject: string
    bodyText: string
  }
  delegatedSpecialists: string[]
  processedAt: string
}

export interface ChromeExtensionActionPayload {
  tenantId: string
  action: 'chat' | 'summarize_page' | 'extract_tasks' | 'explain_selection'
  prompt?: string
  pageUrl?: string
  pageTitle?: string
  pageContent?: string
  selectedText?: string
}

export interface ChannelOverview {
  channels: {
    dashboard: {
      enabled: boolean
      status: 'active'
      description: string
    }
    chromeExtension: {
      enabled: boolean
      status: 'connected' | 'ready' | 'offline'
      version: string
      description: string
      features: string[]
    }
    emailIn: {
      enabled: boolean
      status: 'active'
      inboundAddress: string
      supportedFormats: string[]
      description: string
    }
  }
}

export class PersonalAgentChannelService {
  /**
   * Generates deterministic inbound email address for a tenant
   */
  public getInboundEmailAddress(tenantId: string): string {
    const prefix = tenantId.replace(/-/g, '').slice(0, 8)
    return `assistant-${prefix}@in.chatbolt.ai`
  }

  /**
   * Retrieves status for all access channels (Dashboard, Chrome Extension, Email-In)
   */
  public async getChannelsOverview(tenantId: string): Promise<ChannelOverview> {
    const inboundAddress = this.getInboundEmailAddress(tenantId)
    const agent = await personalAgentService.getOrCreatePersonalAgent(tenantId)

    return {
      channels: {
        dashboard: {
          enabled: true,
          status: 'active',
          description: 'Primary web application interface with real-time memory and drawer view.'
        },
        chromeExtension: {
          enabled: true,
          status: 'ready',
          version: '1.0.0',
          description: `Reach ${agent.name} from any browser tab. Summarize articles, extract tasks, and draft replies.`,
          features: [
            '1-Click page summarization',
            'Action item extraction from web pages',
            'Floating assistant popup anywhere you browse',
            'Unified history sync'
          ]
        },
        emailIn: {
          enabled: true,
          status: 'active',
          inboundAddress,
          supportedFormats: ['Plain text', 'HTML', 'Markdown', 'Attachments'],
          description: `Forward or send emails directly to ${inboundAddress}. ${agent.name} processes requests and drafts actions automatically.`
        }
      }
    }
  }

  /**
   * Resolves a tenant from an incoming email address or sender
   */
  public async resolveTenantForEmail(toAddress: string, fromAddress: string): Promise<string> {
    // 1. Try matching alias pattern: assistant-{prefix}@in.chatbolt.ai
    const match = toAddress.toLowerCase().match(/assistant-([a-f0-9]{8})@/i)
    if (match) {
      const prefix = match[1]
      // Search in DB
      try {
        const { rows } = await db.query(
          `SELECT id FROM tenants WHERE REPLACE(id::text, '-', '') ILIKE $1 LIMIT 1`,
          [`${prefix}%`]
        )
        if (rows && rows.length > 0) {
          return rows[0].id
        }
      } catch {}
    }

    // 2. Try matching from sender email in users table
    try {
      const { rows } = await db.query(
        `SELECT tenant_id FROM users WHERE email = $1 LIMIT 1`,
        [fromAddress.toLowerCase().trim()]
      )
      if (rows && rows.length > 0) {
        return rows[0].tenant_id
      }
    } catch {}

    // Fallback default demo tenant
    return 'd34930ea-af1a-4094-9082-b47df3fb8075'
  }

  /**
   * Processes incoming email-in webhook payload
   */
  public async processEmailIn(payload: EmailInPayload): Promise<EmailInResult> {
    const rawBody = payload.text || payload.body || payload.html || '(No email content provided)'
    const subject = payload.subject || 'No Subject'
    const from = payload.from || 'unknown@domain.com'
    const to = payload.to || 'assistant@in.chatbolt.ai'

    logger.info(`[EmailInChannel] Received email from: ${from} | Subject: "${subject}"`)

    // Resolve tenant
    const tenantId = await this.resolveTenantForEmail(to, from)
    const agent = await personalAgentService.getOrCreatePersonalAgent(tenantId)

    // Construct enriched message for PersonalAgent
    const enrichedPrompt = `[Incoming Email]\nFrom: ${from}\nSubject: ${subject}\n\nContent:\n${rawBody}\n\nPlease review this email, carry out any requested tasks, and draft a response.`

    // Send through PersonalAgent chat pipeline (which triggers specialist delegation if needed)
    const chatResult = await personalAgentService.chat(tenantId, enrichedPrompt)

    // Tag the user message and assistant message metadata as email channel
    const cleanResponseText = chatResult.message?.content || 'I have reviewed your email and recorded the action.'

    const emailReplyDraft = {
      to: from,
      from: `"${agent.name}" <${to}>`,
      subject: subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`,
      bodyText: `Hi,\n\n${cleanResponseText}\n\nBest regards,\n${agent.name} (Your AI Companion)`
    }

    return {
      success: true,
      tenantId,
      personalAgentId: agent.id,
      agentName: agent.name,
      userMessageId: chatResult.userMessage?.id || crypto.randomUUID(),
      assistantMessageId: chatResult.message?.id || crypto.randomUUID(),
      subject,
      responseSummary: cleanResponseText,
      emailReplyDraft,
      delegatedSpecialists: chatResult.delegatedSpecialists || (chatResult.specialistUsed ? [chatResult.specialistUsed] : []),
      processedAt: new Date().toISOString()
    }
  }

  /**
   * Processes a request originating from the Chrome Extension
   */
  public async processChromeExtensionAction(payload: ChromeExtensionActionPayload): Promise<{
    success: boolean
    agentName: string
    response: string
    action: string
    pageContext?: { url?: string; title?: string }
    delegatedSpecialists?: string[]
  }> {
    const { tenantId, action, prompt, pageUrl, pageTitle, pageContent, selectedText } = payload
    const agent = await personalAgentService.getOrCreatePersonalAgent(tenantId)

    let finalPrompt = prompt || ''

    if (action === 'summarize_page') {
      finalPrompt = `Please summarize the key takeaways, main ideas, and critical insights from this webpage: "${pageTitle || pageUrl}"\n\nPage Content:\n${(pageContent || selectedText || '').slice(0, 4000)}`
    } else if (action === 'extract_tasks') {
      finalPrompt = `Extract any actionable tasks, deadlines, checklist items, or follow-ups mentioned on this page: "${pageTitle || pageUrl}"\n\nContent:\n${(pageContent || selectedText || '').slice(0, 4000)}`
    } else if (action === 'explain_selection') {
      finalPrompt = `Please explain this selected excerpt in clear, simple terms:\n\n"${selectedText || pageContent || ''}"`
    }

    logger.info(`[ChromeExtensionChannel] Processing action "${action}" for ${agent.name} on ${pageUrl || 'browser'}`)

    const chatResult = await personalAgentService.chat(tenantId, finalPrompt)

    return {
      success: true,
      agentName: agent.name,
      response: chatResult.message?.content || 'Task processed successfully.',
      action,
      pageContext: { url: pageUrl, title: pageTitle },
      delegatedSpecialists: chatResult.delegatedSpecialists || (chatResult.specialistUsed ? [chatResult.specialistUsed] : [])
    }
  }
}

export const personalAgentChannelService = new PersonalAgentChannelService()
