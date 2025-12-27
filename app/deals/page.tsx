import { getSupabase } from "@/lib/supabase";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface SearchParams {
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function DealsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const supabase = getSupabase();

  let deals: Array<{
    id: string;
    loan_code: string;
    status_code: number | null;
    date_created: string | null;
    borrowers: Array<{
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      cell_phone: string | null;
    }>;
  }> = [];

  if (q && q.trim()) {
    const searchTerm = q.trim();

    // Search by loan_code, borrower name, email, or phone
    const { data, error } = await supabase
      .from("vl_deals")
      .select(
        `
        id,
        loan_code,
        status_code,
        date_created,
        borrowers:vl_borrowers(
          first_name,
          last_name,
          email,
          cell_phone
        )
      `
      )
      .or(
        `loan_code.ilike.%${searchTerm}%`
      )
      .order("date_created", { ascending: false })
      .limit(50);

    if (!error && data) {
      deals = data;
    }

    // If no results from loan_code, search borrowers
    if (deals.length === 0) {
      const { data: borrowerData } = await supabase
        .from("vl_borrowers")
        .select(
          `
          deal_id,
          first_name,
          last_name,
          email,
          cell_phone
        `
        )
        .or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cell_phone.ilike.%${searchTerm}%`
        )
        .limit(50);

      if (borrowerData && borrowerData.length > 0) {
        const dealIds = [...new Set(borrowerData.map((b) => b.deal_id))];

        const { data: dealData } = await supabase
          .from("vl_deals")
          .select(
            `
            id,
            loan_code,
            status_code,
            date_created,
            borrowers:vl_borrowers(
              first_name,
              last_name,
              email,
              cell_phone
            )
          `
          )
          .in("id", dealIds)
          .order("date_created", { ascending: false });

        if (dealData) {
          deals = dealData;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Deal Search</CardTitle>
            <CardDescription>
              Search by loan code, name, phone, or email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Form */}
            <form method="GET">
              <div className="flex gap-3">
                <Input
                  type="text"
                  name="q"
                  defaultValue={q || ""}
                  placeholder="Enter loan code, name, phone, or email..."
                  className="flex-1"
                />
                <Button type="submit">Search</Button>
              </div>
            </form>

            {/* Results */}
            {q && (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  {deals.length} result{deals.length !== 1 ? "s" : ""} for &quot;{q}&quot;
                </p>

                {deals.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan Code</TableHead>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deals.map((deal) => {
                        const primaryBorrower = deal.borrowers?.[0];
                        const name = primaryBorrower
                          ? `${primaryBorrower.first_name || ""} ${primaryBorrower.last_name || ""}`.trim()
                          : "—";
                        const contact =
                          primaryBorrower?.email ||
                          primaryBorrower?.cell_phone ||
                          "—";
                        const date = deal.date_created
                          ? new Date(deal.date_created).toLocaleDateString()
                          : "—";

                        return (
                          <TableRow key={deal.id}>
                            <TableCell className="font-medium">
                              {deal.loan_code}
                            </TableCell>
                            <TableCell>{name || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {contact}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {date}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={`/deals/${deal.loan_code}`}
                                className="text-primary hover:underline font-medium"
                              >
                                View Proposal
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <svg
                        className="mx-auto h-12 w-12 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium">
                        No deals found
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try a different search term
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Empty state when no search */}
            {!q && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium">
                    Search for deals
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter a loan code, borrower name, phone number, or email
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
