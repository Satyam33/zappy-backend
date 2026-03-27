type WhatsAppConnectionStatus = {
  connected: boolean;
  qualityRating: string | null;
  messagingLimit: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  statusMessage: string;
};

export class WhatsAppService {
  private readonly graphBaseUrl = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v22.0"}`;

  async sendTemplate(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  private async graphRequest<T>(input: {
    method: "GET" | "POST";
    path: string;
    accessToken: string;
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  }): Promise<T> {
    const url = new URL(`${this.graphBaseUrl}/${input.path}`);
    if (input.query) {
      Object.entries(input.query).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    url.searchParams.set("access_token", input.accessToken);

    const response = await fetch(url.toString(), {
      method: input.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: input.body ? JSON.stringify(input.body) : undefined
    });
    const json = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      throw Object.assign(new Error(json.error?.message || "Meta API request failed"), {
        status: 502,
        code: "WHATSAPP_API_FAILED"
      });
    }
    return json as T;
  }

  async submitTemplateForApproval(input: {
    wabaId: string;
    accessToken: string;
    name: string;
    language: string;
    category: "marketing" | "utility" | "authentication";
    body: string;
    sampleValues: Record<string, string>;
    interactiveActions: Array<{ type: string; title: string; value?: string }>;
  }): Promise<{ id?: string; status?: string }> {
    const variables = Array.from(
      new Set([...input.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]))
    ).sort((a, b) => Number(a) - Number(b));
    const bodyExamples = variables.map((v) => input.sampleValues[v] || `sample_${v}`);

    const components: Array<Record<string, unknown>> = [
      {
        type: "BODY",
        text: input.body,
        ...(bodyExamples.length ? { example: { body_text: [bodyExamples] } } : {})
      }
    ];

    const buttonActions = input.interactiveActions
      .filter((a) => ["URL", "PHONE", "QUICK_REPLY"].includes(a.type))
      .map((action): Record<string, unknown> => {
        if (action.type === "URL") {
          return { type: "URL", text: action.title.slice(0, 25), url: action.value || "" };
        }
        if (action.type === "PHONE") {
          return { type: "PHONE_NUMBER", text: action.title.slice(0, 25), phone_number: action.value || "" };
        }
        return { type: "QUICK_REPLY", text: action.title.slice(0, 25) };
      })
      .filter((item) => {
        if (item.type === "URL") return Boolean(item.url as string | undefined);
        if (item.type === "PHONE_NUMBER") return Boolean(item.phone_number as string | undefined);
        return true;
      });

    if (buttonActions.length) {
      components.push({ type: "BUTTONS", buttons: buttonActions });
    }

    return this.graphRequest<{ id?: string; status?: string }>({
      method: "POST",
      path: `${encodeURIComponent(input.wabaId)}/message_templates`,
      accessToken: input.accessToken,
      body: {
        name: input.name,
        language: input.language,
        category: input.category.toUpperCase(),
        components
      }
    });
  }

  async fetchTemplatesStatus(input: {
    wabaId: string;
    accessToken: string;
    names?: string[];
  }): Promise<Array<{ id?: string; name?: string; status?: string; rejected_reason?: string }>> {
    const response = await this.graphRequest<{
      data?: Array<{ id?: string; name?: string; status?: string; rejected_reason?: string }>;
    }>({
      method: "GET",
      path: `${encodeURIComponent(input.wabaId)}/message_templates`,
      accessToken: input.accessToken,
      query: { fields: "id,name,status,rejected_reason" }
    });
    const list = response.data || [];
    if (!input.names?.length) return list;
    const nameSet = new Set(input.names);
    return list.filter((item) => item.name && nameSet.has(item.name));
  }

  async sendTemplateMessage(input: {
    accessToken: string;
    phoneNumberId: string;
    to: string;
    templateName: string;
    language: string;
    bodyParameters: string[];
  }): Promise<{ messages?: Array<{ id?: string }> }> {
    return this.graphRequest<{ messages?: Array<{ id?: string }> }>({
      method: "POST",
      path: `${encodeURIComponent(input.phoneNumberId)}/messages`,
      accessToken: input.accessToken,
      body: {
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.language || "en" },
          ...(input.bodyParameters.length
            ? {
                components: [
                  {
                    type: "body",
                    parameters: input.bodyParameters.map((value) => ({ type: "text", text: value }))
                  }
                ]
              }
            : {})
        }
      }
    });
  }

  async getConnectionStatus(input: {
    accessToken: string;
    phoneNumberId: string;
  }): Promise<WhatsAppConnectionStatus> {
    const { accessToken, phoneNumberId } = input;

    const url = new URL(`${this.graphBaseUrl}/${encodeURIComponent(phoneNumberId)}`);
    url.searchParams.set(
      "fields",
      "verified_name,quality_rating,display_phone_number"
    );
    url.searchParams.set("access_token", accessToken);
        console.log("WhatsApp API status check url:", url.toString());
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    const json = (await response.json()) as {
      verified_name?: string;
      quality_rating?: string;
      messaging_limit?: string;
      display_phone_number?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw Object.assign(new Error(json.error?.message || "Meta API status check failed"), {
        status: 502,
        code: "WHATSAPP_STATUS_CHECK_FAILED"
      });
    }

    return {
      connected: true,
      qualityRating: json.quality_rating ?? null,
      messagingLimit: json.messaging_limit ?? null,
      displayPhoneNumber: json.display_phone_number ?? null,
      verifiedName: json.verified_name ?? null,
      statusMessage: "WhatsApp API connected"
    };
  }
}
