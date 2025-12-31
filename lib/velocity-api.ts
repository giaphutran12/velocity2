import { VelocityDeal } from "./transformer";

interface Broker {
  api_key: string;
  base_url: string;
  name?: string;
}

interface VelocityResponse {
  pageNumber: number;
  totalPages: number;
  totalDeals: number;
  deals: VelocityDeal[];
}

/**
 * Fetch deals from Velocity API within a date range.
 * Handles pagination and rate limiting (200ms between pages).
 */
export async function fetchDealsInRange(
  broker: Broker,
  startDate: string,
  endDate: string
): Promise<VelocityDeal[]> {
  const allDeals: VelocityDeal[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${broker.base_url}/v1/deals?apikey=${broker.api_key}&startdate=${startDate}&enddate=${endDate}&datetype=1&page=${page}`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Velocity API error: ${response.status} - ${text}`);
    }

    const data: VelocityResponse = await response.json();
    allDeals.push(...data.deals);
    totalPages = data.totalPages;
    page++;

    if (page <= totalPages) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allDeals;
}
