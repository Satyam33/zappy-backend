# Zappy — Backend Agent Document
**WhatsApp Marketing SaaS Platform**
Version 1.0 | Phase 1 MVP

---

## 1. Project Overview

Zappy backend is a multi-tenant Node.js REST API that powers the WhatsApp Marketing SaaS platform. It integrates directly with Meta's WhatsApp Cloud API, handles broadcast job queuing via BullMQ + Redis, manages tenant-scoped data in PostgreSQL, and serves real-time inbox updates via WebSocket.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| Query Builder | Knex.js |
| Cache / Queue Storage | Redis (Upstash) |
| Job Queue | BullMQ |
| Realtime | Socket.IO |
| Authentication | JWT (access + refresh token) |
| Token Encryption | AES-256-GCM (Node crypto) |
| File Storage | AWS S3 (contact CSV imports) |
| Email | SendGrid (transactional) |
| Payments | Razorpay |
| Validation | Zod |
| Logging | Winston + Morgan |
| Testing | Jest + Supertest |
| Process Manager | PM2 |

---

## 3. Folder Structure

```
src/
├── config/
│   ├── database.ts          # Knex connection config
│   ├── redis.ts             # ioredis connection + BullMQ connection
│   ├── env.ts               # Zod-validated environment variables
│   └── constants.ts
├── middleware/
│   ├── auth.ts              # JWT verification
│   ├── tenant.ts            # Org resolution + req.org injection
│   ├── planGuard.ts         # Plan limit enforcement
│   ├── rateLimiter.ts       # Per-org rate limiting (Redis)
│   ├── errorHandler.ts      # Global error handler
│   └── requestLogger.ts
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.routes.ts
│   ├── contacts/
│   │   ├── contacts.controller.ts
│   │   ├── contacts.service.ts
│   │   ├── contacts.repository.ts
│   │   └── contacts.routes.ts
│   ├── campaigns/
│   │   ├── campaigns.controller.ts
│   │   ├── campaigns.service.ts
│   │   ├── campaigns.repository.ts
│   │   └── campaigns.routes.ts
│   ├── templates/
│   │   ├── templates.controller.ts
│   │   ├── templates.service.ts
│   │   ├── templates.repository.ts
│   │   └── templates.routes.ts
│   ├── inbox/
│   │   ├── inbox.controller.ts
│   │   ├── inbox.service.ts
│   │   ├── inbox.repository.ts
│   │   └── inbox.routes.ts
│   ├── analytics/
│   │   ├── analytics.controller.ts
│   │   ├── analytics.service.ts
│   │   └── analytics.routes.ts
│   ├── billing/
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   └── billing.routes.ts
│   ├── settings/
│   │   ├── settings.controller.ts
│   │   ├── settings.service.ts
│   │   └── settings.routes.ts
│   └── webhook/
│       ├── webhook.controller.ts
│       ├── webhook.processor.ts
│       └── webhook.routes.ts
├── queues/
│   ├── broadcast.queue.ts   # BullMQ Queue definition
│   ├── broadcast.worker.ts  # BullMQ Worker
│   └── queue.registry.ts    # All queues registered here
├── services/
│   ├── whatsapp.service.ts  # Meta Cloud API wrapper
│   ├── encryption.service.ts
│   ├── s3.service.ts
│   ├── sendgrid.service.ts
│   └── razorpay.service.ts
├── websocket/
│   ├── ws.server.ts         # WebSocket server setup
│   └── ws.manager.ts        # Per-org connection registry
├── db/
│   ├── migrations/          # Knex migrations
│   └── seeds/               # Dev seed data
├── types/
│   ├── express.d.ts         # Extends req with org, user, role
│   └── index.ts
├── utils/
│   ├── pagination.ts
│   ├── phoneFormatter.ts
│   └── csvParser.ts
├── app.ts                   # Express app setup
├── server.ts                # HTTP server + WS server boot
└── worker.ts                # BullMQ worker process (separate)
```

---

## 4. Database Schema

### Core Tables

