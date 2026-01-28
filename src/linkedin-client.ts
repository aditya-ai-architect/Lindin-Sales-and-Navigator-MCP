/**
 * LinkedIn API Client using cookie-based authentication.
 *
 * Uses the `li_at` session cookie and the `JSESSIONID` CSRF token
 * to call LinkedIn's internal Voyager API endpoints.
 */

export interface LinkedInClientConfig {
  li_at: string;
  jsessionid?: string;
}

export interface SearchPeopleParams {
  keywords?: string;
  connectionOf?: string;
  networkDepths?: string[];
  currentCompany?: string[];
  pastCompany?: string[];
  industries?: string[];
  regions?: string[];
  schools?: string[];
  title?: string;
  start?: number;
  count?: number;
}

export interface SearchCompanyParams {
  keywords?: string;
  industries?: string[];
  regions?: string[];
  companySize?: string[];
  start?: number;
  count?: number;
}

export interface SalesSearchParams {
  keywords?: string;
  title?: string;
  company?: string;
  geography?: string;
  industry?: string;
  seniorityLevel?: string;
  functionParam?: string;
  start?: number;
  count?: number;
}

export interface SendMessageParams {
  recipientUrn: string;
  subject?: string;
  body: string;
}

export class LinkedInClient {
  private li_at: string;
  private jsessionid: string;
  private baseUrl = "https://www.linkedin.com";

  constructor(config: LinkedInClientConfig) {
    this.li_at = config.li_at;
    // JSESSIONID is used as the CSRF token. If not provided, derive from li_at.
    this.jsessionid = config.jsessionid || `"ajax:${this.generateCsrfToken()}"`;
  }

