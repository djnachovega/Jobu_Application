import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";

export interface HttpClient {
  client: AxiosInstance;
  jar: CookieJar;
}

export function createHttpClient(): HttpClient {
  const jar = new CookieJar();
  const client = wrapper(axios.create({
    jar,
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
    withCredentials: true,
    maxRedirects: 5,
  }));
  
  return { client, jar };
}

export function parseHtml(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