```sql
-- USERS
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  name            VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ORGANIZATIONS (one per tenant)
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  owner_id        UUID REFERENCES users(id),
  plan_id         VARCHAR(50) DEFAULT 'starter',    -- starter | growth | pro
  waba_id         VARCHAR(255) UNIQUE,
  phone_number_id VARCHAR(255),
  access_token    TEXT,                              -- AES-256-GCM encrypted
  token_iv        TEXT,
  token_auth_tag  TEXT,
  quality_rating  VARCHAR(20) DEFAULT 'GREEN',       -- GREEN | YELLOW | RED
  messaging_limit VARCHAR(50) DEFAULT 'TIER_1',      -- TIER_1 | TIER_2 | TIER_3
  timezone        VARCHAR(100) DEFAULT 'Asia/Kolkata',
  opt_out_keyword VARCHAR(50) DEFAULT 'STOP',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ORG MEMBERS (team seats)
CREATE TABLE org_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id),
  role      VARCHAR(50) DEFAULT 'agent',            -- admin | agent | viewer
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- CONTACTS
CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        VARCHAR(255),
  phone       VARCHAR(20) NOT NULL,                 -- E.164 format
  tags        TEXT[] DEFAULT '{}',
  opted_in    BOOLEAN DEFAULT true,
  opted_out_at TIMESTAMPTZ,
  custom_data JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, phone)
);
CREATE INDEX idx_contacts_org_id ON contacts(org_id);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- TEMPLATES
CREATE TABLE templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  meta_template_id VARCHAR(255),
  category        VARCHAR(50),                      -- MARKETING | UTILITY | AUTHENTICATION
  language        VARCHAR(20) DEFAULT 'en',
  body            TEXT NOT NULL,
  variables       TEXT[] DEFAULT '{}',
  status          VARCHAR(30) DEFAULT 'pending',    -- pending | approved | rejected
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);
CREATE INDEX idx_templates_org_id ON templates(org_id);

-- CAMPAIGNS
CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  template_id     UUID REFERENCES templates(id),
  segment_filter  JSONB DEFAULT '{}',               -- { tags: ['VIP'], opted_in: true }
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(30) DEFAULT 'draft',      -- draft | queued | running | completed | failed
  total_contacts  INTEGER DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_campaigns_org_id ON campaigns(org_id);

-- CAMPAIGN LOGS (one row per message per contact)
CREATE TABLE campaign_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id),
  meta_message_id VARCHAR(255),
  status          VARCHAR(30) DEFAULT 'queued',     -- queued | sent | delivered | read | failed
  error_code      VARCHAR(50),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_campaign_logs_org_id ON campaign_logs(org_id);
CREATE INDEX idx_campaign_logs_campaign_id ON campaign_logs(campaign_id);
CREATE INDEX idx_campaign_logs_meta_message_id ON campaign_logs(meta_message_id);

-- CONVERSATIONS (inbox threads)
CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id),
  assigned_to     UUID REFERENCES users(id),
  status          VARCHAR(30) DEFAULT 'open',       -- open | resolved
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, contact_id)
);
CREATE INDEX idx_conversations_org_id ON conversations(org_id);

-- MESSAGES (individual WA messages in a conversation)
CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL,
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction         VARCHAR(10) NOT NULL,           -- inbound | outbound
  type              VARCHAR(20) DEFAULT 'text',     -- text | image | document | template
  content           TEXT,
  meta_message_id   VARCHAR(255),
  status            VARCHAR(30) DEFAULT 'sent',     -- sent | delivered | read | failed
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- BILLING USAGE (monthly snapshot)
CREATE TABLE billing_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  contacts_count  INTEGER DEFAULT 0,
  messages_sent   INTEGER DEFAULT 0,
  conversations   INTEGER DEFAULT 0,
  meta_charges    DECIMAL(10,2) DEFAULT 0.00,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, period_start)
);
```

---

## 5. API Endpoints

