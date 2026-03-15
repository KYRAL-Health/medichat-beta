/**
 * Article metadata from PubMed
 */
export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi?: string;
  pubmedUrl: string;
}

import { XMLParser } from 'fast-xml-parser';

interface ParsedItem {
  '@_Name': string;
  '#text'?: string;
  Item?: ParsedItem | ParsedItem[];
}

interface DocSum {
  Id: string;
  Item: ParsedItem | ParsedItem[];
}

interface SearchResult {
  eSearchResult: {
    IdList?: {
      Id: string | string[];
    };
  };
}

/**
 * Rate limiter for NCBI E-utilities API
 * Public API: 3 requests/second
 * With API key: 10 requests/second
 */
class NCBIRateLimiter {
  private lastRequestTime = 0;
  private readonly minInterval: number;

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

// Initialize rate limiter based on whether API key is configured
const hasApiKey = !!process.env.NCBI_API_KEY;
const rateLimiter = new NCBIRateLimiter(hasApiKey ? 10 : 3);

const parser = new XMLParser({ ignoreAttributes: false });

/**
 * Search PubMed for articles using NCBI E-utilities API
 * @param query Search terms (e.g., "diabetes treatment", "metformin efficacy")
 * @param maxResults Maximum number of articles to return (default: 3)
 * @returns Array of article metadata
 */
export async function searchPubMed(
  query: string,
  maxResults: number = 3
): Promise<PubMedArticle[]> {
  try {
    // Step 1: Search PubMed to get PMIDs
    await rateLimiter.throttle();
    
    const apiKey = process.env.NCBI_API_KEY || "";
    const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("term", query);
    searchUrl.searchParams.set("retmax", Math.min(maxResults, 10).toString());
    searchUrl.searchParams.set("sort", "relevance");
    searchUrl.searchParams.set("retmode", "xml");
    if (apiKey) {
      searchUrl.searchParams.set("api_key", apiKey);
    }

    const searchResponse = await fetch(searchUrl.toString(), {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!searchResponse.ok) {
      throw new Error(`PubMed search failed: ${searchResponse.status}`);
    }

    const searchXml = await searchResponse.text();
    const searchDoc: SearchResult = parser.parse(searchXml);
    const idList = searchDoc.eSearchResult.IdList;
    const pmids = idList ? (Array.isArray(idList.Id) ? idList.Id : [idList.Id]) : [];

    if (pmids.length === 0) {
      return [];
    }

    // Step 2: Fetch article summaries
    await rateLimiter.throttle();
    
    const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
    summaryUrl.searchParams.set("db", "pubmed");
    summaryUrl.searchParams.set("id", pmids.join(","));
    summaryUrl.searchParams.set("retmode", "xml");
    if (apiKey) {
      summaryUrl.searchParams.set("api_key", apiKey);
    }

    const summaryResponse = await fetch(summaryUrl.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!summaryResponse.ok) {
      throw new Error(`PubMed summary fetch failed: ${summaryResponse.status}`);
    }

    const summaryXml = await summaryResponse.text();
    
    // Split and parse each DocSum separately
    const docSumStrings = summaryXml.split('<DocSum>').slice(1).map(s => '<DocSum>' + s.split('</DocSum>')[0] + '</DocSum>');
    const articles: PubMedArticle[] = [];

    for (const docSumString of docSumStrings) {
      try {
        const docSum = parser.parse(docSumString);
        const items = Array.isArray(docSum.DocSum.Item) ? docSum.DocSum.Item : [docSum.DocSum.Item];
        const pmid = docSum.DocSum.Id;
        if (!pmid) continue;

        const titleItem = items.find((item: ParsedItem) => item['@_Name'] === 'Title');
        const title = titleItem?.['#text'] || 'Unknown Title';

        const authorListItem = items.find((item: ParsedItem) => item['@_Name'] === 'AuthorList');
        let authors = 'Unknown Authors';
        if (authorListItem?.Item) {
          const authorItems = Array.isArray(authorListItem.Item) ? authorListItem.Item : [authorListItem.Item];
          const authorNames = authorItems.map((i: ParsedItem) => i['#text'] || '').filter(Boolean);
          if (authorNames.length > 0) {
            authors = authorNames.slice(0, 3).join(', ');
            if (authorNames.length > 3) {
              authors += ' et al.';
            }
          }
        }

        const journalItem = items.find((item: ParsedItem) => item['@_Name'] === 'FullJournalName');
        const journal = journalItem?.['#text'] || 'Unknown Journal';

        const pubDateItem = items.find((item: ParsedItem) => item['@_Name'] === 'PubDate');
        let year = 'Unknown Year';
        if (pubDateItem?.['#text']) {
          const yearStr = pubDateItem['#text'];
          const yearNum =
          typeof yearStr === 'number'
            ? [String(yearStr)]
            : yearStr.match(/\d{4}/);
          year = yearNum ? yearNum[0] : yearStr;
        }

        const doiItem = items.find((item: ParsedItem) => item['@_Name'] === 'DOI');
        const doi = doiItem?.['#text'];

        articles.push({
          pmid,
          title,
          authors,
          journal,
          year,
          doi,
          pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        });
      } catch (parseError) {
        console.error('Error parsing article:', parseError);
        continue;
      }
    }

    return articles.slice(0, maxResults);
  } catch (error) {
    console.error("PubMed search error:", error);
    throw new Error("PUBMED_SEARCH_FAILED");
  }
}

/**
 * Format articles as a numbered markdown reference list
 */
export function formatArticleCitations(articles: PubMedArticle[]): string {
  if (articles.length === 0) {
    return "No articles found.";
  }

  return articles
    .map((article, index) => {
      const number = index + 1;
      return `${number}. ${article.authors} (${article.year}). "${article.title}". *${article.journal}*. [PMID:${article.pmid}](${article.pubmedUrl})`;
    })
    .join("\n");
}
