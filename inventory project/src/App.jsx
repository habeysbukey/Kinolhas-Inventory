import React, { useState, useEffect, useMemo } from "react";
import { Package, PackageMinus, ClipboardList, PlusCircle, Search, RotateCcw, Trash2, X, AlertTriangle, CheckCircle2, Lock, Unlock, Download } from "lucide-react";

// URL of your deployed Google Apps Script Web App (see apps-script/Code.gs and README.md)
const API_URL = "https://script.google.com/macros/s/AKfycbxeFc9Yr3SA_QZv4vonYxf7htqA43qNRRLi2f3sBFOTv1AbL83bQdTder_JnlxlcUNwJg/exec";

const CATEGORIES = ["Stationery", "Craft & Art", "Cleaning", "Electronics", "Sports", "Lab Equipment", "Furniture", "Books", "Other"];


const STAFF_NAMES = ["Ahmed Suhail", "Aishath Aamaal", "Aishath Muna", "Aminath Shahma", "Fathimath Rihula", "Mohamed Thohir", "Musthafa Abdul Haris", "Shaufa Ahmed", "Aminath Fazla", "Ahmed Shamweel"];
const STORE_LOCATIONS = ["Office", "Safe Room", "Science Room", "Main Store", "Sports Room"];
const ADMIN_PIN = "MV550";
const LOW_STOCK_RATIO = 0.15; // flag items at or below 15% of their original stock
const LOW_STOCK_FLOOR = 3; // or fewer than this many units left, whichever is higher