### Auth
```
POST   /api/v1/auth/signup
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

### Contacts
```
GET    /api/v1/contacts              ?page=1&limit=25&search=&tag=&opted_in=
POST   /api/v1/contacts
PUT    /api/v1/contacts/:id
DELETE /api/v1/contacts/:id
POST   /api/v1/contacts/import       (multipart CSV)
GET    /api/v1/contacts/export       (returns CSV download)
POST   /api/v1/contacts/bulk-delete
```

### Campaigns
```
GET    /api/v1/campaigns             ?status=&page=
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
DELETE /api/v1/campaigns/:id
GET    /api/v1/campaigns/:id/logs    ?status=&page=
POST   /api/v1/campaigns/:id/cancel
```

### Templates
```
GET    /api/v1/templates             ?category=&status=
POST   /api/v1/templates
PUT    /api/v1/templates/:id
DELETE /api/v1/templates/:id
POST   /api/v1/templates/:id/resubmit
```

### Inbox
```
GET    /api/v1/conversations         ?status=&page=
GET    /api/v1/conversations/:id
PUT    /api/v1/conversations/:id     (assign, resolve)
GET    /api/v1/conversations/:id/messages
POST   /api/v1/conversations/:id/messages
```

### Analytics
```
GET    /api/v1/analytics/summary     ?range=7d|30d|all
GET    /api/v1/analytics/campaigns/top
GET    /api/v1/analytics/contacts/growth
```

### Billing
```
GET    /api/v1/billing/plan
GET    /api/v1/billing/usage
POST   /api/v1/billing/upgrade
POST   /api/v1/billing/webhook       (Razorpay webhook)
```

### Settings
```
GET    /api/v1/settings/whatsapp
PUT    /api/v1/settings/whatsapp
GET    /api/v1/settings/profile
PUT    /api/v1/settings/profile
GET    /api/v1/org/members
POST   /api/v1/org/members/invite
DELETE /api/v1/org/members/:id
```

### Dashboard
```
GET    /api/v1/dashboard/stats
```

### Webhook (Meta)
```
GET    /webhook/whatsapp             (Meta verification)
POST   /webhook/whatsapp             (Incoming events)
```

---

## 6. Multi-Tenancy Architecture

Every request to a protected route passes through two middleware layers:

### Step 1 — `auth.ts` (JWT verification)
```ts
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  const payload = jwt.verify(token, process.env.JWT_SECRET)
  req.userId = payload.sub
  next()
}
```

### Step 2 — `tenant.ts` (Org resolution)
```ts
const tenantMiddleware = async (req, res, next) => {
  const membership = await db('org_members')
    .join('organizations', 'organizations.id', 'org_members.org_id')
    .where({ 'org_members.user_id': req.userId })
    .select('organizations.*', 'org_members.role')
    .first()

  if (!membership) return res.status(403).json({ error: 'No organization found' })

  req.org    = membership
  req.orgId  = membership.id
  req.role   = membership.role
  next()
}
```

### Repository Pattern — All queries are org-scoped
```ts
class ContactRepository {
  constructor(private orgId: string) {}

  findAll(filters = {}) {
    return db('contacts')
      .where({ org_id: this.orgId, ...filters })
      .orderBy('created_at', 'desc')
  }

  findById(id: string) {
    return db('contacts')
      .where({ id, org_id: this.orgId })   // double-lock
      .first()
  }
}

// Usage in controller:
const repo = new ContactRepository(req.orgId)
const contacts = await repo.findAll({ opted_in: true })
```

### Plan Guard Middleware
```ts
const planLimits = {
  starter: { contacts: 2500,  messages: 5000,  seats: 2 },
  growth:  { contacts: 15000, messages: 30000, seats: 5 },
  pro:     { contacts: null,  messages: 100000, seats: 15 },
}

const checkContactLimit = async (req, res, next) => {
  const limit = planLimits[req.org.plan_id].contacts
  if (!limit) return next()  // unlimited

  const { total } = await db('contacts')
    .where({ org_id: req.orgId })
    .count('id as total')
    .first()

  if (parseInt(total) >= limit) {
    return res.status(403).json({
      error: 'Contact limit reached',
      code: 'PLAN_LIMIT_CONTACTS',
      limit,
      upgrade_url: '/billing'
    })
  }
  next()
}
```

---

## 7. WhatsApp Cloud API Integration

### Service (`services/whatsapp.service.ts`)
```ts
class WhatsAppService {
  private phoneNumberId: string
  private accessToken: string
  private baseURL = 'https://graph.facebook.com/v19.0'

  constructor(org: Organization) {
    this.phoneNumberId = org.phone_number_id
    this.accessToken   = decrypt(org.access_token, org.token_iv, org.token_auth_tag)
  }

