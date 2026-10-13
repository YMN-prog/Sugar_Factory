
import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Farmer = {
  id: number;
  name: string;
  village: string;
  sugarcane_tons: number | string;
  amount_paid: number | string;
  payment_pending: number | string;
};

type Report = {
  farmerRecordCount: number;
  totalSugarcaneTons: number;
  totalPaymentDone: number;
  totalPaymentPending: number;
  highestSupply: Farmer | null;
  highestPending: Farmer | null;
  pendingFarmers: Farmer[];
};

const API = "/api";

const emptyReport: Report = {
  farmerRecordCount: 0,
  totalSugarcaneTons: 0,
  totalPaymentDone: 0,
  totalPaymentPending: 0,
  highestSupply: null,
  highestPending: null,
  pendingFarmers: [],
};

function numberValue(value: number | string | undefined): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value: number | string | undefined): string {
  return numberValue(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: number | string | undefined): string {
  return `₹${numberValue(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function App() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [report, setReport] = useState<Report>(emptyReport);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("sugarcane_tons");
  const [page, setPage] = useState<"dashboard" | "farmers" | "payments">(
    "dashboard"
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [farmersResponse, reportResponse] = await Promise.all([
        fetch(`${API}/farmers`),
        fetch(`${API}/report/pending`),
      ]);

      if (!farmersResponse.ok) {
        throw new Error("Unable to load farmer records.");
      }

      if (!reportResponse.ok) {
        throw new Error("Unable to load the payment report.");
      }

      const farmersData: Farmer[] = await farmersResponse.json();
      const reportData: Partial<Report> = await reportResponse.json();

      setFarmers(Array.isArray(farmersData) ? farmersData : []);
      setReport({
        ...emptyReport,
        ...reportData,
        highestSupply: reportData.highestSupply ?? null,
        highestPending: reportData.highestPending ?? null,
        pendingFarmers: Array.isArray(reportData.pendingFarmers)
          ? reportData.pendingFarmers
          : [],
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredFarmers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return [...farmers]
      .filter(
        (farmer) =>
          farmer.name.toLowerCase().includes(term) ||
          farmer.village.toLowerCase().includes(term) ||
          String(farmer.id).includes(term)
      )
      .sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }

        if (sortBy === "payment_pending") {
          return (
            numberValue(b.payment_pending) -
            numberValue(a.payment_pending)
          );
        }

        if (sortBy === "amount_paid") {
          return numberValue(b.amount_paid) - numberValue(a.amount_paid);
        }

        return (
          numberValue(b.sugarcane_tons) -
          numberValue(a.sugarcane_tons)
        );
      });
  }, [farmers, search, sortBy]);

  function exportCSV() {
    const headers = [
      "ID",
      "Farmer Name",
      "Village",
      "Sugarcane Tons",
      "Amount Paid",
      "Payment Pending",
    ];

    const rows = filteredFarmers.map((farmer) => [
      farmer.id,
      farmer.name,
      farmer.village,
      farmer.sugarcane_tons,
      farmer.amount_paid,
      farmer.payment_pending,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sanjivani-farmer-records.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function askAI(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question.trim()) return;

    setAsking(true);
    setAnswer("");

    try {
      const response = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The AI request failed.");
      }

      setAnswer(data.answer || "No answer was returned.");
    } catch (err) {
      setAnswer(
        err instanceof Error ? err.message : "Could not contact the AI service."
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">S</div>
          <div>
            <h2>Sanjivani</h2>
            <p>Sugar Factory</p>
          </div>
        </div>

        <p className="nav-label">MAIN MENU</p>

        <button
          className={`nav-item ${page === "dashboard" ? "active" : ""}`}
          onClick={() => setPage("dashboard")}
        >
          <span>▦</span> Dashboard
        </button>

        <button
          className={`nav-item ${page === "farmers" ? "active" : ""}`}
          onClick={() => setPage("farmers")}
        >
          <span>♙</span> Farmer Records
        </button>

        <button
          className={`nav-item ${page === "payments" ? "active" : ""}`}
          onClick={() => setPage("payments")}
        >
          <span>₹</span> Pending Payments
        </button>

        <div className="sidebar-footer">
          <div className="status-dot" />
          <div>
            <strong>System status</strong>
            <p>{loading ? "Connecting..." : error ? "Needs attention" : "Connected"}</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">FARMER MANAGEMENT SYSTEM</p>
            <h1>
              {page === "dashboard"
                ? "Dashboard"
                : page === "farmers"
                  ? "Farmer Records"
                  : "Pending Payments"}
            </h1>
          </div>

          <div className="top-actions">
            <button className="secondary-button" onClick={() => void loadData()}>
              ↻ Refresh
            </button>
            <div className="avatar">SF</div>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            <strong>Connection issue:</strong> {error}
            <button onClick={() => void loadData()}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="loading-panel">
            <div className="spinner" />
            <p>Loading farmer records...</p>
          </div>
        ) : (
          <>
            {page === "dashboard" && (
              <>
                <section className="welcome-panel">
                  <div>
                    <p className="welcome-tag">FARMER PERFORMANCE OVERVIEW</p>
                    <h2>Welcome to Sanjivani Sugar Factory</h2>
                    <p>
                      Monitor sugarcane supply, farmer payments and factory
                      records in one place.
                    </p>
                  </div>
                  <div className="welcome-symbol">🌾</div>
                </section>

                <section className="stats-grid">
                  <StatCard
                    label="Total Farmer Records"
                    value={formatNumber(farmers.length)}
                    note="Records in database"
                    icon="♙"
                    color="green"
                  />
                  <StatCard
                    label="Sugarcane Supplied"
                    value={`${formatNumber(report.totalSugarcaneTons)} t`}
                    note="Total recorded tonnage"
                    icon="🌾"
                    color="blue"
                  />
                  <StatCard
                    label="Total Payment Done"
                    value={formatCurrency(report.totalPaymentDone)}
                    note="Amount paid in database"
                    icon="₹"
                    color="purple"
                  />
                  <StatCard
                    label="Pending Payments"
                    value={formatCurrency(report.totalPaymentPending)}
                    note="Outstanding recorded amount"
                    icon="◷"
                    color="orange"
                  />
                </section>

                <section className="content-grid">
                  <div className="panel highlight-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">TOP SUPPLIER</p>
                        <h2>Highest Sugarcane Supply</h2>
                      </div>
                      <span className="round-icon green">↗</span>
                    </div>

                    {report.highestSupply ? (
                      <div className="supplier-content">
                        <div className="farmer-avatar">
                          {report.highestSupply.name?.charAt(0) ?? "F"}
                        </div>
                        <h3>{report.highestSupply.name}</h3>
                        <p>{report.highestSupply.village}</p>
                        <div className="big-number">
                          {formatNumber(report.highestSupply.sugarcane_tons)}
                          <span> tons</span>
                        </div>
                        <div className="supplier-footer">
                          <span>Pending payment</span>
                          <strong>
                            {formatCurrency(
                              report.highestSupply.payment_pending
                            )}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <EmptyState message="No supplier data available." />
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">PAYMENT OVERVIEW</p>
                        <h2>Payment Summary</h2>
                      </div>
                      <span className="round-icon orange">₹</span>
                    </div>

                    <div className="payment-summary">
                      <div className="payment-row">
                        <span>Total payment done</span>
                        <strong className="text-green">
                          {formatCurrency(report.totalPaymentDone)}
                        </strong>
                      </div>
                      <div className="payment-row">
                        <span>Total payment pending</span>
                        <strong className="text-orange">
                          {formatCurrency(report.totalPaymentPending)}
                        </strong>
                      </div>
                      <div className="payment-row">
                        <span>Farmers with pending payments</span>
                        <strong>{report.pendingFarmers.length}</strong>
                      </div>
                    </div>

                    <button
                      className="primary-button full-width"
                      onClick={() => setPage("payments")}
                    >
                      View pending payments →
                    </button>
                  </div>
                </section>

                <section className="panel table-panel">
                  <div className="panel-heading responsive-heading">
                    <div>
                      <p className="eyebrow">DATABASE</p>
                      <h2>Farmer Records</h2>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => setPage("farmers")}
                    >
                      View all farmers →
                    </button>
                  </div>

                  <FarmerTable farmers={farmers.slice(0, 5)} />
                </section>

                <AIBox
                  question={question}
                  setQuestion={setQuestion}
                  answer={answer}
                  asking={asking}
                  askAI={askAI}
                />
              </>
            )}

            {page === "farmers" && (
              <>
                <section className="stats-grid compact-stats">
                  <StatCard
                    label="Farmer Records"
                    value={formatNumber(farmers.length)}
                    note="Database rows"
                    icon="♙"
                    color="green"
                  />
                  <StatCard
                    label="Total Supply"
                    value={`${formatNumber(report.totalSugarcaneTons)} t`}
                    note="Recorded sugarcane"
                    icon="🌾"
                    color="blue"
                  />
                </section>

                <section className="panel table-panel">
                  <div className="panel-heading responsive-heading">
                    <div>
                      <p className="eyebrow">FARMER DATABASE</p>
                      <h2>All Farmer Records</h2>
                    </div>
                    <button className="primary-button" onClick={exportCSV}>
                      ↓ Export CSV
                    </button>
                  </div>

                  <div className="table-controls">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search farmer, village or ID..."
                      aria-label="Search farmer records"
                    />

                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      aria-label="Sort farmer records"
                    >
                      <option value="sugarcane_tons">Highest supply</option>
                      <option value="payment_pending">Highest pending</option>
                      <option value="amount_paid">Highest paid</option>
                      <option value="name">Farmer name A–Z</option>
                    </select>
                  </div>

                  <p className="result-count">
                    Showing {filteredFarmers.length} of {farmers.length} records
                  </p>

                  <FarmerTable farmers={filteredFarmers} />
                </section>

                <AIBox
                  question={question}
                  setQuestion={setQuestion}
                  answer={answer}
                  asking={asking}
                  askAI={askAI}
                />
              </>
            )}

            {page === "payments" && (
              <section className="panel table-panel">
                <div className="panel-heading responsive-heading">
                  <div>
                    <p className="eyebrow">ACCOUNTS</p>
                    <h2>Pending Farmer Payments</h2>
                  </div>
                  <button className="secondary-button" onClick={exportCSV}>
                    ↓ Export CSV
                  </button>
                </div>

                <div className="payment-total-banner">
                  <div>
                    <p>Total recorded pending payment</p>
                    <h2>{formatCurrency(report.totalPaymentPending)}</h2>
                  </div>
                  <span className="round-icon orange">₹</span>
                </div>

                {report.pendingFarmers.length > 0 ? (
                  <FarmerTable farmers={report.pendingFarmers} showPendingOnly />
                ) : (
                  <EmptyState message="No pending payments found in the report." />
                )}
              </section>
            )}
          </>
        )}

        <footer className="footer">
          Sanjivani Sugar Factory · Farmer Management System
        </footer>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  icon,
  color,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <h2>{value}</h2>
      <p>{note}</p>
    </div>
  );
}

function FarmerTable({
  farmers,
  showPendingOnly = false,
}: {
  farmers: Farmer[];
  showPendingOnly?: boolean;
}) {
  if (farmers.length === 0) {
    return <EmptyState message="No farmer records to display." />;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Village</th>
            <th>Sugarcane (t)</th>
            {!showPendingOnly && <th>Amount Paid</th>}
            <th>Payment Pending</th>
          </tr>
        </thead>
        <tbody>
          {farmers.map((farmer, index) => (
            <tr key={`${farmer.id}-${index}`}>
              <td>
                <div className="farmer-cell">
                  <span className="mini-avatar">
                    {farmer.name?.charAt(0) ?? "F"}
                  </span>
                  <div>
                    <strong>{farmer.name}</strong>
                    <small>ID: {farmer.id}</small>
                  </div>
                </div>
              </td>
              <td>{farmer.village}</td>
              <td className="numeric">
                {formatNumber(farmer.sugarcane_tons)}
              </td>
              {!showPendingOnly && (
                <td className="numeric">
                  {formatCurrency(farmer.amount_paid)}
                </td>
              )}
              <td>
                <span
                  className={`amount-pill ${
                    numberValue(farmer.payment_pending) > 0
                      ? "pending"
                      : "paid"
                  }`}
                >
                  {formatCurrency(farmer.payment_pending)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AIBox({
  question,
  setQuestion,
  answer,
  asking,
  askAI,
}: {
  question: string;
  setQuestion: (value: string) => void;
  answer: string;
  asking: boolean;
  askAI: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel ai-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">AI POWERED INSIGHTS</p>
          <h2>Ask Your Farmer Data Assistant</h2>
          <p className="panel-description">
            Ask questions about sugarcane supply, payments or farmer records.
          </p>
        </div>
        <span className="ai-icon">✦</span>
      </div>

      <form className="ai-form" onSubmit={askAI}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. Which farmer has the highest pending payment?"
          maxLength={1000}
          required
        />
        <button className="primary-button" disabled={asking}>
          {asking ? "Thinking..." : "Ask AI ✦"}
        </button>
      </form>

      {answer && (
        <div className="ai-answer">
          <strong>AI Answer</strong>
          <p>{answer}</p>
        </div>
      )}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

export default App;
