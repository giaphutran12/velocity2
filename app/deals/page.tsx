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

interface SearchParams {
  q?: string;
  broker_id?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function DealsPage({ searchParams }: PageProps) {
  const { q, broker_id } = await searchParams;
  const supabase = await createClient();

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
    let dealsQuery = queryClient
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
      );

    // If admin with selected broker, filter by broker_id
    if (userIsAdmin && selectedBrokerId && selectedBrokerId !== "all") {
      dealsQuery = dealsQuery.eq("broker_id", selectedBrokerId);
    }

    const { data, error } = await dealsQuery
      .order("date_created", { ascending: false })
      .limit(50);

    if (!error && data) {
      deals = data;
    }

    // If no results from loan_code, search borrowers
    if (deals.length === 0) {
      const { data: borrowerData } = await queryClient
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

        let dealDataQuery = queryClient
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
          .in("id", dealIds);

        // If admin with selected broker, filter by broker_id
        if (userIsAdmin && selectedBrokerId && selectedBrokerId !== "all") {
          dealDataQuery = dealDataQuery.eq("broker_id", selectedBrokerId);
        }

        const { data: dealData } = await dealDataQuery
          .order("date_created", { ascending: false });

        if (dealData) {
          deals = dealData;
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with broker name and sign out */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {userIsAdmin ? (
            <form method="GET" className="flex items-center gap-3">
              <span className="font-semibold text-primary">Admin View</span>
              {q && <input type="hidden" name="q" value={q} />}
              <Select name="broker_id" defaultValue={selectedBrokerId || "all"}>
                <SelectTrigger className="w-[200px]">
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
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-semibold">Welcome, {broker?.name}</span>
            </div>
          )}
          <SignOutButton />
        </div>
      </header>

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
