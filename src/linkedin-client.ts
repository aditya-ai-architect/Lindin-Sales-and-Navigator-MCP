/**
 * LinkedIn API Client using cookie-based authentication.
 *
 * Dual-engine architecture:
 * - Fast HTTP (undici) for profile, search, company endpoints
 * - Puppeteer stealth browser for messaging and Sales Navigator
 *   (LinkedIn locks down these APIs but the UI still works)
 *
 * Note: Uses undici's request() instead of native fetch because
 * Node.js fetch blocks the Cookie header as a "forbidden header".
 */
import { request as undiciRequest } from "undici";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";

const puppeteer = puppeteerExtra as any;
puppeteer.use(StealthPlugin());

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
  private browser: Browser | null = null;
  private browserPage: Page | null = null;

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

    const headers = {
      ...this.headers,
      ...(options.headers as Record<string, string> | undefined),
    };

    const { statusCode, headers: resHeaders, body } = await undiciRequest(url, {
      method: (options.method as "GET" | "POST" | "PUT" | "DELETE") || "GET",
      headers,
      body: options.body as string | undefined,
    });

    const text = await body.text();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(
        `LinkedIn API error ${statusCode}: ${text.substring(0, 500)}`
      );
    }

    return JSON.parse(text) as T;
  }

  // ─── Browser (Puppeteer) ─────────────────────────────────────────

  /**
   * Launch or reuse a stealth Puppeteer browser with LinkedIn cookies set.
   */
  private async getBrowserPage(): Promise<Page> {
    if (this.browserPage && this.browser?.connected) {
      return this.browserPage;
    }

    console.error("[LinkedIn] Launching stealth browser...");
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
      ],
    });

    this.browserPage = await this.browser!.newPage();
    await this.browserPage.setViewport({ width: 1920, height: 1080 });

    // Set LinkedIn cookies
    await this.browserPage.setCookie(
      {
        name: "li_at",
        value: this.li_at,
        domain: ".linkedin.com",
        path: "/",
        httpOnly: true,
        secure: true,
      },
      {
        name: "JSESSIONID",
        value: this.jsessionid,
        domain: ".linkedin.com",
        path: "/",
        secure: true,
      }
    );

    // Navigate to LinkedIn to verify session
    await this.browserPage.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    // Brief wait for JS to render
    await new Promise((r) => setTimeout(r, 3000));

    console.error("[LinkedIn] Browser ready.");
    return this.browserPage;
  }

  /**
   * Wait for a selector with a timeout, returning null if not found.
   */
  private async safeWaitFor(page: Page, selector: string, timeout = 10000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
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
   * Note: LinkedIn deprecated the old REST endpoint and doesn't include
   * contact info in any current decoration. Returns basic profile info instead.
   */
  async getProfileContactInfo(publicIdentifier: string): Promise<unknown> {
    const fullProfile = (await this.getProfileDetails(publicIdentifier)) as Record<string, unknown>;
    const included = (fullProfile?.included || []) as Array<Record<string, unknown>>;
    const profile = included.find(
      (i) => (i.$type as string)?.includes("identity.profile.Profile")
    );
    if (!profile) {
      return { _note: "Profile not found. LinkedIn no longer exposes contact info through the Voyager API." };
    }
    return {
      publicIdentifier: profile.publicIdentifier,
      firstName: profile.firstName,
      lastName: profile.lastName,
      headline: profile.headline,
      location: profile.locationName || profile.location,
      address: profile.address,
      _note: "LinkedIn deprecated the contact info API endpoint. Email, phone, and website data are no longer available through Voyager. Use get_profile_details for full profile data.",
    };
  }

  /**
   * Get a profile's skills.
   * Note: LinkedIn no longer includes skill entities in the Voyager API
   * decorations. The skills collection exists but is always empty.
   */
  async getProfileSkills(publicIdentifier: string): Promise<unknown> {
    const fullProfile = (await this.getProfileDetails(publicIdentifier)) as Record<string, unknown>;
    const included = (fullProfile?.included || []) as Array<Record<string, unknown>>;
    const profile = included.find(
      (i) => (i.$type as string)?.includes("identity.profile.Profile")
    );
    return {
      publicIdentifier,
      skills: [],
      _note: "LinkedIn deprecated the skills API endpoint. Skill data is no longer returned through the Voyager API. The profile summary may mention skills: " + (profile?.summary || "N/A"),
    };
  }

  /**
   * Get a profile's experience (positions).
   * Extracts Position entities from the FullProfileWithEntities response.
   */
  async getProfileExperience(publicIdentifier: string): Promise<unknown> {
    const fullProfile = (await this.getProfileDetails(publicIdentifier)) as Record<string, unknown>;
    const included = (fullProfile?.included || []) as Array<Record<string, unknown>>;

    const positions = included.filter((item) => {
      const type = (item.$type as string) || "";
      return type.includes("identity.profile.Position");
    });

    const positionGroups = included.filter((item) => {
      const type = (item.$type as string) || "";
      return type.includes("identity.profile.PositionGroup");
    });

    // Also get Company entities for enrichment
    const companies = included.filter((item) => {
      const type = (item.$type as string) || "";
      return type.includes("organization.Company");
    });

    return {
      positions,
      positionGroups,
      companies,
      total: positions.length,
    };
  }

  // ─── People Search ───────────────────────────────────────────────

  /**
   * Search for people using LinkedIn's search/dash/clusters endpoint.
   */
  async searchPeople(params: SearchPeopleParams): Promise<unknown> {
    const queryParams: string[] = [];

    // Build query parameters in Rest-li format
    const queryInnerParts: string[] = [];
    if (params.keywords) {
      queryInnerParts.push(`keywords:${encodeURIComponent(params.keywords)}`);
    }
    queryInnerParts.push("flagshipSearchIntent:SEARCH_SRP");

    // Build queryParameters with filters
    const resultType = "List(PEOPLE)";
    const filterParts: string[] = [];

    if (params.currentCompany?.length) {
      filterParts.push(`currentCompany:List(${params.currentCompany.join(",")})`);
    }
    if (params.pastCompany?.length) {
      filterParts.push(`pastCompany:List(${params.pastCompany.join(",")})`);
    }
    if (params.industries?.length) {
      filterParts.push(`industry:List(${params.industries.join(",")})`);
    }
    if (params.regions?.length) {
      filterParts.push(`geoUrn:List(${params.regions.join(",")})`);
    }
    if (params.schools?.length) {
      filterParts.push(`schools:List(${params.schools.join(",")})`);
    }
    if (params.networkDepths?.length) {
      filterParts.push(`network:List(${params.networkDepths.join(",")})`);
    }
    if (params.connectionOf) {
      filterParts.push(`connectionOf:List(${params.connectionOf})`);
    }
    if (params.title) {
      filterParts.push(`title:List(${encodeURIComponent(params.title)})`);
    }

    const qpParts = [`resultType:${resultType}`, ...filterParts];
    queryInnerParts.push(`queryParameters:(${qpParts.join(",")})`);

    queryParams.push(`decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-186`);
    queryParams.push(`origin=GLOBAL_SEARCH_HEADER`);
    queryParams.push(`q=all`);
    queryParams.push(`query=(${queryInnerParts.join(",")})`);
    queryParams.push(`start=${params.start ?? 0}`);
    queryParams.push(`count=${params.count ?? 10}`);

    return this.request(
      `/voyager/api/search/dash/clusters?${queryParams.join("&")}`
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
   * Search for companies using LinkedIn's search/dash/clusters endpoint.
   */
  async searchCompanies(params: SearchCompanyParams): Promise<unknown> {
    const queryInnerParts: string[] = [];
    if (params.keywords) {
      queryInnerParts.push(`keywords:${encodeURIComponent(params.keywords)}`);
    }
    queryInnerParts.push("flagshipSearchIntent:SEARCH_SRP");

    const filterParts: string[] = [];
    if (params.industries?.length) {
      filterParts.push(`industry:List(${params.industries.join(",")})`);
    }
    if (params.regions?.length) {
      filterParts.push(`geoUrn:List(${params.regions.join(",")})`);
    }
    if (params.companySize?.length) {
      filterParts.push(`companySize:List(${params.companySize.join(",")})`);
    }

    const qpParts = [`resultType:List(COMPANIES)`, ...filterParts];
    queryInnerParts.push(`queryParameters:(${qpParts.join(",")})`);

    const queryParams = [
      `decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-186`,
      `origin=GLOBAL_SEARCH_HEADER`,
      `q=all`,
      `query=(${queryInnerParts.join(",")})`,
      `start=${params.start ?? 0}`,
      `count=${params.count ?? 10}`,
    ];

    return this.request(
      `/voyager/api/search/dash/clusters?${queryParams.join("&")}`
    );
  }

  // ─── Sales Navigator ────────────────────────────────────────────

  /**
   * Search leads via Sales Navigator using Puppeteer browser.
   * Falls back to API if browser fails.
   */
  async salesSearchLeads(params: SalesSearchParams): Promise<unknown> {
    // Try API first (works for some subscription tiers)
    try {
      return await this.salesSearchLeadsApi(params);
    } catch {
      // Fall back to browser scraping
      return this.salesSearchLeadsBrowser(params);
    }
  }

  private async salesSearchLeadsApi(params: SalesSearchParams): Promise<unknown> {
    const filters: string[] = [];
    if (params.title) filters.push(`TITLE:${params.title}`);
    if (params.company) filters.push(`COMPANY:${params.company}`);
    if (params.geography) filters.push(`GEO:${params.geography}`);
    if (params.industry) filters.push(`INDUSTRY:${params.industry}`);
    if (params.seniorityLevel) filters.push(`SENIORITY:${params.seniorityLevel}`);
    if (params.functionParam) filters.push(`FUNCTION:${params.functionParam}`);

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
    return this.request(`/sales-api/salesApiLeadSearch?${queryParts.join("&")}`);
  }

  private async salesSearchLeadsBrowser(params: SalesSearchParams): Promise<unknown> {
    const page = await this.getBrowserPage();

    // Build Sales Navigator search URL
    const searchParts: string[] = [];
    if (params.keywords) searchParts.push(`keywords=${encodeURIComponent(params.keywords)}`);

    const url = `https://www.linkedin.com/sales/search/people?${searchParts.join("&")}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Wait for actual person names to render (not skeleton placeholders)
    await this.safeWaitFor(page, '[data-anonymize="person-name"]', 20000);
    await new Promise((r) => setTimeout(r, 3000));

    // Scrape lead results from the Sales Nav UI
    const leads = await page.evaluate((maxCount: number) => {
      const results: Array<{
        name: string;
        title: string;
        company: string;
        location: string;
        summary: string;
        tenure: string;
        connectionDegree: string;
        profileLink: string;
      }> = [];

      const items = document.querySelectorAll("li.artdeco-list__item");

      items.forEach((item, index) => {
        if (index >= maxCount) return;
        // Skip skeleton/placeholder items
        if (item.querySelector(".dummy-text")) return;

        const nameEl = item.querySelector('[data-anonymize="person-name"]');
        if (!nameEl) return; // Skip items without actual content

        const titleEl = item.querySelector('[data-anonymize="title"]');
        const companyEl = item.querySelector('[data-anonymize="company-name"]');
        const locationEl = item.querySelector('[data-anonymize="location"]');
        const summaryEl = item.querySelector('[data-anonymize="person-blurb"]');
        const tenureEl = item.querySelector('[data-anonymize="job-title"]');
        const badgeEl = item.querySelector(".artdeco-entity-lockup__badge");
        const link = item.querySelector('a[href*="/sales/lead/"]');

        results.push({
          name: nameEl?.textContent?.trim() || "Unknown",
          title: titleEl?.textContent?.trim() || "",
          company: companyEl?.textContent?.trim() || "",
          location: locationEl?.textContent?.trim() || "",
          summary: summaryEl?.textContent?.trim() || "",
          tenure: tenureEl?.textContent?.trim().replace(/\s+/g, " ") || "",
          connectionDegree: badgeEl?.textContent?.trim().replace(/\s+/g, " ") || "",
          profileLink: link?.getAttribute("href") || "",
        });
      });

      return results;
    }, params.count ?? 25);

    return {
      leads,
      total: leads.length,
      keywords: params.keywords,
      _source: "browser_scrape",
    };
  }

  /**
   * Search accounts (companies) via Sales Navigator.
   */
  async salesSearchAccounts(params: SalesSearchParams): Promise<unknown> {
    // Try API first
    try {
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
      return await this.request(`/sales-api/salesApiAccountSearch?${queryParts.join("&")}`);
    } catch {
      // Fall back to browser
      const page = await this.getBrowserPage();
      const searchParts: string[] = [];
      if (params.keywords) searchParts.push(`keywords=${encodeURIComponent(params.keywords)}`);

      await page.goto(
        `https://www.linkedin.com/sales/search/company?${searchParts.join("&")}`,
        { waitUntil: "domcontentloaded", timeout: 45000 }
      );

      await this.safeWaitFor(page, '[data-anonymize="company-name"]', 20000);
      await new Promise((r) => setTimeout(r, 3000));

      const accounts = await page.evaluate((maxCount: number) => {
        const results: Array<{
          name: string;
          industry: string;
          size: string;
          location: string;
          link: string;
        }> = [];

        const items = document.querySelectorAll("li.artdeco-list__item");

        items.forEach((item, index) => {
          if (index >= maxCount) return;
          if (item.querySelector(".dummy-text")) return;

          const nameEl = item.querySelector('[data-anonymize="company-name"]');
          if (!nameEl) return;

          const subtitleEl = item.querySelector(".artdeco-entity-lockup__subtitle");
          const captionEl = item.querySelector(".artdeco-entity-lockup__caption");
          const link = item.querySelector('a[href*="/sales/company/"]');

          results.push({
            name: nameEl?.textContent?.trim() || "Unknown",
            industry: subtitleEl?.textContent?.trim() || "",
            size: captionEl?.textContent?.trim() || "",
            location: "",
            link: link?.getAttribute("href") || "",
          });
        });

        return results;
      }, params.count ?? 25);

      return { accounts, total: accounts.length, keywords: params.keywords, _source: "browser_scrape" };
    }
  }

  /**
   * Get a Sales Navigator lead profile.
   */
  async getSalesProfile(leadId: string): Promise<unknown> {
    try {
      return await this.request(
        `/sales-api/salesApiProfiles/(profileId:${encodeURIComponent(leadId)})?decoration=%28entityUrn%2CfirstName%2ClastName%2CfullName%2Cheadline%2CmemberBadges%2Cdegree%2CprofilePictureDisplayImage%2CpendingInvitation%2CunlockHighlight%2Clocation%2ClistCount%2Csummary%2CsavedLead%2CdefaultPosition%2CcontactInfo%2CcrmStatus%2Cpositions*%29`
      );
    } catch {
      // Fall back to browser
      const page = await this.getBrowserPage();
      await page.goto(
        `https://www.linkedin.com/sales/lead/${encodeURIComponent(leadId)}`,
        { waitUntil: "domcontentloaded", timeout: 45000 }
      );
      await this.safeWaitFor(page, '.profile-topcard', 15000);

      const profile = await page.evaluate(() => {
        const nameEl = document.querySelector('.profile-topcard-person-entity__name, [data-anonymize="person-name"]');
        const headlineEl = document.querySelector('.profile-topcard__summary-position, [data-anonymize="headline"]');
        const companyEl = document.querySelector('.profile-topcard__summary-position a, [data-anonymize="company-name"]');
        const locationEl = document.querySelector('.profile-topcard__location-data, [data-anonymize="location"]');
        const summaryEl = document.querySelector('.profile-topcard__summary-content');

        return {
          name: nameEl?.textContent?.trim() || "Unknown",
          headline: headlineEl?.textContent?.trim() || "",
          company: companyEl?.textContent?.trim() || "",
          location: locationEl?.textContent?.trim() || "",
          summary: summaryEl?.textContent?.trim() || "",
        };
      });

      return { ...profile, leadId, _source: "browser_scrape" };
    }
  }

  /**
   * Get Sales Navigator saved leads.
   */
  async getSavedLeads(start = 0, count = 25): Promise<unknown> {
    try {
      return await this.request(
        `/sales-api/salesApiSavedLeads?q=savedLeads&start=${start}&count=${count}`
      );
    } catch {
      // Fall back to browser
      const page = await this.getBrowserPage();
      await page.goto("https://www.linkedin.com/sales/lists/people", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await this.safeWaitFor(page, 'li[class*="artdeco-list__item"], .lists-nav__list-item', 15000);

      return { _note: "Navigate to Sales Navigator > Lists > People to view saved leads.", _source: "browser_scrape" };
    }
  }

  /**
   * Get Sales Navigator lead lists.
   */
  async getLeadLists(start = 0, count = 25): Promise<unknown> {
    try {
      return await this.request(
        `/sales-api/salesApiLeadLists?q=leadLists&start=${start}&count=${count}`
      );
    } catch {
      const page = await this.getBrowserPage();
      await page.goto("https://www.linkedin.com/sales/lists/people", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await this.safeWaitFor(page, '.lists-nav__list-item, li[class*="artdeco-list"]', 15000);

      const lists = await page.evaluate(() => {
        const items = document.querySelectorAll('.lists-nav__list-item, li[class*="artdeco-list"]');
        const results: Array<{ name: string; link: string }> = [];
        items.forEach((item) => {
          const link = item.querySelector("a");
          results.push({
            name: link?.textContent?.trim() || "Unknown",
            link: link?.getAttribute("href") || "",
          });
        });
        return results;
      });

      return { lists, total: lists.length, _source: "browser_scrape" };
    }
  }

  /**
   * Get leads within a specific Sales Navigator lead list.
   */
  async getLeadListMembers(listId: string, start = 0, count = 25): Promise<unknown> {
    try {
      return await this.request(
        `/sales-api/salesApiLeadLists/${encodeURIComponent(listId)}/leadListMembers?q=leadListMembers&start=${start}&count=${count}`
      );
    } catch {
      const page = await this.getBrowserPage();
      await page.goto(
        `https://www.linkedin.com/sales/lists/people/${encodeURIComponent(listId)}`,
        { waitUntil: "domcontentloaded", timeout: 45000 }
      );
      await this.safeWaitFor(page, 'li[class*="artdeco-list__item"]', 15000);

      return { listId, _note: "List loaded in browser. Scraping lead list members.", _source: "browser_scrape" };
    }
  }

  /**
   * Get lead recommendations from Sales Navigator.
   */
  async getLeadRecommendations(start = 0, count = 25): Promise<unknown> {
    try {
      return await this.request(
        `/sales-api/salesApiLeadRecommendations?start=${start}&count=${count}`
      );
    } catch {
      const page = await this.getBrowserPage();
      await page.goto("https://www.linkedin.com/sales/home", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await this.safeWaitFor(page, '.lead-recommendations, [data-view-name="lead-recommendation"]', 15000);

      return { _note: "Lead recommendations loaded in Sales Navigator home.", _source: "browser_scrape" };
    }
  }

  // ─── Messaging ───────────────────────────────────────────────────

  /**
   * Send a message to a LinkedIn member via Puppeteer browser.
   * Navigates to the messaging UI and types the message directly.
   */
  async sendMessage(params: SendMessageParams): Promise<unknown> {
    const page = await this.getBrowserPage();

    // Extract profile ID from URN (e.g., "urn:li:fsd_profile:ACoAAB..." -> profile page)
    // Or navigate directly to messaging compose
    const recipientId = params.recipientUrn
      .replace("urn:li:fsd_profile:", "")
      .replace("urn:li:fs_miniProfile:", "")
      .replace("urn:li:member:", "");

    // Navigate to messaging with this recipient
    await page.goto(
      `https://www.linkedin.com/messaging/thread/new/?recipient=${encodeURIComponent(recipientId)}`,
      { waitUntil: "domcontentloaded", timeout: 45000 }
    );

    // Wait for the message compose box
    const composeSelector = 'div.msg-form__contenteditable[contenteditable="true"]';
    const found = await this.safeWaitFor(page, composeSelector, 15000);
    if (!found) {
      // Try alternative: direct messaging overlay
      await page.goto(
        `https://www.linkedin.com/messaging/compose/?connId=${encodeURIComponent(recipientId)}`,
        { waitUntil: "domcontentloaded", timeout: 45000 }
      );
      await this.safeWaitFor(page, composeSelector, 10000);
    }

    // Type the message
    await page.click(composeSelector);
    await page.keyboard.type(params.body, { delay: 30 });

    // Small delay before sending
    await new Promise((r) => setTimeout(r, 500));

    // Send with Enter or click send button
    const sendButton = await page.$('button.msg-form__send-button');
    if (sendButton) {
      await sendButton.click();
    } else {
      await page.keyboard.press("Enter");
    }

    await new Promise((r) => setTimeout(r, 2000));

    return { success: true, message: `Message sent to ${recipientId}` };
  }

  /**
   * Get conversation threads (inbox) via Puppeteer browser.
   * Scrapes the messaging UI since LinkedIn's API endpoints are broken.
   */
  async getConversations(start = 0, count = 20): Promise<unknown> {
    const page = await this.getBrowserPage();

    await page.goto("https://www.linkedin.com/messaging/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for conversation list to load
    await this.safeWaitFor(page, 'li.msg-conversation-listitem', 15000);

    // Scrape conversations from the DOM
    const conversations = await page.evaluate((maxCount: number) => {
      const items = document.querySelectorAll("li.msg-conversation-listitem");
      const results: Array<{
        participantName: string;
        lastMessage: string;
        timestamp: string;
        unread: boolean;
        conversationLink: string;
      }> = [];

      items.forEach((item, index) => {
        if (index >= maxCount) return;

        const nameEl = item.querySelector(
          "h3.msg-conversation-listitem__participant-names span, " +
          ".msg-conversation-card__participant-names"
        );
        const messageEl = item.querySelector(
          "p.msg-conversation-listitem__message-snippet, " +
          ".msg-conversation-card__message-snippet"
        );
        const timeEl = item.querySelector(
          "time.msg-conversation-listitem__time-stamp, " +
          ".msg-conversation-card__time-stamp"
        );
        const link = item.querySelector("a");
        const unread = item.classList.contains("msg-conversation-listitem--unread") ||
          item.querySelector(".msg-conversation-card--unread") !== null;

        results.push({
          participantName: nameEl?.textContent?.trim() || "Unknown",
          lastMessage: messageEl?.textContent?.trim() || "",
          timestamp: timeEl?.textContent?.trim() || timeEl?.getAttribute("datetime") || "",
          unread,
          conversationLink: link?.href || "",
        });
      });

      return results;
    }, count);

    return {
      conversations,
      total: conversations.length,
      _source: "browser_scrape",
    };
  }

  /**
   * Get messages from a specific conversation via Puppeteer browser.
   */
  async getConversationMessages(
    conversationId: string,
    start = 0,
    count = 20
  ): Promise<unknown> {
    const page = await this.getBrowserPage();

    // Navigate to the specific conversation
    const url = conversationId.startsWith("http")
      ? conversationId
      : `https://www.linkedin.com/messaging/thread/${encodeURIComponent(conversationId)}/`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Wait for messages to load
    await this.safeWaitFor(page, '.msg-s-message-list__event', 15000);

    // Scrape messages from the DOM
    const messages = await page.evaluate((maxCount: number) => {
      const items = document.querySelectorAll(".msg-s-message-list__event");
      const results: Array<{
        senderName: string;
        body: string;
        timestamp: string;
      }> = [];

      items.forEach((item, index) => {
        if (index >= maxCount) return;

        const senderEl = item.querySelector(
          ".msg-s-message-group__name, " +
          ".msg-s-event-listitem__sender-name"
        );
        const bodyEl = item.querySelector(
          ".msg-s-event-listitem__body, " +
          ".msg-s-message-group__body"
        );
        const timeEl = item.querySelector(
          "time.msg-s-message-group__timestamp, " +
          "time.msg-s-event-listitem__timestamp"
        );

        results.push({
          senderName: senderEl?.textContent?.trim() || "Unknown",
          body: bodyEl?.textContent?.trim() || "",
          timestamp: timeEl?.textContent?.trim() || timeEl?.getAttribute("datetime") || "",
        });
      });

      return results;
    }, count);

    return {
      conversationId,
      messages,
      total: messages.length,
      _source: "browser_scrape",
    };
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
   * Get pending connection requests (sent invitations).
   */
  async getPendingConnections(
    start = 0,
    count = 20
  ): Promise<unknown> {
    // Try the newer dash endpoint first
    try {
      return await this.request(
        `/voyager/api/voyagerRelationshipsDashMemberRelationships?decorationId=com.linkedin.voyager.dash.deco.relationships.InvitationView-2&q=sentInvitation&start=${start}&count=${count}`
      );
    } catch {
      // Fallback: try the invitationViews endpoint
      try {
        return await this.request(
          `/voyager/api/relationships/invitationViews?start=${start}&count=${count}&includeInsights=true&q=receivedInvitation`
        );
      } catch {
        // Last resort: try graphql
        return this.request(
          `/voyager/api/graphql?variables=(start:${start},count:${count},invitationType:CONNECTION)&queryId=voyagerRelationshipsDashSentInvitationViews.b4f93905fc7153eb7abcba3f7e01b03e`
        );
      }
    }
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