  private generateCsrfToken(): string {
    // Generate a random CSRF-like token when JSESSIONID is not supplied
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 16; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private get headers(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/vnd.linkedin.normalized+json+2.1",
      "Accept-Language": "en-US,en;q=0.9",
      "x-li-lang": "en_US",
      "x-li-track": JSON.stringify({
        clientVersion: "1.13.8844",
        mpVersion: "1.13.8844",
        osName: "web",
        timezoneOffset: -5,
        timezone: "America/New_York",
        deviceFormFactor: "DESKTOP",
        mpName: "voyager-web",
      }),
      "x-li-page-instance":
        "urn:li:page:d_flagship3_search_srp_people;",
      "x-restli-protocol-version": "2.0.0",
      "csrf-token": this.jsessionid.replace(/"/g, ""),
      Cookie: `li_at=${this.li_at}; JSESSIONID=${this.jsessionid}`,
    };
  }

  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `LinkedIn API error ${response.status}: ${response.statusText} - ${text}`
      );
    }

    return response.json() as Promise<T>;
  }

  // ─── Profile / People ────────────────────────────────────────────

  /**
   * Get the current authenticated user's profile.
   */
  async getOwnProfile(): Promise<unknown> {
    return this.request("/voyager/api/me");
  }

  /**
   * Get a profile by public identifier (the vanity URL slug).
   */
  async getProfile(publicIdentifier: string): Promise<unknown> {
    return this.request(
      `/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicIdentifier)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-18`
    );
  }

  /**
   * Get detailed profile information including experience, education, skills.
   */
  async getProfileDetails(publicIdentifier: string): Promise<unknown> {
    return this.request(
      `/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(publicIdentifier)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`
    );
  }

  /**
   * Get a profile's contact information.
   */
  async getProfileContactInfo(publicIdentifier: string): Promise<unknown> {
    return this.request(
      `/voyager/api/identity/profiles/${encodeURIComponent(publicIdentifier)}/profileContactInfo`
    );
  }

  /**
   * Get a profile's skills.
   */
  async getProfileSkills(publicIdentifier: string): Promise<unknown> {
    return this.request(
      `/voyager/api/identity/profiles/${encodeURIComponent(publicIdentifier)}/skills?count=50`
    );
  }

  /**
   * Get a profile's experience.
   */
  async getProfileExperience(publicIdentifier: string): Promise<unknown> {
    return this.request(
      `/voyager/api/identity/profiles/${encodeURIComponent(publicIdentifier)}/positions?count=50`
    );
  }

  // ─── People Search ───────────────────────────────────────────────

  /**
   * Search for people using LinkedIn's standard search.
   */
  async searchPeople(params: SearchPeopleParams): Promise<unknown> {
    const filters: string[] = [];

    if (params.currentCompany?.length) {
      filters.push(
        `currentCompany->${params.currentCompany.map((c) => `List(${c})`).join(",")}`
      );
    }
    if (params.pastCompany?.length) {
      filters.push(
        `pastCompany->${params.pastCompany.map((c) => `List(${c})`).join(",")}`
      );
    }
    if (params.industries?.length) {
      filters.push(
        `industry->${params.industries.map((i) => `List(${i})`).join(",")}`
      );
    }
    if (params.regions?.length) {
      filters.push(
        `geoUrn->${params.regions.map((r) => `List(${r})`).join(",")}`
      );
    }
    if (params.schools?.length) {
      filters.push(
        `schools->${params.schools.map((s) => `List(${s})`).join(",")}`
      );
    }
    if (params.networkDepths?.length) {
      filters.push(
        `network->${params.networkDepths.map((n) => `List(${n})`).join(",")}`
      );
    }
    if (params.title) {
      filters.push(`title->${params.title}`);
    }

    const queryParts: string[] = [
      "origin=GLOBAL_SEARCH_HEADER",
      `q=all`,
      `start=${params.start ?? 0}`,
      `count=${params.count ?? 10}`,
    ];

    if (params.keywords) {
      queryParts.push(`keywords=${encodeURIComponent(params.keywords)}`);
    }
    if (filters.length) {
      queryParts.push(`filters=${encodeURIComponent(filters.join(","))}`);
    }

    return this.request(
      `/voyager/api/search/dash/clusters?${queryParts.join("&")}`
    );
  }

  // ─── Company / Organization ──────────────────────────────────────

  /**
   * Get company details by universal name (vanity URL).
   */
  async getCompany(universalName: string): Promise<unknown> {
    return this.request(
      `/voyager/api/organization/companies?decorationId=com.linkedin.voyager.deco.organization.web.WebFullCompanyMain-35&q=universalName&universalName=${encodeURIComponent(universalName)}`
    );
  }

  /**
   * Search for companies.
   */
  async searchCompanies(params: SearchCompanyParams): Promise<unknown> {
    const queryParts: string[] = [
      "origin=GLOBAL_SEARCH_HEADER",
      `q=all`,
      `queryContext=List(spellCorrectionEnabled->true,relatedSearchesEnabled->true)`,
      `type=COMPANIES`,
      `start=${params.start ?? 0}`,
      `count=${params.count ?? 10}`,
    ];

    if (params.keywords) {
      queryParts.push(`keywords=${encodeURIComponent(params.keywords)}`);
    }

    return this.request(
      `/voyager/api/search/dash/clusters?${queryParts.join("&")}`
    );
  }

  // ─── Sales Navigator ────────────────────────────────────────────

  /**
   * Search leads via Sales Navigator.
   */
  async salesSearchLeads(params: SalesSearchParams): Promise<unknown> {
    const filters: string[] = [];

    if (params.title) filters.push(`TITLE:${params.title}`);
    if (params.company) filters.push(`COMPANY:${params.company}`);
    if (params.geography) filters.push(`GEO:${params.geography}`);
    if (params.industry) filters.push(`INDUSTRY:${params.industry}`);
    if (params.seniorityLevel)
      filters.push(`SENIORITY:${params.seniorityLevel}`);
    if (params.functionParam)
      filters.push(`FUNCTION:${params.functionParam}`);

    const queryParts: string[] = [
      `q=searchQuery`,
      `start=${params.start ?? 0}`,
      `count=${params.count ?? 25}`,
    ];

    if (params.keywords) {
      queryParts.push(`query=(keywords:${encodeURIComponent(params.keywords)})`);
    }
    if (filters.length) {
      queryParts.push(
        `filters=List(${filters.map((f) => `(type:${f.split(":")[0]},values:List(${f.split(":")[1]}))`).join(",")})`
      );
    }

    return this.request(
      `/sales-api/salesApiLeadSearch?${queryParts.join("&")}`
    );
  }

  /**
   * Search accounts (companies) via Sales Navigator.
   */
  async salesSearchAccounts(params: SalesSearchParams): Promise<unknown> {
    const filters: string[] = [];

    if (params.geography) filters.push(`GEO:${params.geography}`);
    if (params.industry) filters.push(`INDUSTRY:${params.industry}`);

    const queryParts: string[] = [
      `q=searchQuery`,
      `start=${params.start ?? 0}`,
      `count=${params.count ?? 25}`,
    ];

    if (params.keywords) {
      queryParts.push(`query=(keywords:${encodeURIComponent(params.keywords)})`);
    }
    if (filters.length) {
      queryParts.push(
        `filters=List(${filters.map((f) => `(type:${f.split(":")[0]},values:List(${f.split(":")[1]}))`).join(",")})`
      );
    }

    return this.request(
      `/sales-api/salesApiAccountSearch?${queryParts.join("&")}`
    );
  }

  /**
   * Get a Sales Navigator lead profile.
   */
  async getSalesProfile(leadId: string): Promise<unknown> {
    return this.request(
      `/sales-api/salesApiProfiles/(profileId:${encodeURIComponent(leadId)})?decoration=%28entityUrn%2CfirstName%2ClastName%2CfullName%2Cheadline%2CmemberBadges%2Cdegree%2CprofilePictureDisplayImage%2CpendingInvitation%2CunlockHighlight%2Clocation%2ClistCount%2Csummary%2CsavedLead%2CdefaultPosition%2CcontactInfo%2CcrmStatus%2Cpositions*%29`
    );
  }

  /**
   * Get Sales Navigator saved leads.
   */
  async getSavedLeads(
    start = 0,
    count = 25
  ): Promise<unknown> {
    return this.request(
      `/sales-api/salesApiSavedLeads?q=savedLeads&start=${start}&count=${count}`
    );
  }

  /**
   * Get Sales Navigator lead lists.
   */
  async getLeadLists(start = 0, count = 25): Promise<unknown> {
    return this.request(
      `/sales-api/salesApiLeadLists?q=leadLists&start=${start}&count=${count}`
    );
  }

  /**
   * Get leads within a specific Sales Navigator lead list.
   */
  async getLeadListMembers(
    listId: string,
    start = 0,
    count = 25
  ): Promise<unknown> {
    return this.request(
      `/sales-api/salesApiLeadLists/${encodeURIComponent(listId)}/leadListMembers?q=leadListMembers&start=${start}&count=${count}`
    );
  }

  /**
   * Get lead recommendations from Sales Navigator.
   */
  async getLeadRecommendations(
    start = 0,
    count = 25
  ): Promise<unknown> {
    return this.request(
      `/sales-api/salesApiLeadRecommendations?start=${start}&count=${count}`
    );
  }

  // ─── Messaging ───────────────────────────────────────────────────

  /**
   * Send a message (InMail or regular) to a LinkedIn member.
   */
  async sendMessage(params: SendMessageParams): Promise<unknown> {
    const payload: Record<string, unknown> = {
      dedupeByClientGeneratedToken: false,
      message: {
        body: {
          text: params.body,
        },
        originToken: crypto.randomUUID(),
        renderContentUnions: [],
      },
    };

    if (params.subject) {
      (payload.message as Record<string, unknown>).subject = params.subject;
    }

    const mailboxUrn = params.recipientUrn;

    return this.request(
      `/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          mailboxUrn,
          trackingId: crypto.randomUUID(),
          hostRecipientUrns: [params.recipientUrn],
        }),
      }
    );
  }

  /**
   * Get conversation threads (inbox).
   */
  async getConversations(start = 0, count = 20): Promise<unknown> {
    return this.request(
      `/voyager/api/messaging/conversations?keyVersion=LEGACY_INBOX&start=${start}&count=${count}`
    );
  }

  /**
   * Get messages from a specific conversation.
   */
  async getConversationMessages(
    conversationId: string,
    start = 0,
    count = 20
  ): Promise<unknown> {
    return this.request(
      `/voyager/api/messaging/conversations/${encodeURIComponent(conversationId)}/events?start=${start}&count=${count}`
    );
  }

  // ─── Connections & Network ───────────────────────────────────────

  /**
   * Send a connection request.
   */
  async sendConnectionRequest(
    profileUrn: string,
    message?: string
  ): Promise<unknown> {
    const payload: Record<string, unknown> = {
      inviteeProfileUrn: profileUrn,
      trackingId: crypto.randomUUID(),
    };

    if (message) {
      payload.message = message;
    }

    return this.request(
      `/voyager/api/voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
  }

  /**
   * Get pending connection requests.
   */
  async getPendingConnections(
    start = 0,
    count = 20
  ): Promise<unknown> {
    return this.request(
      `/voyager/api/relationships/sentInvitationViewV2?invitationType=CONNECTION&start=${start}&count=${count}`
    );
  }

  // ─── Utility ─────────────────────────────────────────────────────

  /**
   * Validate that the session cookie is still active.
   */
  async validateSession(): Promise<boolean> {
    try {
      await this.getOwnProfile();
      return true;
    } catch {
      return false;
    }
  }
}