  async sendTemplate(to: string, templateName: string, variables: string[]) {
    return axios.post(
      `${this.baseURL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [{
            type: 'body',
            parameters: variables.map(v => ({ type: 'text', text: v }))
          }]
        }
      },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    )
  }

  async submitTemplate(name: string, category: string, body: string, language: string) {
    return axios.post(
      `${this.baseURL}/${process.env.WABA_ID}/message_templates`,
      { name, category, language, components: [{ type: 'BODY', text: body }] },
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    )
  }
}
```

### Access Token Encryption (`services/encryption.service.ts`)
```ts
const ALGO   = 'aes-256-gcm'
const SECRET = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')  // 32 bytes

export const encrypt = (text: string) => {
  const iv     = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGO, SECRET, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    encrypted: encrypted.toString('hex'),
    iv:        iv.toString('hex'),
    authTag:   authTag.toString('hex')
  }
}

export const decrypt = (encryptedHex: string, ivHex: string, authTagHex: string) => {
  const decipher = crypto.createDecipheriv(ALGO, SECRET, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]).toString('utf8')
}
```

---

## 8. Broadcast Queue (BullMQ + Redis)

### Queue Setup (`queues/broadcast.queue.ts`)
```ts
import { Queue } from 'bullmq'
import { redisConnection } from '../config/redis'

export const broadcastQueue = new Queue('broadcasts', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  }
})
```

### Worker (`queues/broadcast.worker.ts`)
```ts
import { Worker } from 'bullmq'

const worker = new Worker('broadcasts', async (job) => {
  const { orgId, campaignId } = job.data

  const org      = await getOrg(orgId)
  const campaign = await getCampaign(campaignId)
  const contacts = await getContactsForSegment(orgId, campaign.segment_filter)
  const template = await getTemplate(campaign.template_id)
  const wa       = new WhatsAppService(org)

  const BATCH_SIZE = 50
  const DELAY_MS   = 650   // ~77 msgs/sec — safely under Meta's 80/sec limit

  await db('campaigns').where({ id: campaignId }).update({ status: 'running', started_at: new Date() })

  const batches = chunk(contacts, BATCH_SIZE)
  let processed = 0

  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(async (contact) => {
        try {
          const result = await wa.sendTemplate(contact.phone, template.name, [])
          await db('campaign_logs').insert({
            org_id:          orgId,
            campaign_id:     campaignId,
            contact_id:      contact.id,
            meta_message_id: result.data.messages[0].id,
            status:          'sent',
            sent_at:         new Date()
          })
        } catch (err) {
          await db('campaign_logs').insert({
            org_id:      orgId,
            campaign_id: campaignId,
            contact_id:  contact.id,
            status:      'failed',
            error_code:  err.response?.data?.error?.code,
            failed_at:   new Date()
          })
        }
      })
    )
    processed += batch.length
    await job.updateProgress(Math.round((processed / contacts.length) * 100))
    await sleep(DELAY_MS)
  }

  await db('campaigns')
    .where({ id: campaignId })
    .update({ status: 'completed', completed_at: new Date() })

}, { connection: redisConnection, concurrency: 3 })
```

---

## 9. Webhook Handler (Meta Events)

```ts
// routes/webhook.ts

// GET — Meta verification handshake
router.get('/webhook/whatsapp', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge)
  }
  res.sendStatus(403)
})

// POST — incoming events
router.post('/webhook/whatsapp', async (req, res) => {
  // Always ACK Meta immediately — never delay
  res.sendStatus(200)

  const signature = req.headers['x-hub-signature-256'] as string
  if (!verifyWebhookSignature(req.rawBody, signature)) return

  const entries = req.body.entry || []

  for (const entry of entries) {
    const wabaId = entry.id

    // DEDUP — prevent processing same webhook event twice (Redis SET NX TTL 60s)
    const isDup = await redis.set(`webhook:${wabaId}:${entry.id}`, '1', 'NX', 'EX', 60)
    if (!isDup) continue

    const org = await db('organizations').where({ waba_id: wabaId }).first()
    if (!org) continue

    for (const change of (entry.changes || [])) {
      await webhookProcessor.process(org, change.value)
    }
  }
})
```

### Webhook Processor
```ts
class WebhookProcessor {
  async process(org: Organization, value: any) {
    // Incoming messages → save to DB, push via WebSocket
    if (value.messages) {
      for (const msg of value.messages) {
        await this.handleIncoming(org, msg)
      }
    }
    // Delivery/read status updates → update campaign_logs
    if (value.statuses) {
      for (const status of value.statuses) {
        await this.handleStatus(org.id, status)
      }
    }
  }

  async handleStatus(orgId: string, status: any) {
    const update: Record<string, any> = { status: status.status }

    if (status.status === 'delivered') update.delivered_at = new Date()
    if (status.status === 'read')      update.read_at = new Date()
    if (status.status === 'failed')    update.failed_at = new Date()

    await db('campaign_logs')
      .where({ meta_message_id: status.id, org_id: orgId })
      .update(update)

    // Also update messages table for inbox
    await db('messages')
      .where({ meta_message_id: status.id, org_id: orgId })
      .update({ status: status.status })
  }

  async handleIncoming(org: Organization, msg: any) {
    const from  = msg.from
    const text  = msg.text?.body

    // Auto opt-out on STOP
    if (text?.toUpperCase() === org.opt_out_keyword?.toUpperCase()) {
      await db('contacts')
        .where({ org_id: org.id, phone: from })
        .update({ opted_in: false, opted_out_at: new Date() })
      return
    }

    // Find or create conversation
    let conv = await db('conversations').where({ org_id: org.id, contact_id: ... }).first()
    // Save message
    await db('messages').insert({ ... })
    // Push via WebSocket
    wsManager.sendToOrg(org.id, { type: 'NEW_MESSAGE', conversationId: conv.id, message: msg })
  }
}
```

---

## 10. Socket.IO Server

```ts
// websocket/ws.manager.ts

class WebSocketManager {
  private io: Server

  sendToOrg(orgId: string, payload: object) {
    this.io.to(`org:${orgId}`).emit('org:event', payload)
  }
}

export const wsManager = new WebSocketManager()
```

---

## 11. Redis Usage

| Key Pattern | Purpose | TTL |
|---|---|---|
| `org:{orgId}:ratelimit` | Per-org API rate limit counter | 60s |
| `webhook:{wabaId}:{eventId}` | Webhook dedup lock | 60s |
| `session:blacklist:{jti}` | Revoked JWT token blacklist | Token expiry |
| `campaign:{id}:progress` | Live broadcast progress % | 1 hour |
| `org:{orgId}:plan_cache` | Cached plan limits | 5 min |

---

## 12. Environment Variables

```env
# App
NODE_ENV=production
PORT=4000
APP_URL=https://app.zappy.in

# Database
DATABASE_URL=postgresql://user:pass@host:5432/zappy

# Redis
REDIS_HOST=xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=xxx

# JWT
JWT_SECRET=your-256-bit-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# Encryption
ENCRYPTION_KEY=64-char-hex-string    # 32 bytes = 64 hex chars

# Meta WhatsApp
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
WEBHOOK_VERIFY_TOKEN=your_custom_verify_token

# AWS
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=zappy-uploads
AWS_REGION=ap-south-1

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# SendGrid
SENDGRID_API_KEY=SG.xxx
FROM_EMAIL=noreply@zappy.in
```

---

## 13. Security Checklist

- All routes (except `/auth/*` and `/webhook/*`) protected by `auth` + `tenant` middleware
- Access tokens expire in 15 minutes; refresh tokens in 30 days
- Refresh tokens stored as httpOnly, Secure, SameSite=Strict cookies
- Revoked tokens stored in Redis blacklist (on logout)
- Meta access tokens encrypted at rest with AES-256-GCM (IV + AuthTag stored separately)
- Webhook payload signature verified via HMAC-SHA256 before processing
- All database queries scoped by `org_id` via Repository pattern — no cross-tenant leakage
- File uploads (CSV) scanned for size limits (max 10MB) and MIME type validation
- Redis keys namespaced by org: `org:{orgId}:*`
- S3 keys namespaced by org: `uploads/{orgId}/{uuid}.csv`
- Rate limiting: 100 req/min per org on API, 10 req/min on auth endpoints
- CORS restricted to `APP_URL` domain only
- Helmet.js headers enabled

---

## 14. Error Handling

All errors flow through `middleware/errorHandler.ts`:

```ts
app.use((err, req, res, next) => {
  const status  = err.status || 500
  const code    = err.code   || 'INTERNAL_ERROR'
  const message = err.message || 'Something went wrong'

  logger.error({ status, code, message, stack: err.stack, orgId: req.orgId })

  res.status(status).json({ error: { code, message } })
})
```

**Standard error codes:**

| Code | HTTP | Description |
|---|---|---|
| `AUTH_INVALID_TOKEN` | 401 | JWT invalid or expired |
| `AUTH_NO_ORG` | 403 | User has no organization |
| `PLAN_LIMIT_CONTACTS` | 403 | Contact limit reached |
| `PLAN_LIMIT_MESSAGES` | 403 | Message limit reached |
| `TEMPLATE_NOT_APPROVED` | 400 | Template not yet approved |
| `CONTACT_OPTED_OUT` | 400 | Contact has opted out |
| `WA_API_ERROR` | 502 | Meta API returned an error |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request body failed Zod validation |

---

## 15. Phase 2 Backend Features (Deferred)

- Chatbot / flow builder engine (state machine, conditions, delays)
- AI reply suggestions (OpenAI integration in inbox)
- WhatsApp catalog / product messages
- Recurring campaign scheduler
- Multi-number support per WABA
- White-label subdomain routing
- Zapier / outbound webhook triggers
- Advanced analytics (cohort analysis, revenue attribution)
- DPDP compliance audit logs
- Admin super-user panel