function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return "—";
  // Google Sheets sometimes auto-converts a plain "YYYY-MM-DD" string into a
  // real Date cell, which comes back from the API as a full ISO string —
  // handle both that and a plain date string.
  const dt = typeof d === "string" && d.includes("T") ? new Date(d) : new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function isLowStock(item) {
  if (item.totalQty <= 0) return false;
  const threshold = Math.max(LOW_STOCK_FLOOR, Math.ceil(item.totalQty * LOW_STOCK_RATIO));
  return item.availableQty <= threshold;
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function InventoryPortal() {
  const [items, setItems] = useState(null);
  const [log, setLog] = useState(null);
  const [tab, setTab] = useState("items");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [showBorrow, setShowBorrow] = useState(null); // item being requested
  const [showIssueRequest, setShowIssueRequest] = useState(null); // pending request being reviewed
  const [showMultiIssue, setShowMultiIssue] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState(null);
  const [logSearch, setLogSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [stockInSearch, setStockInSearch] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [stockInLog, setStockInLog] = useState([]);

  async function apiGet() {
    const res = await fetch(`${API_URL}?action=getData`);
    if (!res.ok) throw new Error("Network error");
    return res.json();
  }

  async function apiPost(action, payload) {
    const res = await fetch(API_URL, {
      method: "POST",
      // text/plain avoids a CORS preflight against Apps Script's exec endpoint
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet();
        setItems(data.items || []);
        setLog(data.log || []);
        setStockInLog(data.stockInLog || []);
      } catch (e) {
        setError("Couldn't load data from the spreadsheet. Check your connection or the API_URL setting.");
        setItems([]);
        setLog([]);
      }
    })();
  }, []);

  async function refreshFromSheet() {
    try {
      const data = await apiGet();
      setItems(data.items || []);
      setLog(data.log || []);
      setStockInLog(data.stockInLog || []);
      setSyncMsg("Refreshed from the Google Sheet.");
    } catch (e) {
      setSyncMsg("Couldn't refresh — check your connection.");
    }
    setTimeout(() => setSyncMsg(""), 4000);
  }

  function requireAdmin(action) {
    if (isAdmin) {
      action();
    } else {
      setPendingAdminAction(() => action);
      setShowPinPrompt(true);
    }
  }

  async function addStock(payload) {
    try {
      const data = await apiPost("addStock", payload);
      setItems(data.items || []);
      setLog(data.log || []);
      setStockInLog(data.stockInLog || []);
      setShowAddItem(false);
    } catch (e) {
      setError("Couldn't add stock — check your connection and try again.");
    }
  }

  async function deleteItem(id) {
    try {
      const data = await apiPost("deleteItem", { id });
      setItems(data.items || []);
      setLog(data.log || []);
    } catch (e) {
      setError("Couldn't remove the item — check your connection and try again.");
    }
  }

  async function requestSingleItem({ requestedBy, role, purpose, requestedDate, lines }) {
    const line = lines[0];
    const item = items.find((it) => it.id === line.itemId);
    if (!item || line.qty < 1 || line.qty > item.availableQty) return;
    try {
      const data = await apiPost("requestStock", { requestedBy, role, purpose, requestedDate, lines });
      setLog(data.log || []);
      setShowBorrow(null);
    } catch (e) {
      setError("Couldn't submit the request — check your connection and try again.");
    }
  }

  async function requestMultipleItems({ requestedBy, role, purpose, requestedDate, lines }) {
    // lines: [{ itemId, qty }] — may reference items across different categories
    const stockLeft = {};
    items.forEach((it) => (stockLeft[it.id] = it.availableQty));

    const validLines = [];
    for (const line of lines) {
      const item = items.find((it) => it.id === line.itemId);
      if (!item || line.qty < 1) continue;
      if (line.qty > stockLeft[line.itemId]) continue; // skip if exceeds remaining stock (accounts for repeats)
      stockLeft[line.itemId] -= line.qty;
      validLines.push({ itemId: item.id, qty: line.qty });
    }
    if (validLines.length === 0) return false;

    try {
      const data = await apiPost("requestStock", { requestedBy, role, purpose, requestedDate, lines: validLines });
      setLog(data.log || []);
      setShowMultiIssue(false);
      return true;
    } catch (e) {
      setError("Couldn't submit the request — check your connection and try again.");
      return false;
    }
  }

  async function issueRequestAction({ requestId, issuedBy, remarks, issueDate }) {
    try {
      const data = await apiPost("issueRequest", { requestId, issuedBy, remarks, issueDate });
      setItems(data.items || []);
      setLog(data.log || []);
      setShowIssueRequest(null);
    } catch (e) {
      setError("Couldn't issue the request — check your connection and try again.");
    }
  }


  const filteredItems = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const lowStockItems = useMemo(
    () => (items || []).filter((it) => isLowStock(it)).sort((a, b) => a.availableQty - b.availableQty),
    [items]
  );

  const pendingRequests = useMemo(() => (log || []).filter((r) => r.status === "pending"), [log]);
  const issuedLog = useMemo(() => (log || []).filter((r) => r.status === "issued"), [log]);

  const filteredRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    if (!q) return pendingRequests;
    return pendingRequests.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        (r.itemCode || "").toLowerCase().includes(q) ||
        r.requestedBy.toLowerCase().includes(q) ||
        (r.purpose || "").toLowerCase().includes(q)
    );
  }, [pendingRequests, requestSearch]);

  const filteredLog = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return issuedLog;
    return issuedLog.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        (r.itemCode || "").toLowerCase().includes(q) ||
        r.requestedBy.toLowerCase().includes(q) ||
        (r.role || "").toLowerCase().includes(q) ||
        (r.issuedBy || "").toLowerCase().includes(q) ||
        fmtDate(r.issueDate).toLowerCase().includes(q)
    );
  }, [issuedLog, logSearch]);

  function exportLogCsv() {
    const rows = [
      ["Item code", "Item", "Category", "Quantity", "Requested by", "Role", "Purpose", "Requested date", "Issued by", "Remarks", "Issue date"],
      ...filteredLog.map((r) => {
        const item = items.find((it) => it.id === r.itemId);
        return [
          r.itemCode, r.itemName, item ? item.category : "", r.qty, r.requestedBy, r.role || "",
          r.purpose || "", fmtDate(r.requestedDate), r.issuedBy || "", r.remarks || "", fmtDate(r.issueDate),
        ];
      }),
    ];
    downloadCsv(`kinolhas-school-stock-out-log-${todayStr()}.csv`, rows);
  }

  function exportStockCsv() {
    const rows = [
      ["Item", "Category", "Total stocked", "Currently available", "Total issued"],
      ...items.map((it) => [it.name, it.category, it.totalQty, it.availableQty, it.totalQty - it.availableQty]),
    ];
    downloadCsv(`kinolhas-school-stock-levels-${todayStr()}.csv`, rows);
  }

  const filteredStockInLog = useMemo(() => {
    if (!stockInLog) return [];
    const q = stockInSearch.trim().toLowerCase();
    if (!q) return stockInLog;
    return stockInLog.filter(
      (r) =>
        (r.itemName || "").toLowerCase().includes(q) ||
        (r.supplier || "").toLowerCase().includes(q) ||
        (r.invoiceNumber || "").toLowerCase().includes(q) ||
        (r.poNumber || "").toLowerCase().includes(q) ||
        (r.storeLocation || "").toLowerCase().includes(q)
    );
  }, [stockInLog, stockInSearch]);

  function exportStockInCsv() {
    const rows = [
      ["Item", "Quantity", "Store location", "Supplier", "Invoice number", "Date", "PO number", "PO date", "Rate", "Item cost"],
      ...filteredStockInLog.map((r) => [
        r.itemName, r.qty, r.storeLocation, r.supplier, r.invoiceNumber,
        fmtDate(r.date), r.poNumber, fmtDate(r.poDate), r.rate, r.itemCost,
      ]),
    ];
    downloadCsv(`kinolhas-school-stock-in-log-${todayStr()}.csv`, rows);
  }

  const totalItems = items ? items.reduce((s, it) => s + it.totalQty, 0) : 0;
  const totalIssued = items ? items.reduce((s, it) => s + (it.totalQty - it.availableQty), 0) : 0;

  if (items === null || log === null) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingCard}>Loading inventory…</div>
      </div>
    );
  }

  if (!loggedInUser) {
    return <LoginScreen onLogin={(name) => setLoggedInUser(name)} />;
  }

  return (
    <div style={styles.page}>
      <style>{fontImports}</style>

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.badge}>
            <Package size={18} color={colors.paper} />
          </div>
          <div>
            <div style={styles.eyebrow}>RAA ATOLL, MALDIVES</div>
            <h1 style={styles.title}>KINOLHAS SCHOOL STOCK INVENTORY</h1>
          </div>
        </div>
        <div style={styles.headerStats}>
          <div style={styles.statBlock}>
            <div style={styles.statNum}>{totalItems}</div>
            <div style={styles.statLabel}>total stock</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statBlock}>
            <div style={{ ...styles.statNum, color: totalIssued > 0 ? colors.rust : colors.ink }}>
              {totalIssued}
            </div>
            <div style={styles.statLabel}>issued out</div>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.userBlock}>
            <span style={styles.userName}>{loggedInUser}</span>
            <button style={styles.signOutBtn} onClick={() => setLoggedInUser(null)} title="Sign out">
              Sign out
            </button>
          </div>
          <div style={styles.statDivider} />
          <button
            style={isAdmin ? { ...styles.adminBtn, ...styles.adminBtnActive } : styles.adminBtn}
            onClick={() => (isAdmin ? setIsAdmin(false) : requireAdmin(() => {}))}
            title={isAdmin ? "Admin unlocked — click to lock" : "Unlock admin actions"}
          >
            {isAdmin ? <Unlock size={13} /> : <Lock size={13} />}
            {isAdmin ? "Admin" : "Locked"}
          </button>
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={14} />
          <span>{error}</span>
          <button onClick={() => setError("")} style={styles.errorClose}>
            <X size={13} />
          </button>
        </div>
      )}

      {syncMsg && (
        <div style={styles.syncBanner}>
          <CheckCircle2 size={14} />
          <span>{syncMsg}</span>
        </div>
      )}

      <nav style={styles.tabs}>
        <button
          style={tab === "items" ? { ...styles.tab, ...styles.tabActive } : styles.tab}
          onClick={() => setTab("items")}
        >
          <Package size={15} /> Items
        </button>
        <button
          style={tab === "requests" ? { ...styles.tab, ...styles.tabActive } : styles.tab}
          onClick={() => setTab("requests")}
        >
          <ClipboardList size={15} /> Requests
          {pendingRequests.length > 0 && <span style={styles.tabCount}>{pendingRequests.length}</span>}
        </button>
        <button
          style={tab === "log" ? { ...styles.tab, ...styles.tabActive } : styles.tab}
          onClick={() => setTab("log")}
        >
          <ClipboardList size={15} /> Stock Out Log
        </button>
        <button
          style={tab === "in" ? { ...styles.tab, ...styles.tabActive } : styles.tab}
          onClick={() => setTab("in")}
        >
          <PlusCircle size={15} /> Stock In Log
        </button>
        <button style={styles.syncBtn} onClick={refreshFromSheet} title="Reload the latest data from the Google Sheet">
          <RotateCcw size={13} /> Refresh from sheet
        </button>
      </nav>

      {tab === "items" && (
        <section>
          {lowStockItems.length > 0 && (
            <div style={styles.lowStockBanner}>
              <AlertTriangle size={15} color={colors.rust} />
              <div>
                <strong>{lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} running low:</strong>{" "}
                {lowStockItems.slice(0, 6).map((it) => it.name).join(", ")}
                {lowStockItems.length > 6 ? `, +${lowStockItems.length - 6} more` : ""}
              </div>
            </div>
          )}
          <div style={styles.toolbar}>
            <div style={styles.searchWrap}>
              <Search size={15} color={colors.faint} />
              <input
                style={styles.searchInput}
                placeholder="Search items or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button style={styles.secondaryBtn} onClick={() => setShowMultiIssue(true)}>
              <PackageMinus size={15} /> Request stock
            </button>
            <button style={styles.primaryBtn} onClick={() => requireAdmin(() => setShowAddItem(true))}>
              <PlusCircle size={15} /> Add stock
            </button>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              text={items.length === 0 ? "No items yet. Add the first one to start the ledger." : "No items match that search."}
            />
          ) : (
            <div style={styles.grid}>
              {filteredItems.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  low={isLowStock(it)}
                  onBorrow={() => setShowBorrow(it)}
                  onDelete={() => requireAdmin(() => deleteItem(it.id))}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "requests" && (
        <section>
          <div style={styles.toolbar}>
            <div style={styles.searchWrap}>
              <Search size={15} color={colors.faint} />
              <input
                style={styles.searchInput}
                placeholder="Search by item, code, requester, or purpose…"
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
              />
            </div>
          </div>
          {filteredRequests.length === 0 ? (
            <EmptyState
              text={pendingRequests.length === 0 ? "No pending requests. Requests appear here once someone requests stock, waiting for the office to review and issue." : "No requests match that search."}
            />
          ) : (
            <div style={styles.logList}>
              {filteredRequests.map((r) => (
                <PendingRequestRow key={r.id} record={r} onReview={() => requireAdmin(() => setShowIssueRequest(r))} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "log" && (
        <section>
          <div style={styles.toolbar}>
            <div style={styles.searchWrap}>
              <Search size={15} color={colors.faint} />
              <input
                style={styles.searchInput}
                placeholder="Search by item, name, role, or date…"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
            </div>
            <button style={styles.secondaryBtn} onClick={exportStockCsv}>
              <Download size={15} /> Export stock levels
            </button>
            <button style={styles.primaryBtn} onClick={exportLogCsv}>
              <Download size={15} /> Export log
            </button>
          </div>
          {filteredLog.length === 0 ? (
            <EmptyState
              text={issuedLog.length === 0 ? "No stock issued yet. Records appear here once a request has been reviewed and issued." : "No log entries match that search."}
            />
          ) : (
            <div style={styles.logList}>
              {filteredLog.map((r) => (
                <LogRow key={r.id} record={r} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "in" && (
        <section>
          <div style={styles.toolbar}>
            <div style={styles.searchWrap}>
              <Search size={15} color={colors.faint} />
              <input
                style={styles.searchInput}
                placeholder="Search by item, supplier, invoice, or PO number…"
                value={stockInSearch}
                onChange={(e) => setStockInSearch(e.target.value)}
              />
            </div>
            <button style={styles.primaryBtn} onClick={exportStockInCsv}>
              <Download size={15} /> Export receiving log
            </button>
          </div>
          {filteredStockInLog.length === 0 ? (
            <EmptyState
              text={stockInLog.length === 0 ? "No stock received yet. Records appear here once you add stock with \"Add stock\"." : "No entries match that search."}
            />
          ) : (
            <div style={styles.logList}>
              {filteredStockInLog.map((r) => (
                <StockInRow key={r.id} record={r} />
              ))}
            </div>
          )}
        </section>
      )}

      {showAddItem && (
        <AddItemModal items={items} stockInLog={stockInLog} onClose={() => setShowAddItem(false)} onAdd={addStock} />
      )}
      {showBorrow && (
        <BorrowModal item={showBorrow} defaultStaff={loggedInUser} onClose={() => setShowBorrow(null)} onBorrow={requestSingleItem} />
      )}
      {showMultiIssue && (
        <MultiIssueModal
          items={items}
          defaultStaff={loggedInUser}
          onClose={() => setShowMultiIssue(false)}
          onSubmit={requestMultipleItems}
        />
      )}
      {showIssueRequest && (
        <IssueRequestModal
          request={showIssueRequest}
          defaultIssuer={loggedInUser}
          onClose={() => setShowIssueRequest(null)}
          onIssue={issueRequestAction}
        />
      )}
      {showPinPrompt && (
        <PinPromptModal
          onClose={() => {
            setShowPinPrompt(false);
            setPendingAdminAction(null);
          }}
          onSuccess={() => {
            setIsAdmin(true);
            setShowPinPrompt(false);
            if (pendingAdminAction) pendingAdminAction();
            setPendingAdminAction(null);
          }}
        />
      )}
    </div>
  );
}

function ItemCard({ item, low, onBorrow, onDelete }) {
  const outOfStock = item.availableQty === 0;
  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div>
          <div style={styles.cardCategory}>{item.category}</div>
          <div style={styles.cardName}>
            {item.name}{item.itemCode ? <span style={styles.cardStockOf}> #{item.itemCode}</span> : null}
          </div>
        </div>
        <button style={styles.iconBtn} onClick={onDelete} title="Remove item">
          <Trash2 size={14} color={colors.faint} />
        </button>
      </div>
      <div style={styles.cardStock}>
        <div>
          <span style={{ ...styles.cardStockNum, color: outOfStock ? colors.rust : colors.ink }}>
            {item.availableQty}
          </span>
          <span style={styles.cardStockOf}> / {item.totalQty} in stock</span>
        </div>
        {low && !outOfStock && <span style={styles.lowBadge}>Low</span>}
      </div>
      <div style={styles.stockBarTrack}>
        <div
          style={{
            ...styles.stockBarFill,
            width: `${item.totalQty ? (item.availableQty / item.totalQty) * 100 : 0}%`,
            background: outOfStock ? colors.rust : low ? colors.amber : colors.moss,
          }}
        />
      </div>
      <button
        style={{ ...styles.borrowBtn, opacity: outOfStock ? 0.4 : 1, cursor: outOfStock ? "not-allowed" : "pointer" }}
        onClick={onBorrow}
        disabled={outOfStock}
      >
        {outOfStock ? "Out of stock" : "Request stock"}
      </button>
    </div>
  );
}

function LogRow({ record }) {
  const metaParts = [
    record.requestedBy,
    record.role,
    record.purpose ? `"${record.purpose}"` : null,
    `requested ${fmtDate(record.requestedDate)}`,
  ].filter(Boolean);
  const issueParts = [
    record.issuedBy ? `Issued by ${record.issuedBy}` : null,
    fmtDate(record.issueDate) !== "—" ? `on ${fmtDate(record.issueDate)}` : null,
    record.remarks ? `· ${record.remarks}` : null,
  ].filter(Boolean);
  return (
    <div style={styles.logRow}>
      <div style={{ ...styles.stamp, ...styles.stampOut }}>OUT</div>
      <div style={styles.logMain}>
        <div style={styles.logItemName}>
          {record.itemName}
          {record.itemCode ? <span style={styles.logQty}> #{record.itemCode}</span> : null}{" "}
          <span style={styles.logQty}>×{record.qty}</span>
        </div>
        <div style={styles.logMeta}>{metaParts.join(" · ")}</div>
        {issueParts.length > 0 && <div style={styles.logMeta}>{issueParts.join(" ")}</div>}
      </div>
    </div>
  );
}

function PendingRequestRow({ record, onReview }) {
  return (
    <div style={styles.logRow}>
      <div style={{ ...styles.stamp, ...styles.stampPending }}>PENDING</div>
      <div style={styles.logMain}>
        <div style={styles.logItemName}>
          {record.itemName}
          {record.itemCode ? <span style={styles.logQty}> #{record.itemCode}</span> : null}{" "}
          <span style={styles.logQty}>×{record.qty}</span>
        </div>
        <div style={styles.logMeta}>
          {record.requestedBy}
          {record.role ? ` · ${record.role}` : ""}
          {record.purpose ? ` · "${record.purpose}"` : ""} · requested {fmtDate(record.requestedDate)}
        </div>
      </div>
      <button style={styles.returnBtn} onClick={onReview}>
        Review &amp; issue
      </button>
    </div>
  );
}

function StockInRow({ record }) {
  const metaParts = [
    record.supplier,
    record.storeLocation,
    record.invoiceNumber ? `Inv# ${record.invoiceNumber}` : null,
    record.poNumber ? `PO# ${record.poNumber}` : null,
    fmtDate(record.date),
  ].filter(Boolean);
  return (
    <div style={styles.logRow}>
      <div style={{ ...styles.stamp, ...styles.stampIn }}>IN</div>
      <div style={styles.logMain}>
        <div style={styles.logItemName}>
          {record.itemName} <span style={styles.logQty}>×{record.qty}</span>
          {record.itemCost > 0 && <span style={styles.logQty}> · MVR {record.itemCost}</span>}
        </div>
        <div style={styles.logMeta}>{metaParts.join(" · ")}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={styles.empty}>
      <Package size={22} color={colors.faint} />
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    if (mode === "signup") {
      if (!name.trim() || !email.trim() || !password) {
        setError("Please fill in all fields.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
    } else if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: mode === "signup" ? "signUp" : "signIn",
          payload:
            mode === "signup"
              ? { name: name.trim(), email: email.trim(), password }
              : { email: email.trim(), password },
        }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user.name);
      } else {
        setError(data.error || "Something went wrong — try again.");
      }
    } catch (e) {
      setError("Couldn't connect — check your internet connection.");
    }
    setLoading(false);
  }

  function switchMode() {
    setMode(mode === "signin" ? "signup" : "signin");
    setError("");
  }

  return (
    <div style={styles.loginPage}>
      <style>{fontImports}</style>
      <div style={styles.loginCard}>
        <div style={styles.badge}>
          <Lock size={18} color={colors.paper} />
        </div>
        <div style={styles.loginEyebrow}>RAA ATOLL, MALDIVES</div>
        <h1 style={styles.loginTitle}>KINOLHAS SCHOOL STOCK INVENTORY</h1>
        <p style={styles.loginSub}>
          {mode === "signup"
            ? "Create an account with your email to use the portal."
            : "Sign in with your email to view or request stock."}
        </p>

        {mode === "signup" && (
          <>
            <label style={styles.label}>Name</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoFocus
            />
          </>
        )}

        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && mode === "signin" && submit()}
          placeholder={mode === "signup" ? "At least 6 characters" : "Enter password"}
        />

        {mode === "signup" && (
          <>
            <label style={styles.label}>Confirm password</label>
            <input
              style={styles.input}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </>
        )}

        {error && <div style={styles.modalError}>{error}</div>}

        <button
          style={{ ...styles.primaryBtn, ...styles.loginSubmit, opacity: loading ? 0.6 : 1 }}
          disabled={loading}
          onClick={submit}
        >
          {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <button style={styles.switchModeBtn} onClick={switchMode}>
          {mode === "signin" ? "Don't have an account? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function AddItemModal({ items, stockInLog, onClose, onAdd }) {
  const itemOptions = useMemo(() => {
    const set = new Set([
      ...(stockInLog || []).map((r) => (r.itemName || "").trim()),
      ...(items || []).map((it) => (it.name || "").trim()),
    ].filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stockInLog, items]);
  const supplierOptions = useMemo(() => {
    const set = new Set((stockInLog || []).map((r) => (r.supplier || "").trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [stockInLog]);

  const [selectedItem, setSelectedItem] = useState(itemOptions[0] || "__other__");
  const [customItem, setCustomItem] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemCode, setNewItemCode] = useState("");
  const [qty, setQty] = useState(1);
  const [selectedStoreLocation, setSelectedStoreLocation] = useState(STORE_LOCATIONS[0]);
  const [customStoreLocation, setCustomStoreLocation] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState(supplierOptions[0] || "__other__");
  const [customSupplier, setCustomSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(todayStr());
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(todayStr());
  const [rate, setRate] = useState("");
  const [itemCost, setItemCost] = useState("");
  const [costEdited, setCostEdited] = useState(false);

  const isOtherItem = selectedItem === "__other__";
  const itemName = isOtherItem ? customItem.trim() : selectedItem;
  const existingItem = !isOtherItem ? (items || []).find((it) => it.name === selectedItem) : null;
  const isOtherLocation = selectedStoreLocation === "__other__";
  const storeLocation = isOtherLocation ? customStoreLocation.trim() : selectedStoreLocation;
  const isOtherSupplier = selectedSupplier === "__other__";
  const supplier = isOtherSupplier ? customSupplier.trim() : selectedSupplier;

  // Auto-suggest item cost as qty × rate, unless the user has typed their own value
  useEffect(() => {
    if (!costEdited && rate !== "") {
      const computed = (parseFloat(rate) || 0) * (parseInt(qty) || 0);
      setItemCost(computed ? String(computed) : "");
    }
  }, [qty, rate, costEdited]);

  function handleSubmit() {
    onAdd({
      name: itemName,
      qty,
      itemCode: isOtherItem ? newItemCode.trim() : undefined,
      description: isOtherItem ? newItemDescription.trim() : undefined,
      storeLocation,
      supplier,
      invoiceNumber: invoiceNumber.trim(),
      date,
      poNumber: poNumber.trim(),
      poDate,
      rate: parseFloat(rate) || 0,
      itemCost: parseFloat(itemCost) || 0,
    });
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Add stock</h2>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div style={styles.modalSub}>
          Pick an item, or choose "Other" to add a brand-new one, then fill in the goods-received details.
        </div>

        <label style={styles.label}>Item</label>
        <select style={styles.input} value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
          {itemOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          <option value="__other__">Other (new item)…</option>
        </select>
        {isOtherItem ? (
          <>
            <input
              style={{ ...styles.input, marginTop: 8 }}
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              placeholder="Enter new item name"
            />
            <input
              style={{ ...styles.input, marginTop: 8 }}
              value={newItemCode}
              onChange={(e) => setNewItemCode(e.target.value)}
              placeholder="Item code (e.g. 1)"
            />
            <input
              style={{ ...styles.input, marginTop: 8 }}
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              placeholder="Description (optional)"
            />
          </>
        ) : (
          (existingItem?.itemCode || existingItem?.description) && (
            <div style={styles.itemDescription}>
              {existingItem.itemCode ? `#${existingItem.itemCode}` : ""}
              {existingItem.itemCode && existingItem.description ? " — " : ""}
              {existingItem.description || ""}
            </div>
          )
        )}

        <div style={styles.formRow2}>
          <div>
            <label style={styles.label}>Quantity received</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div>
            <label style={styles.label}>Store location</label>
            <select
              style={styles.input}
              value={selectedStoreLocation}
              onChange={(e) => setSelectedStoreLocation(e.target.value)}
            >
              {STORE_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
              <option value="__other__">Other…</option>
            </select>
          </div>
        </div>
        {isOtherLocation && (
          <input
            style={{ ...styles.input, marginTop: -6, marginBottom: 12 }}
            value={customStoreLocation}
            onChange={(e) => setCustomStoreLocation(e.target.value)}
            placeholder="Enter store location"
          />
        )}

        <label style={styles.label}>Supplier</label>
        <select
          style={styles.input}
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
        >
          {supplierOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value="__other__">Other (new supplier)…</option>
        </select>
        {isOtherSupplier && (
          <input
            style={{ ...styles.input, marginTop: 8 }}
            value={customSupplier}
            onChange={(e) => setCustomSupplier(e.target.value)}
            placeholder="e.g. Male' Hardware Pvt Ltd"
          />
        )}

        <div style={styles.formRow2}>
          <div>
            <label style={styles.label}>Invoice number</label>
            <input style={styles.input} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>Date</label>
            <input style={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div style={styles.formRow2}>
          <div>
            <label style={styles.label}>PO number</label>
            <input style={styles.input} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>PO date</label>
            <input style={styles.input} type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
          </div>
        </div>

        <div style={styles.formRow2}>
          <div>
            <label style={styles.label}>Rate (per unit)</label>
            <input
              style={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label style={styles.label}>Item cost (total)</label>
            <input
              style={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={itemCost}
              onChange={(e) => {
                setItemCost(e.target.value);
                setCostEdited(true);
              }}
              placeholder="0.00"
            />
          </div>
        </div>

        <button
          style={{ ...styles.primaryBtn, ...styles.modalSubmit, opacity: itemName ? 1 : 0.5 }}
          disabled={!itemName}
          onClick={handleSubmit}
        >
          Add to stock
        </button>
      </div>
    </div>
  );
}

function BorrowModal({ item, defaultStaff, onClose, onBorrow }) {
  const defaultKnown = defaultStaff && STAFF_NAMES.includes(defaultStaff);
  const [selectedStaff, setSelectedStaff] = useState(
    defaultKnown ? defaultStaff : defaultStaff ? "__other__" : STAFF_NAMES[0]
  );
  const [customName, setCustomName] = useState(defaultKnown ? "" : defaultStaff || "");
  const [role, setRole] = useState("Teacher");
  const [qty, setQty] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [requestedDate, setRequestedDate] = useState(todayStr());

  const isOther = selectedStaff === "__other__";
  const takenBy = isOther ? customName.trim() : selectedStaff;
  const canSubmit = takenBy && qty >= 1 && qty <= item.availableQty;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            Request — {item.name}{item.itemCode ? ` (#${item.itemCode})` : ""}
          </h2>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div style={styles.modalSub}>{item.availableQty} in stock</div>
        {item.description && <div style={styles.itemDescription}>{item.description}</div>}
        <label style={styles.label}>Requested by</label>
        <select style={styles.input} value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
          {STAFF_NAMES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value="__other__">Someone else…</option>
        </select>
        {isOther && (
          <input
            style={{ ...styles.input, marginTop: 8 }}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Enter name"
            autoFocus
          />
        )}
        <label style={styles.label}>Role</label>
        <select style={styles.input} value={role} onChange={(e) => setRole(e.target.value)}>
          <option>Teacher</option>
          <option>Staff</option>
        </select>
        <label style={styles.label}>Quantity</label>
        <input
          style={styles.input}
          type="number"
          min={1}
          max={item.availableQty}
          value={qty}
          onChange={(e) => setQty(Math.min(item.availableQty, Math.max(1, parseInt(e.target.value) || 1)))}
        />
        <label style={styles.label}>Purpose</label>
        <input
          style={styles.input}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. Grade 6 art class"
        />
        <label style={styles.label}>Requested date</label>
        <input
          style={styles.input}
          type="date"
          value={requestedDate}
          onChange={(e) => setRequestedDate(e.target.value)}
        />
        <button
          style={{ ...styles.primaryBtn, ...styles.modalSubmit, opacity: canSubmit ? 1 : 0.5 }}
          disabled={!canSubmit}
          onClick={() =>
            onBorrow({
              requestedBy: takenBy,
              role,
              purpose: purpose.trim(),
              requestedDate,
              lines: [{ itemId: item.id, qty }],
            })
          }
        >
          Submit request
        </button>
      </div>
    </div>
  );
}

function MultiIssueModal({ items, defaultStaff, onClose, onSubmit }) {
  const defaultKnown = defaultStaff && STAFF_NAMES.includes(defaultStaff);
  const [selectedStaff, setSelectedStaff] = useState(
    defaultKnown ? defaultStaff : defaultStaff ? "__other__" : STAFF_NAMES[0]
  );
  const [customName, setCustomName] = useState(defaultKnown ? "" : defaultStaff || "");
  const [role, setRole] = useState("Teacher");
  const [rows, setRows] = useState([{ rowId: uid(), itemId: "", qty: 1 }]);
  const [errorMsg, setErrorMsg] = useState("");

  const isOther = selectedStaff === "__other__";
  const takenBy = isOther ? customName.trim() : selectedStaff;

  const availableItems = useMemo(
    () => items.filter((it) => it.availableQty > 0).sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  const [purpose, setPurpose] = useState("");
  const [requestedDate, setRequestedDate] = useState(todayStr());

  function updateRow(rowId, patch) {
    setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { rowId: uid(), itemId: "", qty: 1 }]);
  }
  function removeRow(rowId) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.rowId !== rowId) : rs));
  }

  // running total per item across rows, to cap each row's max input sensibly
  function stockRemainingFor(itemId, excludingRowId) {
    const item = items.find((it) => it.id === itemId);
    if (!item) return 0;
    const usedElsewhere = rows
      .filter((r) => r.itemId === itemId && r.rowId !== excludingRowId)
      .reduce((s, r) => s + (parseInt(r.qty) || 0), 0);
    return Math.max(0, item.availableQty - usedElsewhere);
  }

  const validRows = rows.filter((r) => r.itemId && r.qty >= 1);
  const canSubmit = Boolean(takenBy) && validRows.length > 0;

  // simpler, correct validation: re-simulate sequentially
  function validateAll() {
    const remaining = {};
    items.forEach((it) => (remaining[it.id] = it.availableQty));
    for (const r of rows) {
      if (!r.itemId || !r.qty || r.qty < 1) continue;
      if ((remaining[r.itemId] ?? 0) < r.qty) return false;
      remaining[r.itemId] -= r.qty;
    }
    return true;
  }

  function handleSubmit() {
    if (!takenBy) {
      setErrorMsg("Enter who is requesting the stock.");
      return;
    }
    if (validRows.length === 0) {
      setErrorMsg("Add at least one item and quantity.");
      return;
    }
    if (!validateAll()) {
      setErrorMsg("One or more quantities exceed what's currently in stock.");
      return;
    }
    const ok = onSubmit({
      requestedBy: takenBy,
      role,
      purpose: purpose.trim(),
      requestedDate,
      lines: validRows.map((r) => ({ itemId: r.itemId, qty: parseInt(r.qty) || 0 })),
    });
    if (!ok) setErrorMsg("Nothing was requested — check quantities and try again.");
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Request stock</h2>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div style={styles.modalSub}>Pick multiple items across any category in one go</div>

        <label style={styles.label}>Requested by</label>
        <select style={styles.input} value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
          {STAFF_NAMES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value="__other__">Someone else…</option>
        </select>
        {isOther && (
          <input
            style={{ ...styles.input, marginTop: 8 }}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Enter name"
            autoFocus
          />
        )}
        <label style={styles.label}>Role</label>
        <select style={styles.input} value={role} onChange={(e) => setRole(e.target.value)}>
          <option>Teacher</option>
          <option>Staff</option>
        </select>
        <label style={styles.label}>Purpose</label>
        <input
          style={styles.input}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. Sports day preparation"
        />
        <label style={styles.label}>Requested date</label>
        <input
          style={styles.input}
          type="date"
          value={requestedDate}
          onChange={(e) => setRequestedDate(e.target.value)}
        />

        <label style={styles.label}>Items</label>
        <div style={styles.rowsList}>
          {rows.map((row) => {
            const selectedItem = items.find((it) => it.id === row.itemId);
            const maxForRow = row.itemId
              ? stockRemainingFor(row.itemId, row.rowId) + (parseInt(row.qty) || 0)
              : undefined;
            return (
              <div key={row.rowId} style={styles.itemRow}>
                <select
                  style={{ ...styles.input, flex: 1 }}
                  value={row.itemId}
                  onChange={(e) => updateRow(row.rowId, { itemId: e.target.value, qty: 1 })}
                >
                  <option value="">Select item…</option>
                  {availableItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}{it.itemCode ? ` #${it.itemCode}` : ""} ({it.category}) — {it.availableQty} in stock
                    </option>
                  ))}
                </select>
                <input
                  style={{ ...styles.input, width: 64 }}
                  type="number"
                  min={1}
                  max={maxForRow}
                  value={row.qty}
                  disabled={!row.itemId}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value) || 1);
                    updateRow(row.rowId, { qty: maxForRow ? Math.min(v, maxForRow) : v });
                  }}
                />
                <button
                  style={styles.rowRemoveBtn}
                  onClick={() => removeRow(row.rowId)}
                  disabled={rows.length === 1}
                  title="Remove this line"
                >
                  <X size={14} color={colors.faint} />
                </button>
              </div>
            );
          })}
        </div>
        <button style={styles.addRowBtn} onClick={addRow}>
          <PlusCircle size={14} /> Add another item
        </button>

        {errorMsg && <div style={styles.modalError}>{errorMsg}</div>}

        <button
          style={{ ...styles.primaryBtn, ...styles.modalSubmit, opacity: canSubmit ? 1 : 0.5 }}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Submit request
        </button>
      </div>
    </div>
  );
}

function IssueRequestModal({ request, defaultIssuer, onClose, onIssue }) {
  const defaultKnown = defaultIssuer && STAFF_NAMES.includes(defaultIssuer);
  const [selectedStaff, setSelectedStaff] = useState(
    defaultKnown ? defaultIssuer : defaultIssuer ? "__other__" : STAFF_NAMES[0]
  );
  const [customName, setCustomName] = useState(defaultKnown ? "" : defaultIssuer || "");
  const [remarks, setRemarks] = useState("");
  const [issueDate, setIssueDate] = useState(todayStr());

  const isOther = selectedStaff === "__other__";
  const issuedBy = isOther ? customName.trim() : selectedStaff;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Review &amp; issue</h2>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div style={styles.modalSub}>
          {request.itemName}
          {request.itemCode ? ` (#${request.itemCode})` : ""} × {request.qty} — requested by {request.requestedBy}
          {request.role ? ` (${request.role})` : ""}
          {request.purpose ? `, for "${request.purpose}"` : ""}
        </div>

        <label style={styles.label}>Issued by</label>
        <select style={styles.input} value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
          {STAFF_NAMES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value="__other__">Someone else…</option>
        </select>
        {isOther && (
          <input
            style={{ ...styles.input, marginTop: 8 }}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Enter name"
            autoFocus
          />
        )}

        <label style={styles.label}>Remarks (optional)</label>
        <input
          style={styles.input}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Approved, partial stock only"
        />

        <label style={styles.label}>Issue date</label>
        <input
          style={styles.input}
          type="date"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
        />

        <button
          style={{ ...styles.primaryBtn, ...styles.modalSubmit, opacity: issuedBy ? 1 : 0.5 }}
          disabled={!issuedBy}
          onClick={() => onIssue({ requestId: request.id, issuedBy, remarks: remarks.trim(), issueDate })}
        >
          Confirm — issue stock
        </button>
      </div>
    </div>
  );
}

function PinPromptModal({ onClose, onSuccess }) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);

  function submit() {
    if (pin === ADMIN_PIN) {
      onSuccess();
    } else {
      setWrong(true);
      setPin("");
    }
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Admin PIN</h2>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div style={styles.modalSub}>Adding or removing items needs the admin PIN.</div>
        <input
          style={styles.input}
          type="password"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setWrong(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Enter PIN"
          autoFocus
        />
        {wrong && <div style={styles.modalError}>Incorrect PIN — try again.</div>}
        <button
          style={{ ...styles.primaryBtn, ...styles.modalSubmit, opacity: pin ? 1 : 0.5 }}
          disabled={!pin}
          onClick={submit}
        >
          Unlock
        </button>
      </div>
    </div>
  );
}

const colors = {
  paper: "#EEF0EA",
  card: "#FFFFFF",
  ink: "#22301F",
  faint: "#8A9184",
  moss: "#4B6B3E",
  mossDark: "#33492A",
  rust: "#B5502E",
  amber: "#C98A2C",
  line: "#DADFD2",
};

const fontImports = `
  @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
`;

const styles = {
  page: {
    fontFamily: "'Inter', sans-serif",
    background: colors.paper,
    color: colors.ink,
    minHeight: "100%",
    padding: "20px 20px 60px",
    maxWidth: 920,
    margin: "0 auto",
  },
  loadingWrap: { display: "flex", justifyContent: "center", padding: 60, fontFamily: "'Inter', sans-serif" },
  loadingCard: { color: colors.faint },
  loginPage: {
    fontFamily: "'Inter', sans-serif",
    background: colors.paper,
    minHeight: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loginCard: {
    background: colors.card,
    border: `1px solid ${colors.line}`,
    borderRadius: 14,
    padding: "28px 26px",
    width: "100%",
    maxWidth: 360,
  },
  loginEyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10.5,
    letterSpacing: "0.12em",
    color: colors.moss,
    fontWeight: 600,
    marginTop: 12,
  },
  loginTitle: {
    fontFamily: "'Zilla Slab', serif",
    fontSize: 19,
    fontWeight: 700,
    margin: "2px 0 8px",
    color: colors.mossDark,
  },
  loginSub: { fontSize: 12.5, color: colors.faint, margin: "0 0 16px", lineHeight: 1.5 },
  loginSubmit: { width: "100%", justifyContent: "center", marginTop: 18 },
  switchModeBtn: {
    width: "100%",
    background: "none",
    border: "none",
    color: colors.moss,
    fontFamily: "'Inter', sans-serif",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 12,
    padding: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
    borderBottom: `2px solid ${colors.mossDark}`,
    paddingBottom: 16,
    marginBottom: 18,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    background: colors.mossDark,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  eyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10.5,
    letterSpacing: "0.12em",
    color: colors.moss,
    fontWeight: 600,
  },
  title: {
    fontFamily: "'Zilla Slab', serif",
    fontSize: 21,
    fontWeight: 700,
    margin: "2px 0 0",
    color: colors.mossDark,
    letterSpacing: "0.01em",
  },
  headerStats: { display: "flex", alignItems: "center", gap: 18 },
  statBlock: { textAlign: "right" },
  statNum: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, lineHeight: 1 },
  statLabel: { fontSize: 11, color: colors.faint, marginTop: 2 },
  statDivider: { width: 1, height: 30, background: colors.line },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#F7E9E2",
    color: colors.rust,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 14,
  },
  errorClose: { marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: colors.rust },
  tabs: { display: "flex", gap: 6, marginBottom: 18 },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13.5,
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 7,
    border: `1px solid ${colors.line}`,
    background: colors.card,
    color: colors.faint,
    cursor: "pointer",
  },
  tabActive: { background: colors.mossDark, color: "#fff", borderColor: colors.mossDark },
  tabCount: {
    background: colors.rust,
    color: "#fff",
    fontSize: 10.5,
    fontFamily: "'IBM Plex Mono', monospace",
    borderRadius: 10,
    padding: "1px 6px",
    marginLeft: 2,
  },
  syncBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 7,
    border: `1px dashed ${colors.moss}`,
    background: "transparent",
    color: colors.mossDark,
    cursor: "pointer",
    marginLeft: "auto",
  },
  syncBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#E7EEE2",
    color: colors.mossDark,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 14,
  },
  lowStockBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "#FBEFE3",
    color: "#8A4B1F",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 12.5,
    lineHeight: 1.5,
    marginBottom: 14,
  },
  adminBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    border: `1px solid ${colors.line}`,
    color: colors.faint,
    borderRadius: 7,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
  },
  adminBtnActive: {
    background: colors.mossDark,
    color: "#fff",
    border: `1px solid ${colors.mossDark}`,
  },
  userBlock: { display: "flex", alignItems: "center", gap: 8 },
  userName: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 12.5,
    fontWeight: 600,
    color: colors.ink,
  },
  signOutBtn: {
    background: "none",
    border: "none",
    color: colors.faint,
    fontSize: 11.5,
    textDecoration: "underline",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    padding: 0,
  },
  lowBadge: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9.5,
    fontWeight: 700,
    color: "#8A4B1F",
    background: "#FBEFE3",
    borderRadius: 4,
    padding: "2px 6px",
    letterSpacing: "0.04em",
  },
  toolbar: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: colors.card,
    border: `1px solid ${colors.line}`,
    borderRadius: 8,
    padding: "8px 12px",
    flex: 1,
    minWidth: 200,
  },
  searchInput: {
    border: "none",
    outline: "none",
    fontFamily: "'Inter', sans-serif",
    fontSize: 13.5,
    flex: 1,
    background: "transparent",
    color: colors.ink,
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: colors.mossDark,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 16px",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
  },
  secondaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#fff",
    color: colors.mossDark,
    border: `1.5px solid ${colors.mossDark}`,
    borderRadius: 8,
    padding: "9px 16px",
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
    gap: 14,
  },
  card: {
    background: colors.card,
    border: `1px solid ${colors.line}`,
    borderRadius: 10,
    padding: 16,
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  cardCategory: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    color: colors.moss,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  cardName: { fontFamily: "'Zilla Slab', serif", fontSize: 17, fontWeight: 600 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 2 },
  cardStock: { marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardStockNum: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600 },
  cardStockOf: { fontSize: 12.5, color: colors.faint },
  stockBarTrack: { height: 5, background: colors.line, borderRadius: 3, overflow: "hidden", marginBottom: 14 },
  stockBarFill: { height: "100%", borderRadius: 3 },
  borrowBtn: {
    width: "100%",
    background: "transparent",
    border: `1.5px solid ${colors.mossDark}`,
    color: colors.mossDark,
    borderRadius: 7,
    padding: "8px 0",
    fontWeight: 600,
    fontSize: 13,
    fontFamily: "'Inter', sans-serif",
  },
  logList: { display: "flex", flexDirection: "column", gap: 10 },
  logRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: colors.card,
    border: `1px solid ${colors.line}`,
    borderRadius: 10,
    padding: "12px 14px",
  },
  stamp: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    padding: "5px 9px",
    borderRadius: 5,
    transform: "rotate(-3deg)",
    flexShrink: 0,
    border: "1.5px solid currentColor",
  },
  stampOut: { color: colors.rust, background: "#F7E9E2" },
  stampIn: { color: colors.moss, background: "#E7EEE2" },
  stampPending: { color: colors.amber, background: "#FBEFE3" },
  logMain: { flex: 1, minWidth: 0 },
  logItemName: { fontFamily: "'Zilla Slab', serif", fontSize: 15, fontWeight: 600 },
  logQty: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: colors.faint, fontWeight: 500 },
  logMeta: { fontSize: 12, color: colors.faint, marginTop: 2 },
  returnBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: colors.mossDark,
    color: "#fff",
    border: "none",
    borderRadius: 7,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    cursor: "pointer",
    flexShrink: 0,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "50px 20px",
    color: colors.faint,
    border: `1.5px dashed ${colors.line}`,
    borderRadius: 12,
  },
  emptyText: { fontSize: 13.5, textAlign: "center", maxWidth: 320, margin: 0 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(34,48,31,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 50,
  },
  modal: {
    background: colors.card,
    borderRadius: 12,
    padding: 22,
    width: "100%",
    maxWidth: 380,
    fontFamily: "'Inter', sans-serif",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontFamily: "'Zilla Slab', serif", fontSize: 18, fontWeight: 700, margin: 0, color: colors.mossDark },
  modalSub: { fontSize: 12, color: colors.faint, marginBottom: 14 },
  itemDescription: {
    fontSize: 12,
    color: colors.faint,
    background: colors.paper,
    borderRadius: 6,
    padding: "8px 10px",
    marginTop: 6,
    lineHeight: 1.5,
  },
  formRow2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  label: { display: "block", fontSize: 11.5, fontWeight: 600, color: colors.faint, marginTop: 12, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    width: "100%",
    border: `1px solid ${colors.line}`,
    borderRadius: 7,
    padding: "9px 11px",
    fontSize: 13.5,
    fontFamily: "'Inter', sans-serif",
    color: colors.ink,
    boxSizing: "border-box",
    background: "#fff",
  },
  modalSubmit: { width: "100%", justifyContent: "center", marginTop: 18 },
  rowsList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 2 },
  itemRow: { display: "flex", gap: 8, alignItems: "center" },
  rowRemoveBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 6,
    flexShrink: 0,
  },
  addRowBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    color: colors.moss,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
    padding: "8px 0 2px",
  },
  modalError: {
    background: "#F7E9E2",
    color: colors.rust,
    fontSize: 12.5,
    borderRadius: 7,
    padding: "8px 10px",
    marginTop: 10,
  },
};
