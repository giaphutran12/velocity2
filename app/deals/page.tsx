import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SignOutButton from "./_components/sign-out-button";
import { RefreshDealsButton } from "./_components/refresh-deals-button";

interface SearchParams {
  q?: string;
  broker_id?: string;
  page?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function DealsPage({ searchParams }: PageProps) {
  const { q, broker_id, page: pageParam } = await searchParams;
  const supabase = await createClient();

  // Pagination setup
  const pageSize = 20;
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10));
  const offset = (currentPage - 1) * pageSize;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin(user.email);

  // Variables for broker info and admin data
  let broker: { id: string; name: string } | null = null;
  let allBrokers: Array<{ id: string; name: string }> = [];
  let selectedBrokerId: string | undefined = broker_id;

  if (userIsAdmin) {
    // Admin: fetch all brokers using admin client
    const adminSupabase = await createAdminClient();
    const { data: brokers } = await adminSupabase
      .from("vl_brokers")
      .select("id, name")
      .order("name");
    allBrokers = brokers || [];
  } else {
    // Regular user: get their linked broker
    const { data: brokerData } = await supabase
      .from("vl_brokers")
      .select("id, name")
      .eq("user_id", user.id)
      .single();

    if (!brokerData) {
      // User not linked to a broker yet
      redirect("/register/confirm-broker");
    }
    broker = brokerData;
  }

  // Determine which client to use for queries
  const queryClient = userIsAdmin ? await createAdminClient() : supabase;

  let deals: Array<{
    id: string;
    loan_code: string;
    status_code: number | null;
    date_created: string | null;
    broker: { name: string } | null;
    borrowers: Array<{
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      cell_phone: string | null;
    }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }> = [] as any;
  let totalCount = 0;

  if (q && q.trim()) {
    const searchTerm = q.trim();

    // Search by loan_code, borrower name, email, or phone
    let dealsQuery = queryClient
      .from("vl_deals")
      .select(
        `
        id,
        loan_code,
        status_code,
        date_created,
        broker:vl_brokers(name),
        borrowers:vl_borrowers(
          first_name,
          last_name,
          email,
          cell_phone
        )
      `,
        { count: "exact" }
      )
      .or(
        `loan_code.ilike.%${searchTerm}%`
      );

    // If admin with selected broker, filter by broker_id
    if (userIsAdmin && selectedBrokerId && selectedBrokerId !== "all") {
      dealsQuery = dealsQuery.eq("broker_id", selectedBrokerId);
    }

    const { data, error, count } = await dealsQuery
      .order("date_created", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deals = data as any;
      totalCount = count || 0;
    }

    // If no results from loan_code, search borrowers
    if (deals.length === 0) {
      // Build borrower query with broker filter FIRST (not after)
      let borrowerQuery = queryClient
        .from("vl_borrowers")
        .select(
          `
          deal_id,
          first_name,
          last_name,
          email,
          cell_phone,
          vl_deals!inner(broker_id)
        `
        )
        .or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cell_phone.ilike.%${searchTerm}%`
        );

      // Filter by broker BEFORE querying (not after)
      if (userIsAdmin && selectedBrokerId && selectedBrokerId !== "all") {
        borrowerQuery = borrowerQuery.eq("vl_deals.broker_id", selectedBrokerId);
      }

      const { data: borrowerData } = await borrowerQuery.limit(50);

      if (borrowerData && borrowerData.length > 0) {
        const dealIds = [...new Set(borrowerData.map((b) => b.deal_id))];

        const { data: dealData } = await queryClient
          .from("vl_deals")
          .select(
            `
            id,
            loan_code,
            status_code,
            date_created,
            broker:vl_brokers(name),
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          deals = dealData as any;
        }
      }
    }
  } else {
    // No search query - show recent deals by default
    let recentDealsQuery = queryClient
      .from("vl_deals")
      .select(
        `
        id,
        loan_code,
        status_code,
        date_created,
        broker:vl_brokers(name),
        borrowers:vl_borrowers(
          first_name,
          last_name,
          email,
          cell_phone
        )
      `,
        { count: "exact" }
      );

    // Apply broker filter for admin
    if (userIsAdmin && selectedBrokerId && selectedBrokerId !== "all") {
      recentDealsQuery = recentDealsQuery.eq("broker_id", selectedBrokerId);
    }

    const { data, count } = await recentDealsQuery
      .order("date_created", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deals = data as any;
      totalCount = count || 0;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with broker name and sign out */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {userIsAdmin ? (
            <div className="flex items-center gap-3">
              <form method="GET" className="flex items-center gap-3">
                <span className="font-semibold text-primary">Admin View</span>
                {q && <input type="hidden" name="q" value={q} />}
                <Select name="broker_id" defaultValue={selectedBrokerId || "all"}>
                  <SelectTrigger className="w-50">
                    <SelectValue placeholder="All Brokers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brokers</SelectItem>
                    {allBrokers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" variant="outline" size="sm">
                  Apply
                </Button>
              </form>
              <RefreshDealsButton isAdmin={true} selectedBrokerId={selectedBrokerId} />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-semibold">Welcome, {broker?.name}</span>
              <RefreshDealsButton isAdmin={false} />
            </div>
          )}
          <SignOutButton />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
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
              {selectedBrokerId && selectedBrokerId !== "all" && (
                <input type="hidden" name="broker_id" value={selectedBrokerId} />
              )}
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
            <div>
              {(() => {
                const totalPages = Math.ceil(totalCount / pageSize);
                const startItem = totalCount > 0 ? offset + 1 : 0;
                const endItem = Math.min(offset + pageSize, totalCount);

                // Build URL params for pagination links
                const buildPageUrl = (page: number) => {
                  const params = new URLSearchParams();
                  params.set("page", page.toString());
                  if (q) params.set("q", q);
                  if (selectedBrokerId && selectedBrokerId !== "all") params.set("broker_id", selectedBrokerId);
                  return `?${params.toString()}`;
                };

                return (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      {totalCount > 0
                        ? `Showing ${startItem} to ${endItem} of ${totalCount} deal${totalCount !== 1 ? "s" : ""}${q ? ` for "${q}"` : ""}`
                        : q
                          ? `No results for "${q}"`
                          : "No deals available"}
                    </p>

                    {deals.length > 0 ? (
                      <>
                        <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan Code</TableHead>
                      {userIsAdmin && (!selectedBrokerId || selectedBrokerId === "all") && (
                        <TableHead>Owner</TableHead>
                      )}
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
                      // Handle broker as array (Supabase returns array for joins)
                      const brokerName = Array.isArray(deal.broker)
                        ? deal.broker[0]?.name
                        : deal.broker?.name;

                      return (
                        <TableRow key={deal.id}>
                          <TableCell className="font-medium">
                            {deal.loan_code}
                          </TableCell>
                          {userIsAdmin && (!selectedBrokerId || selectedBrokerId === "all") && (
                            <TableCell className="text-muted-foreground">
                              {brokerName || "—"}
                            </TableCell>
                          )}
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

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                              Page {currentPage} of {totalPages}
                            </p>
                            <div className="flex gap-2">
                              {currentPage > 1 && (
                                <Button asChild variant="outline" size="sm">
                                  <Link href={buildPageUrl(currentPage - 1)}>
                                    Previous
                                  </Link>
                                </Button>
                              )}
                              {currentPage < totalPages && (
                                <Button asChild variant="outline" size="sm">
                                  <Link href={buildPageUrl(currentPage + 1)}>
                                    Next
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
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
                            {q ? "Try a different search term" : "No recent deals available"}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
