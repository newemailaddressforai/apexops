import { useState, useMemo, useRef, useEffect, useLayoutEffect, Fragment } from "react";import { supabase } from "./supabaseClient";
import { useSyncedTable, useSyncedSingleton, useSyncedJobs, fetchAllData, ensureSingletonsExist, staffMap, rolesMap, contactMap, companyMap, settingsMap, timeEntryMap, poMap, assetMap, assetGroupMap, schedulerDataMap, offsiteTrackerMap, invoiceMap, billMap, quoteMap } from "./db";
import logoSidebar from "./assets/logo-sidebar.png";
import { LoginScreen, FullScreenStatus } from "./AuthScreens";
import JSZip from "jszip";
// ─── Theme ─────────────────────────────────────────────────────────────────────
const ACCENT = "#D4FF3D";      // lime yellow — buttons, active states, highlights
const ACCENT_TEXT = "#7A8A00"; // darker olive-lime — readable accent text on white
const ACCENT_SOFT = "#F6FFDE"; // pale lime tint — hover backgrounds
const INK = "#111111";         // near-black body text on white pages
const SIDEBAR_BG = "#000000";  // black sidebar (same in both themes)
const SIDEBAR_BORDER = "#232323";
const SIDEBAR_MUTED = "#9A9A9A";

// Light/dark mode is implemented via CSS custom properties. Surface and text
// colours throughout the app reference var(--token) instead of literal hex,
// so switching the data-theme attribute on the root element re-themes everything.
function ThemeStyle() {
  return (
    <style>{`
      [data-theme="light"] {
        --bg-page: #F1F4F8;
        --card-bg: #ffffff;
        --bg-subtle: #F8FAFC;
        --bg-subtle2: #EFF2F8;
        --text-primary: #1C2333;
        --text-secondary: #5C6B82;
        --text-muted: #9CA3AF;
        --border: #E5EAF0;
        --border-strong: #D1D9E4;
      }
      [data-theme="dark"] {
        --bg-page: #121417;
        --card-bg: #1C1F24;
        --bg-subtle: #23262C;
        --bg-subtle2: #282C33;
        --text-primary: #EDEFF2;
        --text-secondary: #A7AFBC;
        --text-muted: #767E8C;
        --border: #33373F;
        --border-strong: #3D424B;
      }
      [data-theme="dark"] input, [data-theme="dark"] select, [data-theme="dark"] textarea, input, select, button {
        font-family: 'Inter', system-ui, sans-serif;
      }
      textarea {
        color: var(--text-primary);
      }
      [data-theme="dark"] input::placeholder, [data-theme="dark"] textarea::placeholder {
        color: var(--text-muted);
}
      html, body {
        margin: 0;
        padding: 0;
        min-height: 100%;
        overflow-x: hidden;
        @media (max-width: 767px) {
        .settings-layout { flex-direction: column !important; }
        .settings-layout > div:first-child { width: 100% !important; }
        .dashboard-summary-grid { grid-template-columns: 1fr !important; }
      
      }
      body {
        display: block;
        place-items: unset;
      }
      #root {
        max-width: none;
        margin: 0;
        padding: 0;
        text-align: left;
        min-height: 100vh;
      }
    `}</style>
  );
}

// ─── Staff colours ─────────────────────────────────────────────────────────────
const STAFF_PALETTE = [
  "#2E4A7A","#10B981","#8B5CF6","#EC4899","#F59E0B",
  "#EF4444","#06B6D4","#84CC16","#F97316","#6366F1",
];

const INITIAL_ROLES = [
  { id: "role1", name: "Senior Engineer", costRate: 65, chargeOutRate: 110 },
  { id: "role2", name: "Engineer",        costRate: 52, chargeOutRate: 90 },
  { id: "role3", name: "Junior Engineer", costRate: 38, chargeOutRate: 68 },
  { id: "role4", name: "Project Manager", costRate: 78, chargeOutRate: 135 },
];

const INITIAL_STAFF = [
  { id: "s1", name: "Alex Reid",    roleId: "role1", color: STAFF_PALETTE[0] },
  { id: "s2", name: "Jordan Blake", roleId: "role2", color: STAFF_PALETTE[1] },
  { id: "s3", name: "Sam Torres",   roleId: "role2", color: STAFF_PALETTE[2] },
  { id: "s4", name: "Casey Morgan", roleId: "role3", color: STAFF_PALETTE[3] },
  { id: "s5", name: "Riley Chen",   roleId: "role4", color: STAFF_PALETTE[4] },
];

// Looks up a staff member's rates via their assigned role — rates now live on the
// role, not the person, so reassigning a role updates their cost/charge everywhere.
function getRoleRates(roleId, roles) {
  const r = (roles||[]).find(x => x.id === roleId);
  return { costRate: r?.costRate || 0, chargeOutRate: r?.chargeOutRate || 0, roleName: r?.name || "No role assigned" };
}
function ruid() { return "role" + Date.now(); }

const today = new Date();
const d = (offset) => { const dt = new Date(today); dt.setDate(dt.getDate() + offset); return localISO(dt); };

const INITIAL_CUSTOMERS = [
  { id: "cu1", name: "City Council",       contactPerson: "Diane Foster", phone: "07 3221 4400", email: "diane.foster@citycouncil.gov.au", address: "1 Civic Plaza, Brisbane QLD 4000" },
  { id: "cu2", name: "Nexcore Ltd",        contactPerson: "Mark Ivan",    phone: "07 3355 8890", email: "mivan@nexcore.com.au",            address: "44 Industrial Ave, Eagle Farm QLD 4009" },
  { id: "cu3", name: "Harmon Builds",      contactPerson: "",             phone: "",             email: "",                                 address: "" },
  { id: "cu4", name: "State DoT",          contactPerson: "",             phone: "",             email: "",                                 address: "" },
  { id: "cu5", name: "Pacific Logistics",  contactPerson: "",             phone: "",             email: "",                                 address: "" },
  { id: "cu6", name: "Marine Authority",   contactPerson: "",             phone: "",             email: "",                                 address: "" },
  { id: "cu7", name: "Metro Rail",         contactPerson: "",             phone: "",             email: "",                                 address: "" },
  { id: "cu8", name: "GreenPower Co",      contactPerson: "",             phone: "",             email: "",                                 address: "" },
];

const INITIAL_SUPPLIERS = [
  { id: "su1", name: "SteelCo Supplies",    contactPerson: "Terry Nguyen", phone: "07 3844 2210", email: "sales@steelco.com.au",     address: "12 Foundry Rd, Salisbury QLD 4107" },
  { id: "su2", name: "BuildMart Wholesale", contactPerson: "Priya Shah",   phone: "07 3299 5567", email: "orders@buildmart.com.au",  address: "88 Trade St, Acacia Ridge QLD 4110" },
  { id: "su3", name: "Fastener Direct",     contactPerson: "",             phone: "",             email: "",                          address: "" },
];

const INITIAL_COMPANY = {
  name: "Apex Engineering Pty Ltd",
  address: "22 Workshop Lane, Yatala QLD 4207",
  phone: "07 3807 1122",
  email: "office@apexengineering.com.au",
  abn: "45 123 456 789",
};

const INITIAL_PURCHASE_ORDERS = [
  { id: "po1", poNumber: "PO-1001", jobId: "JOB-002", supplierId: "su1", reference: "Retrofit steel supply", details: "Supply structural steel sections and fasteners per attached drawing set for the Nexcore plant retrofit. Delivery required to site by end of month.", dateCreated: d(-3), status: "billed", billedCost: 4280.50 },
];

const INITIAL_SETTINGS = {
  theme: "light", // "light" | "dark"
    weekStartDay: 1, // Timesheets week start: 0=Sunday, 1=Monday ... 6=Saturday
    mobileNavTabs: ["dashboard", "jobs", "assets", "contacts"],
    dashboardStaffIds: [], // empty = show everyone
    dashboardVisibleStatuses: { "not-started": true, "in-progress": true, "on-hold": true, "follow-up": true, "ready-to-assemble": true, "completed": false },
    schedulerStaffIds: [], // empty = show everyone
    timesheetsStaffIds: [], // empty = show everyone
      invoiceFooterNote: "Thank you for your business. Payment due within 14 days of invoice date.",
  invoiceTerms: "",
  invoiceTaxRate: 15,
  invoiceNumberPrefix: "INV",
  visibleTabs: {
    dashboard: true, jobs: true, onhold: true, followup: true,
    schedule: true, timesheets: true, purchaseorders: true, offsite: true, contacts: true,
    quotes: true, invoices: true, bills: true, assets: true,
  },
  poFooterNote: "Please reference {PO} on all correspondence and delivery documentation.",
  poTerms: "",
  jobCustomFields: [
    { id: "cf1", label: "Site Address", type: "text" },
    { id: "cf2", label: "Equipment / Asset No", type: "text" },
  ],
  jobSheetFooterNote: "Job sheet generated {DATE} — {JOB}",
  jobSheetFields: {
    description: true, customer: true, workOrderNo: true, orderNo: true,
    assignedStaff: true, notes: true, customFields: true,
    timeLogged: true, costs: true,
  },
  jobSummaryFields: [
    { key: "id",            label: "Job Number",     enabled: true, width: 110 },
    { key: "workOrderNo",   label: "Work Order No",  enabled: true, width: 120 },
    { key: "orderNo",       label: "Order No (PO)",  enabled: true, width: 120 },
    { key: "description",   label: "Description",    enabled: true, width: 260 },
    { key: "customer",      label: "Customer",       enabled: true, width: 160 },
    { key: "assignedStaff", label: "Assigned Staff", enabled: true, width: 190 },
    { key: "status",        label: "Status",         enabled: true, width: 150 },
  ],
  assetSummaryFields: [
    { key: "name",           label: "Asset Name",       enabled: true, width: 220 },
    { key: "group",          label: "Group",            enabled: true, width: 140 },
    { key: "make",           label: "Make",             enabled: true, width: 110 },
    { key: "model",          label: "Model",            enabled: true, width: 130 },
    { key: "identifier",     label: "Serial / Rego",    enabled: true, width: 130 },
    { key: "location",       label: "Location",         enabled: true, width: 150 },
    { key: "assignedStaff",  label: "Assigned To",      enabled: true, width: 110 },
    { key: "nextServiceDate",label: "Next Service",     enabled: true, width: 130 },
    { key: "purchasePrice",  label: "Purchase Price",   enabled: true, width: 120 },
    { key: "status",         label: "Status",           enabled: true, width: 130 },
  ],
};

const JOB_SHEET_FIELD_LABELS = [
  { key: "description",   label: "Description" },
  { key: "customer",      label: "Customer" },
  { key: "workOrderNo",   label: "Work Order No" },
  { key: "orderNo",       label: "Order No (PO)" },
  { key: "assignedStaff", label: "Assigned Staff" },
  { key: "notes",         label: "Notes" },
  { key: "customFields",  label: "Custom Fields" },
  { key: "timeLogged",    label: "Time Logged" },
  { key: "costs",         label: "Costs (Purchase Orders + Materials)" },
];

// ─── ASSET REGISTER ────────────────────────────────────────────────────────────
const ASSET_STATUS_META = {
  active:        { label: "Active",         color: "#10B981" },
  maintenance:   { label: "In Maintenance",  color: "#F59E0B" },
  outofservice:  { label: "Out of Service",  color: "#EF4444" },
  retired:       { label: "Retired",         color: "#9CA3AF" },
};
const ASSET_GROUP_COLORS = ["#6366F1","#F59E0B","#10B981","#06B6D4","#EC4899","#8B5CF6","#EF4444","#14B8A6","#A855F7","#0EA5E9"];

const INITIAL_ASSET_GROUPS = [
  { id: "ag1", name: "Vehicles",           color: "#6366F1" },
  { id: "ag2", name: "Power Tools",        color: "#F59E0B" },
  { id: "ag3", name: "Hand Tools",         color: "#10B981" },
  { id: "ag4", name: "Workshop Equipment", color: "#06B6D4" },
  { id: "ag5", name: "Safety Equipment",   color: "#EC4899" },
];

const INITIAL_ASSETS = [
  { id:"asset1", name:"Site Ute 1 — Hilux",        groupId:"ag1", make:"Toyota",    model:"Hilux SR5 4x4",   identifier:"123-ABC",   purchaseDate:"2023-03-14", purchasePrice:52000, status:"active",       location:"Yatala Workshop",       assignedTo:"s1", nextServiceDate:d(20),  notes:"Diesel, tow bar fitted", createdAt:"2023-03-14" },
  { id:"asset2", name:"Site Ute 2 — Ranger",       groupId:"ag1", make:"Ford",      model:"Ranger XLT",      identifier:"456-XYZ",   purchaseDate:"2022-08-02", purchasePrice:48000, status:"maintenance",  location:"Smith's Auto (in for service)", assignedTo:"s2", nextServiceDate:d(-3),  notes:"Booked in for brake replacement", createdAt:"2022-08-02" },
  { id:"asset3", name:"Angle Grinder 230mm",       groupId:"ag2", make:"Makita",    model:"GA9020",          identifier:"SN-88213",  purchaseDate:"2024-01-10", purchasePrice:320,   status:"active",       location:"Yatala Workshop",       assignedTo:null, nextServiceDate:null,   notes:"", createdAt:"2024-01-10" },
  { id:"asset4", name:"Rotary Hammer Drill",       groupId:"ag2", make:"Bosch",     model:"GBH 5-40",        identifier:"SN-44120",  purchaseDate:"2023-11-05", purchasePrice:610,   status:"active",       location:"Site Van 2",             assignedTo:"s3", nextServiceDate:null,   notes:"", createdAt:"2023-11-05" },
  { id:"asset5", name:"Socket Set 3/8\" Drive",    groupId:"ag3", make:"Sidchrome", model:"",                identifier:"",          purchaseDate:"2021-06-01", purchasePrice:280,   status:"active",       location:"Yatala Workshop",       assignedTo:null, nextServiceDate:null,   notes:"", createdAt:"2021-06-01" },
  { id:"asset6", name:"MIG Welder 250",            groupId:"ag4", make:"Cigweld",  model:"Transmig 250",    identifier:"SN-99871",  purchaseDate:"2022-02-18", purchasePrice:3200,  status:"active",       location:"Yatala Workshop",       assignedTo:null, nextServiceDate:d(45),  notes:"Annual service due", createdAt:"2022-02-18" },
  { id:"asset7", name:"Fall Arrest Harness Kit",   groupId:"ag5", make:"3M",        model:"Protecta",        identifier:"SN-11234",  purchaseDate:"2023-09-01", purchasePrice:220,   status:"active",       location:"Site Van 1",             assignedTo:"s4", nextServiceDate:d(10),  notes:"Annual inspection required", createdAt:"2023-09-01" },
];

function auid() { return "asset" + Date.now(); }
function agid() { return "ag" + Date.now(); }

const INITIAL_JOBS = [
  { id: "JOB-001", title: "Bridge Structural Assessment",  client: "City Council",     status: "in-progress",  assignedTo: ["s1","s5"], workOrderNo: "WO-1001", orderNo: "PO-4001", holdReason: null, holdSince: null, followUpNote: null, followUpSince: null, notes: "Phase 1 complete", customFields: { cf1: "142 River St, Brisbane QLD", cf2: "BR-2201" }, createdAt: d(-30), jobNotes: [ { id: "note1", name: "Initial site inspection", text: "Checked the main support beams — minor corrosion on the northern span, nothing structural. Recommend repainting within 6 months.", photos: [], createdAt: d(-28) } ] },
  { id: "JOB-002", title: "Industrial Plant Retrofit",     client: "Nexcore Ltd",      status: "on-hold",      assignedTo: ["s2","s3"], workOrderNo: "WO-1002", orderNo: "PO-4002", holdReason: "Awaiting client sign-off on revised drawings", holdSince: d(-5), followUpNote: null, followUpSince: null, notes: "Client reviewing updated spec", customFields: { cf1: "44 Industrial Ave, Eagle Farm QLD", cf2: "CMP-118" }, createdAt: d(-26), jobCosts: [ { id: "cost1", label: "Consumables — welding gas & rods", amount: 310.00, createdAt: d(-4) } ] },
  { id: "JOB-003", title: "Residential Complex Foundation",client: "Harmon Builds",    status: "in-progress",  assignedTo: ["s3","s4"], workOrderNo: "WO-1003", orderNo: "",        holdReason: null, holdSince: null, followUpNote: null, followUpSince: null, notes: "", createdAt: d(-22) },
  { id: "JOB-004", title: "Highway Drainage Upgrade",      client: "State DoT",        status: "on-hold",      assignedTo: ["s1"],      workOrderNo: "WO-1004", orderNo: "PO-4004", holdReason: "Permit approval pending — environmental review", holdSince: d(-12), followUpNote: null, followUpSince: null, notes: "Escalated to DoT contact", createdAt: d(-18) },
  { id: "JOB-005", title: "Warehouse Steel Frame",         client: "Pacific Logistics", status: "completed",   assignedTo: ["s2","s4"], workOrderNo: "WO-1005", orderNo: "PO-4005", holdReason: null, holdSince: null, followUpNote: null, followUpSince: null, notes: "Signed off", createdAt: d(-14) },
  { id: "JOB-006", title: "Coastal Erosion Study",         client: "Marine Authority", status: "follow-up",    assignedTo: ["s5","s1"], workOrderNo: "WO-1006", orderNo: "",        holdReason: null, holdSince: null, followUpNote: "Waiting on client to confirm survey window", followUpSince: d(-3), notes: "Initial site visit done", createdAt: d(-10) },
  { id: "JOB-007", title: "Tunnel Ventilation Review",     client: "Metro Rail",       status: "on-hold",      assignedTo: ["s2"],      workOrderNo: "WO-1007", orderNo: "PO-4007", holdReason: "Subcontractor unavailable until next month", holdSince: d(-8), followUpNote: null, followUpSince: null, notes: "", createdAt: d(-7) },
  { id: "JOB-008", title: "Solar Farm Civil Works",        client: "GreenPower Co",    status: "not-started",  assignedTo: ["s4","s3"], workOrderNo: "WO-1008", orderNo: "",        holdReason: null, holdSince: null, followUpNote: null, followUpSince: null, notes: "Mobilisation in progress", createdAt: d(-3) },
  { id: "JOB-009", title: "Conveyor Gearbox Rebuild",      client: "Pacific Logistics", status: "ready-to-assemble", assignedTo: ["s3"],      workOrderNo: "WO-1009", orderNo: "",        holdReason: null, holdSince: null, followUpNote: null, followUpSince: null, notes: "Parts machined, awaiting assembly slot", createdAt: d(-1) },
];

const INITIAL_TIME_ENTRIES = [
  { id: "t1", staffId: "s1", jobId: "JOB-001", date: d(-2), startTime: "07:00", endTime: "13:00", hours: 6 },
  { id: "t2", staffId: "s5", jobId: "JOB-001", date: d(-2), startTime: "13:00", endTime: "16:00", hours: 3 },
  { id: "t3", staffId: "s1", jobId: "JOB-001", date: d(-1), startTime: "07:00", endTime: "12:00", hours: 5 },
  { id: "t4", staffId: "s3", jobId: "JOB-003", date: d(-1), startTime: "07:00", endTime: "14:00", hours: 7 },
  { id: "t5", staffId: "s4", jobId: "JOB-003", date: d(-1), startTime: "08:00", endTime: "12:00", hours: 4 },
  { id: "t6", staffId: "s4", jobId: "JOB-003", date: d(0),  startTime: "12:30", endTime: "15:30", hours: 3 },
  { id: "t7", staffId: "s2", jobId: "JOB-002", date: d(-6), startTime: "07:00", endTime: "15:00", hours: 8 },
  { id: "t8", staffId: "s5", jobId: "JOB-006", date: d(0),  startTime: "09:00", endTime: "11:00", hours: 2 },
];

const DEFAULT_OFFSITE_COLS = [
  { id: "c1", label: "Fitter T1", type: "number" },
  { id: "c2", label: "Fitter T2", type: "number" },
  { id: "c3", label: "Super T1",  type: "number" },
  { id: "c4", label: "Super T2",  type: "number" },
  { id: "c5", label: "TA T1",     type: "number" },
  { id: "c6", label: "TA T2",     type: "number" },
  { id: "c7", label: "KMs",       type: "number" },
  { id: "c8", label: "Costs",     type: "number" },
];

const DAYS_SCHED = ["Mon","Tue","Wed","Thu","Fri"];
const TIMESHEET_DAYS = [
  { name: "Mon", weekend: false }, { name: "Tue", weekend: false }, { name: "Wed", weekend: false },
  { name: "Thu", weekend: false }, { name: "Fri", weekend: false },
  { name: "Sat", weekend: true },  { name: "Sun", weekend: true },
];
// All 7 days indexed to match JS Date.getDay() (0=Sunday...6=Saturday), used to build
// a Timesheets week starting on whichever day the user picks in Settings → Timesheets.
const ALL_DAYS_BY_DOW = [
  { name: "Sun", weekend: true },  { name: "Mon", weekend: false }, { name: "Tue", weekend: false },
  { name: "Wed", weekend: false }, { name: "Thu", weekend: false }, { name: "Fri", weekend: false },
  { name: "Sat", weekend: true },
];
function getOrderedWeekDays(startDay) {
  const s = ((startDay % 7) + 7) % 7;
  return [...ALL_DAYS_BY_DOW.slice(s), ...ALL_DAYS_BY_DOW.slice(0, s)];
}
function getWeekStartDate(weekOffset, startDay) {
  const s = ((startDay % 7) + 7) % 7;
  const d2 = new Date();
  const diff = (d2.getDay() - s + 7) % 7;
  d2.setDate(d2.getDate() - diff + weekOffset * 7);
  return d2;
}
function timeToMinutes(t) { const [h,m] = t.split(":").map(Number); return h*60+m; }
function minutesToHours(mins) { return Math.round((mins/60)*100)/100; }
function formatTimeLabel(t) {
  if (!t) return "";
  const [h,m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m > 0 ? ":" + String(m).padStart(2,"0") : ""}${period}`;
}
function formatTimeRange(start, end) { return start && end ? `${formatTimeLabel(start)}–${formatTimeLabel(end)}` : ""; }
const HOLD_COLORS = ["#F59E0B","#EF4444","#8B5CF6","#EC4899"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const LEAVE_TYPES = [
  { id: "unpaid",  label: "Unpaid Leave",  color: "#6B7280", bg: "#F3F4F6" },
  { id: "annual",  label: "Annual Leave",  color: "#2563EB", bg: "#EFF6FF" },
  { id: "sick",    label: "Sick Leave",    color: "#DC2626", bg: "#FEF2F2" },
  { id: "public",  label: "Public Holiday",color: "#D97706", bg: "#FFFBEB" },
  { id: "other",   label: "Other",         color: "#7C3AED", bg: "#F5F3FF" },
];

// status label / color map
const STATUS_META = {
  "in-progress": { label: "In Progress",  color: "#10B981" },
  "not-started": { label: "Not Started",  color:"var(--text-muted)" },
  "on-hold":     { label: "On Hold",      color: "#F59E0B" },
  "follow-up":   { label: "Follow Up",    color: "#EC4899" },
  "ready-to-assemble": { label: "Ready to Assemble", color: "#06B6D4" },
  "completed":   { label: "Completed",    color: "#6366F1" },
};
const CUSTOM_STATUS_COLORS = ["#8B5CF6","#F97316","#14B8A6","#84CC16","#0EA5E9","#EF4444","#A855F7","#64748B"];
// Custom statuses (Settings → Jobs) are merged into STATUS_META on every render, so every
// page that already reads STATUS_META picks them up without needing its own changes.
function syncCustomStatuses(customStatuses) {
  Object.keys(STATUS_META).filter(k => k.startsWith("cs_")).forEach(k => delete STATUS_META[k]);
  (customStatuses || []).forEach(s => { STATUS_META[s.id] = { label: s.label, color: s.color }; });
}
const DEFAULT_DASHBOARD_VISIBLE_STATUSES = {
    "not-started": true, "in-progress": true, "on-hold": true, "follow-up": true, "ready-to-assemble": true, "completed": false,
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysDiff(a, b) { return Math.floor((new Date(b) - new Date(a)) / 86400000); }
function formatDate(s) { if (!s) return "—"; return new Date(s).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }); }
function uid() { return "JOB-" + String(Math.floor(Math.random() * 9000) + 1000); }
function suid() { return "s" + Date.now(); }
function cuid() { return "cu" + Date.now(); }
function tuid() { return "t" + Date.now() + Math.floor(Math.random()*1000); }
function nuid() { return "note" + Date.now() + Math.floor(Math.random()*1000); }
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function supid() { return "su" + Date.now(); }
function poid() { return "po" + Date.now(); }
function localISO(dt) { return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; }
function todayISO() { return localISO(new Date()); } // live "today", not the module-load snapshot used by d()
// Works out an invoice due date from the Settings rule. mode "days" = N days after issue; "monthday" = day N of the following month.
function computeDueDate(issueISO, settings) {
  const [y, m, d] = (issueISO || todayISO()).split("-").map(Number);
  const mode = settings?.invoiceDueMode || "days";
  const val = Number(settings?.invoiceDueValue ?? 14);
  if (mode === "monthday") {
    const dim = new Date(y, m + 1, 0).getDate();
    return localISO(new Date(y, m, Math.min(Math.max(val || 1, 1), dim)));
  }
  return localISO(new Date(y, m - 1, d + val));
}
function nextPONumber(purchaseOrders) {
  const nums = purchaseOrders.map(p => parseInt((p.poNumber||"").replace(/\D/g,""), 10)).filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return "PO-" + next;
}

function liid() { return "li" + Date.now() + Math.floor(Math.random()*1000); }
function invid() { return "inv" + Date.now(); }

function buildInvoiceLinesForJob(job, staff, roles, timeEntries, purchaseOrders) {
  const lines = [];
  const jobEntries = (timeEntries || []).filter(t => t.jobId === job.id);
  const hoursByStaff = {};
  jobEntries.forEach(t => { hoursByStaff[t.staffId] = (hoursByStaff[t.staffId] || 0) + t.hours; });
  Object.entries(hoursByStaff).forEach(([staffId, hours]) => {
    const person = staff.find(s => s.id === staffId);
    const { chargeOutRate, roleName } = getRoleRates(person?.roleId, roles);
    lines.push({ id: liid(), type: "labour", description: `Labour — ${person?.name || "Unknown"} (${roleName})`, quantity: hours, unitPrice: chargeOutRate });
  });
  (job.jobCosts || []).forEach(cost => {
    lines.push({ id: liid(), type: "cost", description: cost.label, quantity: 1, unitPrice: cost.amount });
  });
  (purchaseOrders || []).filter(po => po.jobId === job.id && po.status === "billed").forEach(po => {
    lines.push({ id: liid(), type: "po", description: `Purchase Order ${po.poNumber}`, quantity: 1, unitPrice: po.billedCost || 0 });
  });
  return lines;
}
function calcInvoiceTotals(lines, taxRate) {
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const taxAmount = subtotal * ((Number(taxRate) || 0) / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}
function nextInvoiceNumber(invoices, prefix) {
  const p = prefix || "INV";
  const nums = invoices.map(i => parseInt((i.invoiceNumber || "").replace(/\D/g, ""), 10)).filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 1000) + 1;
  return `${p}-${next}`;
}
function nextJobNumberFromSettings(settings) {
  const next = settings?.jobNextNumber;
  if (!next) return "";
  return (settings?.jobNumberPrefix || "") + next;
}
// After a new job is saved, works out what the counter should move to (keeps leading zeros).
function advanceJobCounter(settings, savedId) {
  const prefix = settings?.jobNumberPrefix || "";
  const cur = settings?.jobNextNumber || "";
  if (!cur || !savedId.startsWith(prefix)) return null;
  const tail = savedId.slice(prefix.length);
  if (!/^\d+$/.test(tail)) return null;
  const savedNum = parseInt(tail, 10);
  if (savedNum < parseInt(cur, 10)) return null;
  return String(savedNum + 1).padStart(cur.length, "0");
}
const INVOICE_STATUS_META = {
  draft: { label: "Draft", color: "#9CA3AF" },
  sent: { label: "Sent", color: "#F59E0B" },
  paid: { label: "Paid", color: "#10B981" },
};
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getMonthDays(y, m) {
  return Array.from({ length: getDaysInMonth(y, m) }, (_, i) => {
    const dt = new Date(y, m, i + 1);
    return { day: i + 1, dayName: dt.toLocaleDateString("en-AU", { weekday: "short" }), isWeekend: dt.getDay() === 0 || dt.getDay() === 6 };
  });
}
function exportCSV(filename, headers, rows) {
    const esc = (v) => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click(); URL.revokeObjectURL(url);
}

async function exportPhotosZip(job) {
    const zip = new JSZip();
    const notes = job.jobNotes || [];
    let count = 0;
    for (const note of notes) {
        for (let i = 0; i < (note.photos || []).length; i++) {
            const res = await fetch(note.photos[i]);
            const blob = await res.blob();
            count++;
            const safeName = note.name.replace(/[^a-z0-9]/gi, "_").slice(0, 30);
            zip.file(`${safeName || "photo"}-${i + 1}.jpg`, blob);
        }
    }
    if (count === 0) return false;
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = Object.assign(document.createElement("a"), { href: url, download: `${job.id}-photos.zip` });
    a.click();
    URL.revokeObjectURL(url);
    return true;
}

async function downloadElementAsPDF(elementId, filename) {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const el = document.getElementById(elementId);
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = 210, pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }
    pdf.save(filename);
}
// ─── Tiny UI atoms ────────────────────────────────────────────────────────────
function Badge({ color, children }) {
  return <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{children}</span>;
}
function Avatar({ name, color, size = 28 }) {
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  return <div title={name} style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, flexShrink: 0, border: "2px solid #fff" }}>{initials}</div>;
}
function StatCard({ label, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background:"var(--card-bg)", borderRadius: 14, padding: "22px 26px", flex: 1, minWidth: 140, boxShadow: "0 1px 4px #1C233310", borderTop: `3px solid ${accent}`, cursor: onClick ? "pointer" : "default", transition: "transform .12s, box-shadow .12s" }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 14px #1C233325"; } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 4px #1C233310"; } }}>
      <div style={{ fontSize: 32, fontWeight: 800, color:"var(--text-primary)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color:"var(--text-secondary)", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color:"var(--text-muted)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000055", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background:"var(--card-bg)", borderRadius: 16, padding: 32, width: wide ? 720 : 560, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #00000030" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color:"var(--text-primary)" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color:"var(--text-muted)" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Inp({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 700, color:"var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>}
      <input {...props} style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, color:"var(--text-primary)", outline: "none", boxSizing: "border-box", background: "var(--bg-subtle)", ...props.style }} />
    </div>
  );
}
function Sel({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 700, color:"var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</label>}
      <select {...props} style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, color:"var(--text-primary)", outline: "none", background: "var(--bg-subtle)", boxSizing: "border-box" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function Btn({ children, variant = "primary", ...props }) {
  const s = { primary: { background: ACCENT, color: INK, border: "none" }, secondary: { background:"var(--card-bg)", color:"var(--text-secondary)", border: "1.5px solid var(--border-strong)" }, success: { background: "#10B981", color: "#fff", border: "none" }, danger: { background: "#EF4444", color: "#fff", border: "none" } };
  return <button {...props} style={{ padding: "9px 18px", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: props.disabled ? "not-allowed" : "pointer", opacity: props.disabled ? 0.5 : 1, ...s[variant], ...props.style }}>{children}</button>;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ jobs, staff, roles, settings, onNavigateStatus }) {
    const visibleStatuses = { ...DEFAULT_DASHBOARD_VISIBLE_STATUSES, ...(settings?.dashboardVisibleStatuses || {}) };
    const activeJobs = jobs.filter(j => visibleStatuses[j.status] !== false);
    const total = activeJobs.length;
    const inProg = activeJobs.filter(j => j.status === "in-progress").length;
    const onHold = activeJobs.filter(j => j.status === "on-hold").length;
    const followUp = activeJobs.filter(j => j.status === "follow-up").length;
    const readyToAssemble = activeJobs.filter(j => j.status === "ready-to-assemble").length;
    const notStarted = activeJobs.filter(j => j.status === "not-started").length;
    const today2 = todayISO();
    const holdJobs = activeJobs.filter(j => j.status === "on-hold")
        .slice()
        .sort((a, b) => (b.holdSince ? daysDiff(b.holdSince, today2) : 0) - (a.holdSince ? daysDiff(a.holdSince, today2) : 0))
        .slice(0, 5);
    const followJobs = activeJobs.filter(j => j.status === "follow-up")
        .slice()
        .sort((a, b) => (b.followUpSince ? daysDiff(b.followUpSince, today2) : 0) - (a.followUpSince ? daysDiff(a.followUpSince, today2) : 0))
        .slice(0, 5);
    const dashboardStaff = (settings?.dashboardStaffIds && settings.dashboardStaffIds.length)
        ? staff.filter(s => settings.dashboardStaffIds.includes(s.id))
        : staff;
    const personStats = dashboardStaff.map(s => {
        const mine = activeJobs.filter(j => j.assignedTo.includes(s.id));
        return { ...s, inProg: mine.filter(j => j.status === "in-progress").length, onHold: mine.filter(j => j.status === "on-hold").length, followUp: mine.filter(j => j.status === "follow-up").length, readyToAssemble: mine.filter(j => j.status === "ready-to-assemble").length, completed: 0, total: mine.length };
    });
  const barMax = Math.max(...personStats.map(p => p.total), 1);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color:"var(--text-primary)", margin: "0 0 6px" }}>Dashboard</h1>
          <p style={{ color:"var(--text-secondary)", fontSize: 14, margin: 0 }}>{new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <button onClick={()=>onNavigateStatus("all")} style={{ background:"none", border:"none", cursor:"pointer", textAlign:"right", padding:0 }}>
          <div style={{ fontSize:28, fontWeight:900, color:"var(--text-primary)", lineHeight:1 }}>{total}</div>
          <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2 }}>Total Jobs</div>
        </button>
      </div>

          <div className="dashboard-summary-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ background:"var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310" }}>
                  <h3 style={{ margin: "0 0 20px", fontSize: 13, fontWeight: 800, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Status Breakdown</h3>
                  {Object.entries(STATUS_META).filter(([key]) => visibleStatuses[key] !== false).map(([key, { label, color }]) => {
                      const count = activeJobs.filter(j => j.status === key).length;
            return (
              <div key={key} onClick={()=>onNavigateStatus(key)} style={{ marginBottom: 14, cursor:"pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color:"var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color }}>{count}</span>
                </div>
                <div style={{ background: "var(--bg-page)", borderRadius: 99, height: 9 }}>
                  <div style={{ width: total ? `${(count / total) * 100}%` : "0%", background: color, height: "100%", borderRadius: 99, transition: "width .5s" }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background:"var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color:"var(--text-primary)", textTransform: "uppercase", letterSpacing: 0.5 }}>On Hold — Durations</h3>
          {holdJobs.length === 0 ? <p style={{ color:"var(--text-muted)", fontSize: 13 }}>No jobs on hold.</p> : holdJobs.map((j, i) => {
            const days = j.holdSince ? daysDiff(j.holdSince, todayISO()) : 0;
            return (
                <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 12px", background: "#FFFBF0", borderRadius: 8, borderLeft: `3px solid ${HOLD_COLORS[i % HOLD_COLORS.length]}` }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#78350F" }}>{j.id}</div>
                        <div style={{ fontSize: 11, color: "#92400E", marginTop: 1 }}>{j.title}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: HOLD_COLORS[i % HOLD_COLORS.length] }}>{days}d</div>
                        <div style={{ fontSize: 10, color: "#92400E" }}>on hold</div>
                    </div>
                </div>
            );
          })}
        </div>
        <div style={{ background:"var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 800, color:"var(--text-primary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Follow Up — Durations</h3>
          {followJobs.length === 0 ? <p style={{ color:"var(--text-muted)", fontSize: 13 }}>No jobs awaiting follow up.</p> : followJobs.map((j, i) => {
            const days = j.followUpSince ? daysDiff(j.followUpSince, todayISO()) : 0;
            return (
                <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 12px", background: "#FDF2F8", borderRadius: 8, borderLeft: "3px solid #EC4899" }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#831843" }}>{j.id}</div>
                        <div style={{ fontSize: 11, color: "#9D174D", marginTop: 1 }}>{j.title}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#EC4899" }}>{days}d</div>
                        <div style={{ fontSize: 10, color: "#9D174D" }}>awaiting</div>
                    </div>
                </div>
            );
          })}
        </div>
      </div>
      <div style={{ background:"var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 13, fontWeight: 800, color:"var(--text-primary)", textTransform: "uppercase", letterSpacing: 0.5 }}>Workload by Person</h3>
        {personStats.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: 150, minWidth: 150 }}>
              <Avatar name={p.name} color={p.color} size={30} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color:"var(--text-primary)" }}>{p.name.split(" ")[0]}</div>
                <div style={{ fontSize: 10, color:"var(--text-muted)" }}>{getRoleRates(p.roleId, roles).roleName}</div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", gap: 3, alignItems: "center" }}>
              {p.inProg > 0 && <div title={`${p.inProg} in progress`} style={{ width: `${(p.inProg / barMax) * 60}%`, minWidth: 28, height: 22, background: "#10B981", borderRadius: "4px 0 0 4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{p.inProg}</div>}
              {p.onHold > 0 && <div title={`${p.onHold} on hold`} style={{ width: `${(p.onHold / barMax) * 60}%`, minWidth: 24, height: 22, background: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{p.onHold}</div>}
              {p.followUp > 0 && <div title={`${p.followUp} follow up`} style={{ width: `${(p.followUp / barMax) * 60}%`, minWidth: 24, height: 22, background: "#EC4899", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{p.followUp}</div>}
              {p.readyToAssemble > 0 && <div title={`${p.readyToAssemble} ready to assemble`} style={{ width: `${(p.readyToAssemble / barMax) * 60}%`, minWidth: 24, height: 22, background: "#06B6D4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{p.readyToAssemble}</div>}
              {p.completed > 0 && <div title={`${p.completed} completed`} style={{ width: `${(p.completed / barMax) * 60}%`, minWidth: 24, height: 22, background: "#6366F1", borderRadius: "0 4px 4px 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{p.completed}</div>}
              {p.total === 0 && <span style={{ fontSize: 12, color: "var(--border-strong)" }}>No jobs</span>}
            </div>
            <div style={{ width: 36, textAlign: "right", fontSize: 13, fontWeight: 800, color:"var(--text-primary)" }}>{p.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CSV IMPORT ───────────────────────────────────────────────────────────────
function parseJobsCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { jobs: [], errors: ["CSV must have a header row and at least one data row."] };
  const errors = [];
  const parseLine = (line) => {
    const result = []; let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur.trim()); return result;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]+/g, ""));
  const colMap = { jobno:"jobNo",jobnumber:"jobNo",jobnum:"jobNo",job:"jobNo", workorder:"workOrderNo",workorderno:"workOrderNo",wo:"workOrderNo", description:"title",desc:"title",title:"title",name:"title", orderno:"orderNo",ponumber:"orderNo",po:"orderNo", client:"client",customer:"client", status:"status" };
  const mapped = headers.map(h => colMap[h] || h);
  const idx = (k) => mapped.indexOf(k);
  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseLine(lines[i]);
    const get = (k) => idx(k) >= 0 ? (cols[idx(k)] || "").trim() : "";
    const jobNo = get("jobNo"), title = get("title");
    if (!jobNo && !title) { errors.push(`Row ${i+1}: skipped (no job number or description)`); continue; }
    const rawStatus = get("status").toLowerCase();
    const validStatuses = ["in-progress","not-started","on-hold","follow-up","ready-to-assemble","completed","active","inactive"];
    const statusMap = { active: "in-progress", inactive: "not-started" };
    const status = statusMap[rawStatus] || (validStatuses.includes(rawStatus) ? rawStatus : "not-started");
    imported.push({ id: jobNo || uid(), title: title || jobNo, client: get("client") || "", workOrderNo: get("workOrderNo") || "", orderNo: get("orderNo") || "", status, assignedTo: [], holdReason: null, holdSince: null, followUpNote: null, followUpSince: null, notes: "" });
  }
  return { jobs: imported, errors };
}

// ─── JOBS LIST ────────────────────────────────────────────────────────────────
// ─── JOB CUSTOM FIELDS TEMPLATE ───────────────────────────────────────────────
const FIELD_TYPE_OPTIONS = [{value:"text",label:"Text"},{value:"number",label:"Number"},{value:"date",label:"Date"},{value:"textarea",label:"Long Text"}];

function JobFieldsTemplateModal({ settings, setSettings, onClose }) {
  const [fields, setFields] = useState(settings.jobCustomFields.map(f=>({...f})));

  const updateField = (i, key, val) => setFields(prev => prev.map((f,idx) => idx===i ? { ...f, [key]:val } : f));
  const addField = () => { if (fields.length>=5) return; setFields(prev => [...prev, { id:"cf"+Date.now(), label:"", type:"text" }]); };
  const removeField = (i) => setFields(prev => prev.filter((_,idx)=>idx!==i));
  const save = () => { setSettings(p => ({ ...p, jobCustomFields: fields.filter(f=>f.label.trim()) })); onClose(); };

  return (
    <Modal title="Job Custom Fields" onClose={onClose}>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Add up to 5 custom fields that appear on every job and on the printed job sheet.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        {fields.map((f,i) => (
          <div key={f.id} style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <div style={{ flex:2 }}>
              {i===0 && <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Field Label</label>}
              <input value={f.label} onChange={e=>updateField(i,"label",e.target.value)} placeholder="e.g. Site Address" style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, background:"var(--bg-subtle)", boxSizing:"border-box", outline:"none", color:"var(--text-primary)" }} />
            </div>
            <div style={{ flex:1 }}>
              {i===0 && <label style={{ display:"block", fontSize:11, fontWeight:700, color:"var(--text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Type</label>}
              <select value={f.type} onChange={e=>updateField(i,"type",e.target.value)} style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 10px", fontSize:14, background:"var(--bg-subtle)", boxSizing:"border-box", outline:"none", color:"var(--text-primary)" }}>
                {FIELD_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Btn variant="danger" style={{ padding:"9px 12px", fontSize:12 }} onClick={()=>removeField(i)}>×</Btn>
          </div>
        ))}
        {fields.length===0 && <div style={{ fontSize:12, color:"var(--text-muted)" }}>No custom fields yet.</div>}
      </div>
      {fields.length<5 && <button onClick={addField} style={{ background:"none", border:"1.5px dashed var(--border-strong)", borderRadius:8, padding:"8px 0", width:"100%", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:20 }}>+ Add Field</button>}
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save Fields</Btn>
      </div>
    </Modal>
  );
}

// Merges the saved summary-field order with the current custom fields list:
// keeps existing order/enabled state, drops custom fields that were deleted,
// refreshes labels for any that were renamed, and appends newly-added ones.
function buildSummaryFieldsWorkingList(settings) {
  const customEntries = (settings.jobCustomFields || []).map(cf => ({ key: `custom:${cf.id}`, label: cf.label, enabled: false, width: 140, isCustom: true }));
  const validCustomKeys = new Set(customEntries.map(c => c.key));
  const existing = (settings.jobSummaryFields || []).filter(f => !f.key.startsWith("custom:") || validCustomKeys.has(f.key));
  const existingKeys = new Set(existing.map(f => f.key));
  const refreshed = existing.map(f => {
    const withWidth = f.width ? f : { ...f, width: 130 };
    if (!f.key.startsWith("custom:")) return withWidth;
    const cf = customEntries.find(c => c.key === f.key);
    return cf ? { ...withWidth, label: cf.label, isCustom: true } : withWidth;
  });
  const newOnes = customEntries.filter(c => !existingKeys.has(c.key));
  return [...refreshed, ...newOnes];
}

function JobSummaryFieldsModal({ settings, setSettings, onClose }) {
  const [fields, setFields] = useState(() => buildSummaryFieldsWorkingList(settings));
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const toggleField = (i) => setFields(prev => prev.map((f,idx) => idx===i ? { ...f, enabled: !f.enabled } : f));
  const reorder = (from, to) => setFields(prev => {
    if (from === to || from == null) return prev;
    const next = [...prev];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });
  const save = () => { setSettings(p => ({ ...p, jobSummaryFields: fields })); onClose(); };

  return (
    <Modal title="Job Summary Fields" onClose={onClose}>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Choose which fields appear on each job's summary card on the Jobs page, and the order they appear in. Custom fields you've added also show here automatically. Drag a row by its handle to reorder.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
        {fields.map((f,i) => (
          <div key={f.key}
            draggable
            onDragStart={(e)=>{ dragIndex.current = i; e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e)=>{ e.preventDefault(); if (dragOverIndex !== i) setDragOverIndex(i); }}
            onDragLeave={()=>setDragOverIndex(prev => prev===i ? null : prev)}
            onDrop={(e)=>{ e.preventDefault(); reorder(dragIndex.current, i); dragIndex.current = null; setDragOverIndex(null); }}
            onDragEnd={()=>{ dragIndex.current = null; setDragOverIndex(null); }}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background: dragOverIndex===i ? "var(--bg-subtle2)" : "var(--bg-subtle)", borderRadius:8, border: dragOverIndex===i ? `1.5px dashed ${ACCENT_TEXT}` : "1.5px solid transparent" }}>
            <span style={{ fontSize:15, color:"var(--text-muted)", cursor:"grab", userSelect:"none", lineHeight:1 }}>⠿</span>
            <span style={{ flex:1, fontSize:13, fontWeight:600, color: f.enabled ? "var(--text-primary)" : "var(--text-muted)", display:"flex", alignItems:"center", gap:8 }}>
              {f.label || <em style={{ color:"var(--text-muted)" }}>Untitled field</em>}
              {f.isCustom && <span style={{ fontSize:10, fontWeight:700, color:ACCENT_TEXT, background:ACCENT_SOFT, borderRadius:4, padding:"2px 6px", textTransform:"uppercase", letterSpacing:0.3 }}>Custom</span>}
            </span>
            <ToggleSwitch on={f.enabled} onClick={()=>toggleField(i)} />
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save Order</Btn>
      </div>
    </Modal>
  );
}

function AssetSummaryFieldsModal({ settings, setSettings, onClose }) {
  const [fields, setFields] = useState(() => (settings.assetSummaryFields || []).map(f=>({...f})));

  const toggleField = (i) => setFields(prev => prev.map((f,idx) => idx===i ? { ...f, enabled: !f.enabled } : f));
  const moveField = (i, dir) => setFields(prev => {
    const next = [...prev];
    const j = i + dir;
    if (j < 0 || j >= next.length) return prev;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const save = () => { setSettings(p => ({ ...p, assetSummaryFields: fields })); onClose(); };

  return (
    <Modal title="Asset Fields" onClose={onClose}>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Choose which fields appear as columns on the Asset Register, and the order they appear in. Use the arrows to reorder.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
        {fields.map((f,i) => (
          <div key={f.key} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"var(--bg-subtle)", borderRadius:8 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <button onClick={()=>moveField(i,-1)} disabled={i===0} style={{ background:"none", border:"none", cursor:i===0?"default":"pointer", color:i===0?"var(--border-strong)":"var(--text-secondary)", fontSize:12, lineHeight:1, padding:0 }}>▲</button>
              <button onClick={()=>moveField(i,1)} disabled={i===fields.length-1} style={{ background:"none", border:"none", cursor:i===fields.length-1?"default":"pointer", color:i===fields.length-1?"var(--border-strong)":"var(--text-secondary)", fontSize:12, lineHeight:1, padding:0 }}>▼</button>
            </div>
            <span style={{ flex:1, fontSize:13, fontWeight:600, color: f.enabled ? "var(--text-primary)" : "var(--text-muted)" }}>{f.label}</span>
            <ToggleSwitch on={f.enabled} onClick={()=>toggleField(i)} />
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save Order</Btn>
      </div>
    </Modal>
  );
}

function JobImportModal({ onImport, onClose }) {
  const [importPreview, setImportPreview] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => setImportPreview(parseJobsCSV(ev.target.result));
    r.readAsText(file); e.target.value = "";
  };

  return (
    <Modal title="Import Jobs from CSV" onClose={onClose} wide>
      <div style={{ background: "var(--bg-subtle)", border: "1.5px dashed var(--border-strong)", borderRadius: 10, padding: 20, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 13, color:"var(--text-secondary)", marginBottom: 10 }}>Upload a CSV with columns: <strong>Job No, Work Order, Description, Order No</strong><br/><span style={{ fontSize: 11, color:"var(--text-muted)" }}>Client, Status also supported.</span></div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: "none" }} />
        <Btn onClick={() => fileRef.current?.click()}>Choose CSV File</Btn>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => exportCSV("jobs-import-template.csv",["Job No","Work Order","Description","Order No","Client","Status"],[["JOB-101","WO-2201","Example Job","PO-4401","Client Name","in-progress"]])} style={{ background: "none", border: "none", color: ACCENT_TEXT, cursor: "pointer", fontSize: 12, fontWeight: 700, textDecoration: "underline", padding: 0 }}>⬇ Download template CSV</button>
      </div>
      {importPreview && (
        <div>
          {importPreview.errors.length > 0 && <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 8, padding: 12, marginBottom: 14 }}>{importPreview.errors.map((e,i) => <div key={i} style={{ fontSize: 12, color: "#DC2626" }}>{e}</div>)}</div>}
          {importPreview.jobs.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color:"var(--text-primary)", marginBottom: 10 }}>Ready to import {importPreview.jobs.length} job{importPreview.jobs.length!==1?"s":""}:</div>
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 16 }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                  <thead><tr style={{ background: "var(--bg-subtle)" }}>{["Job No","Work Order","Description","Order No","Client","Status"].map(h => <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontWeight: 700, color:"var(--text-secondary)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
                  <tbody>{importPreview.jobs.map((j,i) => <tr key={i} style={{ borderBottom: "1px solid #F1F4F8" }}><td style={{ padding:"7px 10px",color:ACCENT_TEXT,fontWeight:700 }}>{j.id}</td><td style={{ padding:"7px 10px",color:"var(--text-secondary)" }}>{j.workOrderNo||"—"}</td><td style={{ padding:"7px 10px",color:"var(--text-primary)",fontWeight:600 }}>{j.title}</td><td style={{ padding:"7px 10px",color:"var(--text-secondary)" }}>{j.orderNo||"—"}</td><td style={{ padding:"7px 10px",color:"var(--text-secondary)" }}>{j.client||"—"}</td><td style={{ padding:"7px 10px" }}><Badge color={STATUS_META[j.status]?.color||"#9CA3AF"}>{STATUS_META[j.status]?.label||j.status}</Badge></td></tr>)}</tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
                <Btn variant="success" onClick={() => { onImport(importPreview.jobs); onClose(); }}>Import {importPreview.jobs.length} Jobs</Btn>
              </div>
            </div>
          ) : <div style={{ color:"var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No valid rows found.</div>}
        </div>
      )}
    </Modal>
  );
}

function JobsView({ jobs, staff, customers, settings, setSettings, initialFilter, showCompleted, setShowCompleted, sortKey, setSortKey, sortDir, setSortDir, search, setSearch, onAdd, onEdit, onBack }) {
    const [filter, setFilter] = useState(initialFilter || "all");
  const dragRef = useRef(null); // { key, startX, startWidth, currentWidth }
  const [, forceTick] = useState(0);

  const filtered = useMemo(() => jobs.filter(j => {
    // Completed jobs are hidden by default to keep the list focused on active work —
    // switch on "Show Completed" or explicitly filter to "Completed" to bring them back.
    if (j.status === "completed" && !showCompleted && filter !== "completed") return false;
    const ms = filter === "all" || j.status === filter;
    const q = search.toLowerCase();
    const mt = !search || j.title.toLowerCase().includes(q) || j.id.toLowerCase().includes(q) || (j.client||"").toLowerCase().includes(q) || (j.workOrderNo||"").toLowerCase().includes(q) || (j.orderNo||"").toLowerCase().includes(q);
    return ms && mt;
  }), [jobs, filter, search, showCompleted]);

  const handleExport = () => {
    const headers = ["Job ID","Work Order No","Description","Order No","Client","Status","Assigned To","Hold Reason","On Hold Since","Follow Up Note","Follow Up Since","Notes"];
    const rows = sorted.map(j => [j.id, j.workOrderNo||"", j.title, j.orderNo||"", j.client, STATUS_META[j.status]?.label || j.status, j.assignedTo.map(id => staff.find(s=>s.id===id)?.name||id).join("; "), j.holdReason||"", j.holdSince||"", j.followUpNote||"", j.followUpSince||"", j.notes||""]);
    exportCSV(`jobs-export-${todayISO()}.csv`, headers, rows);
  };

  const FILTER_OPTIONS = [["all","All Statuses"],["in-progress","In Progress"],["not-started","Not Started"],["on-hold","On Hold"],["follow-up","Follow Up"],["ready-to-assemble","Ready to Assemble"],["completed","Completed"], ...Object.entries(STATUS_META).filter(([k])=>k.startsWith("cs_")).map(([k,m])=>[k,m.label])];

  const summaryFields = useMemo(() => buildSummaryFieldsWorkingList(settings || { jobSummaryFields: [], jobCustomFields: [] }).filter(f => f.enabled !== false), [settings]);

  // ── Column resizing ──────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      dragRef.current.currentWidth = Math.max(60, dragRef.current.startWidth + delta);
      forceTick(t => t + 1);
    };
    const onUp = () => {
      if (dragRef.current) {
        const { key, currentWidth } = dragRef.current;
        setSettings(p => ({
          ...p,
          jobSummaryFields: buildSummaryFieldsWorkingList(p).map(f => f.key === key ? { ...f, width: currentWidth } : f),
        }));
        dragRef.current = null;
        forceTick(t => t + 1);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [setSettings]);

  const startResize = (e, key, currentWidth) => {
    e.stopPropagation(); e.preventDefault();
    dragRef.current = { key, startX: e.clientX, startWidth: currentWidth, currentWidth };
    forceTick(t => t + 1);
  };
  const colWidth = (f) => (dragRef.current && dragRef.current.key === f.key) ? dragRef.current.currentWidth : (f.width || 130);

  // ── Sorting ───────────────────────────────────────────────────────────────
  // Defaults to newest job first (by creation date) until the user clicks a column header.
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const getSortValue = (key, job) => {
    if (key.startsWith("custom:")) return (job.customFields && job.customFields[key.replace("custom:","")]) || "";
    switch (key) {
      case "id": return job.id || "";
      case "workOrderNo": return job.workOrderNo || "";
      case "orderNo": return job.orderNo || "";
      case "description": return job.title || "";
      case "customer": return job.client || "";
      case "assignedStaff": return job.assignedTo.map(id => staff.find(s=>s.id===id)?.name).filter(Boolean).join(", ");
      case "status": return STATUS_META[job.status]?.label || job.status || "";
      case "createdAt": return job.createdAt || "";
      default: return "";
    }
  };
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a,b) => {
      const cmp = String(getSortValue(sortKey,a)).localeCompare(String(getSortValue(sortKey,b)), undefined, { numeric:true, sensitivity:"base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, staff]);

  // ── Cell rendering (value only — header carries the label) ─────────────────
  const ellipsis = { display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" };
  const renderCell = (key, job) => {
    if (key.startsWith("custom:")) {
      const val = job.customFields && job.customFields[key.replace("custom:","")];
      return <span style={{ ...ellipsis, fontSize:12, color:"var(--text-secondary)" }}>{val || "—"}</span>;
    }
    switch (key) {
      case "id":
        return <span style={{ ...ellipsis, fontSize:12, fontWeight:700, color:ACCENT_TEXT }}>{job.id}</span>;
      case "workOrderNo":
        return <span style={{ ...ellipsis, fontSize:12, color:"var(--text-secondary)" }}>{job.workOrderNo || "—"}</span>;
      case "orderNo":
        return <span style={{ ...ellipsis, fontSize:12, color:"var(--text-secondary)" }}>{job.orderNo || "—"}</span>;
      case "description":
        return <span style={{ ...ellipsis, fontWeight:700, color:"var(--text-primary)", fontSize:14 }}>{job.title}</span>;
      case "customer":
        return <span style={{ ...ellipsis, fontSize:13, color:"var(--text-secondary)" }}>{job.client || "—"}</span>;
        case "assignedStaff": {
            const assignedStaff = job.assignedTo.map(id => staff.find(s => s.id === id)).filter(Boolean);
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, overflow: "hidden" }}>
                    {assignedStaff.map(s => (
                        <span key={s.id} style={{ fontSize: 12, fontWeight: 700, color: s.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    ))}
                    {assignedStaff.length === 0 && <span style={{ fontSize: 12, color: "var(--border-strong)" }}>—</span>}
                </div>
            );
        }
      case "status": {
        const sm = STATUS_META[job.status] || { label: job.status, color: "var(--text-muted)" };
        const holdDays = job.holdSince ? daysDiff(job.holdSince, todayISO()) : 0;
        const followDays = job.followUpSince ? daysDiff(job.followUpSince, todayISO()) : 0;
        return (
          <div>
            <Badge color={sm.color}>{sm.label}</Badge>
            {job.status === "on-hold" && <div style={{ fontSize:10, color:"#F59E0B", fontWeight:700, marginTop:3 }}>{holdDays}d on hold</div>}
            {job.status === "follow-up" && <div style={{ fontSize:10, color:"#EC4899", fontWeight:700, marginTop:3 }}>{followDays}d follow up</div>}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div>
      {initialFilter && initialFilter !== "all" && onBack && (
        <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, marginBottom:14, display:"flex", alignItems:"center", gap:5 }}>← Back to Dashboard</button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color:"var(--text-primary)", margin: 0 }}>All Jobs</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="secondary" onClick={handleExport}>⬇ Export CSV</Btn>
          <Btn onClick={onAdd}>+ New Job</Btn>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs, clients, work orders..." style={{ flex: 1, minWidth: 200, border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 14px", fontSize: 14, outline: "none", background:"var(--card-bg)", color:"var(--text-primary)" }} />
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid var(--border-strong)", background: "var(--card-bg)", color: "var(--text-primary)", fontWeight: 700, fontSize: 13, cursor: "pointer", minWidth: 180 }}>
          {FILTER_OPTIONS.map(([val,lbl]) => <option key={val} value={val}>{lbl}</option>)}
        </select>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"var(--card-bg)", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"0 14px" }}>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", whiteSpace:"nowrap" }}>Show Completed</span>
          <ToggleSwitch on={showCompleted} onClick={()=>setShowCompleted(v=>!v)} />
        </div>
      </div>

      <div style={{ background:"var(--card-bg)", borderRadius: 12, boxShadow: "0 1px 4px #1C233310", overflow: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
          <colgroup>
            {summaryFields.map(f => <col key={f.key} style={{ width: colWidth(f) }} />)}
          </colgroup>
          <thead>
            <tr>
              {summaryFields.map(f => (
                <th key={f.key} style={{ position:"relative", padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0.4, background:"var(--bg-subtle)", borderBottom:"2px solid var(--border)", userSelect:"none" }}>
                  <div onClick={()=>handleSort(f.key)} style={{ ...ellipsis, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                    <span style={ellipsis}>{f.label}</span>
                    {sortKey===f.key && <span style={{ color:ACCENT_TEXT, flexShrink:0 }}>{sortDir==="asc"?"▲":"▼"}</span>}
                  </div>
                  <div onMouseDown={e=>startResize(e, f.key, colWidth(f))} onClick={e=>e.stopPropagation()}
                    style={{ position:"absolute", right:0, top:0, bottom:0, width:8, cursor:"col-resize" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--border-strong)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(job => {
              const sm = STATUS_META[job.status] || { label: job.status, color:"var(--text-muted)" };
              return (
                <tr key={job.id} onClick={() => onEdit(job)} style={{ cursor:"pointer", borderBottom:"1px solid var(--border)" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--bg-subtle)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  {summaryFields.map((f,i) => (
                    <td key={f.key} style={{ padding:"10px 14px", overflow:"hidden", borderLeft: i===0 ? `4px solid ${sm.color}` : "none", verticalAlign:"middle" }}>
                      {renderCell(f.key, job)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && <div style={{ textAlign: "center", color:"var(--text-muted)", padding: 40, fontSize: 14 }}>No jobs found.</div>}
      </div>
    </div>
  );
}

// ─── ON HOLD ──────────────────────────────────────────────────────────────────
function OnHoldView({ jobs, staff, onEdit, onBack }) {
  const holdJobs = jobs.filter(j => j.status==="on-hold").sort((a,b) => a.holdSince>b.holdSince?1:-1);
  const today2 = todayISO();
  return (
    <div>
      {onBack && <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, marginBottom:14, display:"flex", alignItems:"center", gap:5 }}>← Back to Dashboard</button>}
      <h1 style={{ fontSize: 24, fontWeight: 900, color:"var(--text-primary)", margin: "0 0 6px" }}>On Hold</h1>
      <p style={{ color:"var(--text-secondary)", fontSize: 14, margin: "0 0 24px" }}>{holdJobs.length} job{holdJobs.length!==1?"s":""} currently on hold</p>
      {holdJobs.length === 0 && <div style={{ background:"var(--card-bg)", borderRadius: 14, padding: 40, textAlign: "center", color:"var(--text-muted)" }}>No jobs on hold.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {holdJobs.map(job => {
          const days = job.holdSince ? daysDiff(job.holdSince, today2) : 0;
          const urgency = days > 14 ? "#EF4444" : days > 7 ? "#F59E0B" : "#6366F1";
          const assignedStaff = job.assignedTo.map(id => staff.find(s=>s.id===id)).filter(Boolean);
          return (
            <div key={job.id} style={{ background:"var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310", borderTop: `3px solid ${urgency}`, cursor: "pointer" }} onClick={() => onEdit(job)}
              onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 16px #1C233320"}
              onMouseLeave={e => e.currentTarget.style.boxShadow="0 1px 4px #1C233310"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 12, color: ACCENT_TEXT, fontWeight: 700 }}>{job.id}</span>
                  <h3 style={{ margin: "4px 0 2px", fontSize: 17, fontWeight: 800, color:"var(--text-primary)" }}>{job.title}</h3>
                  <span style={{ fontSize: 13, color:"var(--text-secondary)" }}>{job.client}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: urgency, lineHeight: 1 }}>{days}</div>
                  <div style={{ fontSize: 11, color:"var(--text-muted)", fontWeight: 600 }}>DAYS ON HOLD</div>
                  <div style={{ fontSize: 11, color:"var(--text-muted)", marginTop: 2 }}>Since {formatDate(job.holdSince)}</div>
                </div>
              </div>
              <div style={{ background: "#FFF8EC", border: "1.5px solid #FDE68A", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Reason for Hold</div>
                <div style={{ fontSize: 13, color: "#78350F" }}>{job.holdReason || "No reason specified"}</div>
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color:"var(--text-muted)", marginBottom: 6 }}>Assigned</div>
                  <div style={{ display: "flex", gap: 4 }}>{assignedStaff.map(s => <Avatar key={s.id} name={s.name} color={s.color} size={28} />)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FOLLOW UP ────────────────────────────────────────────────────────────────
function FollowUpView({ jobs, staff, onEdit, onBack }) {
  const followJobs = jobs.filter(j => j.status==="follow-up").sort((a,b) => a.followUpSince>b.followUpSince?1:-1);
  const today2 = todayISO();
  return (
    <div>
      {onBack && <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, marginBottom:14, display:"flex", alignItems:"center", gap:5 }}>← Back to Dashboard</button>}
      <h1 style={{ fontSize: 24, fontWeight: 900, color:"var(--text-primary)", margin: "0 0 6px" }}>Follow Up</h1>
      <p style={{ color:"var(--text-secondary)", fontSize: 14, margin: "0 0 24px" }}>{followJobs.length} job{followJobs.length!==1?"s":""} awaiting follow up</p>
      {followJobs.length === 0 && <div style={{ background:"var(--card-bg)", borderRadius: 14, padding: 40, textAlign: "center", color:"var(--text-muted)" }}>No jobs awaiting follow up.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {followJobs.map(job => {
          const days = job.followUpSince ? daysDiff(job.followUpSince, today2) : 0;
          const urgency = days > 14 ? "#EF4444" : days > 7 ? "#F59E0B" : "#EC4899";
          const assignedStaff = job.assignedTo.map(id => staff.find(s=>s.id===id)).filter(Boolean);
          return (
            <div key={job.id} style={{ background:"var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310", borderTop: `3px solid ${urgency}`, cursor: "pointer" }} onClick={() => onEdit(job)}
              onMouseEnter={e => e.currentTarget.style.boxShadow="0 4px 16px #1C233320"}
              onMouseLeave={e => e.currentTarget.style.boxShadow="0 1px 4px #1C233310"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 12, color: ACCENT_TEXT, fontWeight: 700 }}>{job.id}</span>
                  <h3 style={{ margin: "4px 0 2px", fontSize: 17, fontWeight: 800, color:"var(--text-primary)" }}>{job.title}</h3>
                  <span style={{ fontSize: 13, color:"var(--text-secondary)" }}>{job.client}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: urgency, lineHeight: 1 }}>{days}</div>
                  <div style={{ fontSize: 11, color:"var(--text-muted)", fontWeight: 600 }}>DAYS AWAITING</div>
                  <div style={{ fontSize: 11, color:"var(--text-muted)", marginTop: 2 }}>Since {formatDate(job.followUpSince)}</div>
                </div>
              </div>
              <div style={{ background: "#FDF2F8", border: "1.5px solid #FBCFE8", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9D174D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Follow Up Note</div>
                <div style={{ fontSize: 13, color: "#831843" }}>{job.followUpNote || "No note specified"}</div>
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color:"var(--text-muted)", marginBottom: 6 }}>Assigned</div>
                  <div style={{ display: "flex", gap: 4 }}>{assignedStaff.map(s => <Avatar key={s.id} name={s.name} color={s.color} size={28} />)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SCHEDULER ────────────────────────────────────────────────────────────────
function CellPicker({ jobs, onSelect, onClose }) {
  const [mode, setMode] = useState("job"); // "job" | "leave"
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, [mode]);

  const activeJobs = jobs.filter(j => j.status !== "completed");
  const filteredJobs = activeJobs.filter(j => !search || j.id.toLowerCase().includes(search.toLowerCase()) || j.title.toLowerCase().includes(search.toLowerCase()));
  const filteredLeave = LEAVE_TYPES.filter(lt => !search || lt.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: "absolute", zIndex: 500, background:"var(--card-bg)", border: "1.5px solid var(--border-strong)", borderRadius: 12, boxShadow: "0 8px 32px #1C233330", width: 300, overflow: "hidden" }}>
      {/* Toggle */}
      <div style={{ display: "flex", padding: 4, gap: 4, background: "var(--bg-page)" }}>
        {[["job","Job"],["leave","Leave"],["text","Manual"]].map(([val,lbl]) => (
          <button key={val} onClick={() => { setMode(val); setSearch(""); }}
            style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 8, background: mode===val?ACCENT:"transparent", color: mode===val?INK:"#5C6B82", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all .15s" }}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{ padding: "10px 12px", borderBottom: "1px solid #F1F4F8" }}>
        <input ref={ref} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (mode === "text" && e.key === "Enter" && search.trim()) onSelect(`text:${search.trim()}`); }}
          placeholder={mode==="job" ? "Search job number or description..." : mode==="text" ? "Type anything, e.g. Quoting at Nexcore" : "Search leave type..."}
          style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 7, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      </div>

      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {mode === "text" ? (
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>Type anything that isn't a job, e.g. "Workshop" or "Quoting at Nexcore", then press Enter.</div>
            <Btn style={{ padding: "7px 14px", fontSize: 12 }} disabled={!search.trim()} onClick={() => onSelect(`text:${search.trim()}`)}>Add to schedule</Btn>
          </div>
        ) : mode === "leave" ? (
          <>
            {filteredLeave.length === 0 && <div style={{ padding: "10px 14px", fontSize: 12, color: "#C4CAD4" }}>No leave types match.</div>}
            {filteredLeave.map(lt => (
              <div key={lt.id} onClick={() => onSelect(`leave:${lt.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", cursor: "pointer", transition: "background .1s" }}
                onMouseEnter={e => e.currentTarget.style.background="var(--bg-subtle)"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: lt.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: lt.color, fontWeight: 600 }}>{lt.label}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {filteredJobs.length === 0 && <div style={{ padding: "10px 14px", fontSize: 12, color: "#C4CAD4" }}>No jobs match.</div>}
            {filteredJobs.map(j => {
              const sm = STATUS_META[j.status] || { label: j.status, color:"var(--text-muted)" };
              return (
                <div key={j.id} onClick={() => onSelect(`job:${j.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", cursor: "pointer", transition: "background .1s" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--bg-subtle)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: sm.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT_TEXT }}>{j.id}</div>
                    <div style={{ fontSize: 11, color:"var(--text-secondary)" }}>{j.title}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <div style={{ padding: "8px 12px", borderTop: "1px solid #F1F4F8" }}>
        <button onClick={onClose} style={{ fontSize: 12, color:"var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

function SchedulerView({ jobs, staff: allStaff, roles, settings, scheduleData, setScheduleData }) {
    const staff = (settings?.schedulerStaffIds && settings.schedulerStaffIds.length) ? allStaff.filter(s => settings.schedulerStaffIds.includes(s.id)) : allStaff;
    const [openCell, setOpenCell] = useState(null); // { staffId, dayIdx }
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => { const d2 = new Date(); const dow = (d2.getDay() + 6) % 7; d2.setDate(d2.getDate() - dow + weekOffset * 7); return d2; }, [weekOffset]);
    const weekKey = useMemo(() => localISO(weekStart), [weekStart]);
  const weekLabel = useMemo(() => { const end = new Date(weekStart); end.setDate(end.getDate() + 6); return `${weekStart.toLocaleDateString("en-AU",{day:"numeric",month:"short"})} – ${end.toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}`; }, [weekStart]);
  const weekDays = useMemo(() => TIMESHEET_DAYS.map(({ name, weekend }, i) => { const dt = new Date(weekStart); dt.setDate(dt.getDate()+i); return { name, weekend, date: dt.toLocaleDateString("en-AU",{day:"numeric",month:"short"}), idx: i }; }), [weekStart]);

    const getCell = (sId, di) => {
        const raw = scheduleData[sId]?.[weekKey]?.[di];
        if (!raw) return [];
        return Array.isArray(raw) ? raw : [raw];
    };
    const addToCell = (sId, di, val) => setScheduleData(prev => {
        const day = prev[sId]?.[weekKey]?.[di];
        const current = Array.isArray(day) ? day : (day ? [day] : []);
        if (current.includes(val)) return prev;
        return { ...prev, [sId]: { ...(prev[sId] || {}), [weekKey]: { ...(prev[sId]?.[weekKey] || {}), [di]: [...current, val] } } };
    });
    const removeFromCell = (sId, di, val) => setScheduleData(prev => {
        const day = prev[sId]?.[weekKey]?.[di];
        const current = Array.isArray(day) ? day : (day ? [day] : []);
        const next = current.filter(v => v !== val);
        return { ...prev, [sId]: { ...(prev[sId] || {}), [weekKey]: { ...(prev[sId]?.[weekKey] || {}), [di]: next } } };
    });

    const getCellStyle = (val) => {
        if (!val) return null;
        if (val.startsWith("leave:")) { const lt = LEAVE_TYPES.find(l => l.id === val.replace("leave:", "")); return lt ? { bg: lt.bg, color: lt.color, label: lt.label } : null; }
        if (val.startsWith("text:")) { return { bg: "#64748B22", color: "#64748B", label: val.slice(5) }; } if (val.startsWith("job:")) { const j = jobs.find(j => j.id === val.replace("job:", "")); const sm = STATUS_META[j?.status] || { color: ACCENT_TEXT }; return { bg: sm.color + "22", color: sm.color, label: val.replace("job:", ""), sublabel: j?.title || "" }; }
        return null;
    };

  const isOpen = (sId, di) => openCell?.staffId===sId && openCell?.dayIdx===di;

  return (
    <div onClick={() => setOpenCell(null)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color:"var(--text-primary)", margin: "0 0 4px" }}>Weekly Scheduler</h1>
          <p style={{ color:"var(--text-secondary)", fontSize: 14, margin: 0 }}>{weekLabel}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: "8px 16px", border: "1.5px solid var(--border-strong)", borderRadius: 8, background: "var(--card-bg)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700 }}>← Prev</button>
                  <button onClick={() => setWeekOffset(0)} style={{ padding: "8px 14px", border: "1.5px solid var(--border-strong)", borderRadius: 8, background: "var(--card-bg)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>Today</button>
                  <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: "8px 16px", border: "1.5px solid var(--border-strong)", borderRadius: 8, background: "var(--card-bg)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700 }}>Next →</button>
        </div>
      </div>

      <div style={{ background:"var(--card-bg)", borderRadius: 14, overflow: "visible", boxShadow: "0 1px 4px #1C233310" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color:"var(--text-muted)", background: "var(--bg-subtle)", borderBottom: "2px solid var(--border)", minWidth: 180 }}>Person</th>
              {weekDays.map(({ name, date, weekend }) => (
                <th key={name} style={{ padding: "12px 8px", textAlign: "center", fontSize: 13, fontWeight: 700, color: weekend?"var(--text-muted)":ACCENT_TEXT, background: weekend?"var(--bg-subtle2)":"var(--bg-subtle)", borderBottom: "2px solid var(--border)", borderLeft: "1.5px solid var(--border)", minWidth: 130 }}>
                  <div>{name}</div>
                  <div style={{ fontSize: 11, color:"var(--text-muted)", fontWeight: 500, marginTop: 2 }}>{date}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((s, si) => (
              <tr key={s.id} style={{ borderBottom: "1.5px solid #F1F4F8" }}>
                <td style={{ padding: "12px 16px", background: si%2===0?"var(--bg-subtle)":"var(--card-bg)", borderRight: "1.5px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Avatar name={s.name} color={s.color} size={32} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color:"var(--text-primary)" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color:"var(--text-muted)" }}>{getRoleRates(s.roleId, roles).roleName}</div>
                    </div>
                  </div>
                </td>
                    {weekDays.map(({ idx, weekend }) => {
                        const entries = getCell(s.id, idx);
                        const open = isOpen(s.id, idx);
                        const cellBg = weekend ? (si % 2 === 0 ? "var(--bg-subtle2)" : "#EFF1F4") : (si % 2 === 0 ? "var(--bg-subtle)" : "var(--card-bg)");
                        return (
                            <td key={idx} style={{ borderLeft: "1.5px solid var(--border)", background: cellBg, verticalAlign: "top", padding: 6, position: "relative" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {entries.map((val, ei) => {
                                        const cs = getCellStyle(val);
                                        if (!cs) return null;
                                        return (
                                            <div key={ei} style={{ background: cs.bg, border: `1.5px solid ${cs.color}55`, borderLeft: `3px solid ${cs.color}`, borderRadius: 7, padding: "4px 7px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                                                <div style={{ overflow: "hidden", flex: 1 }}>
                                                    <div title={cs.label} style={{ fontSize: 11, fontWeight: 700, color: cs.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: val.startsWith("text:") ? "normal" : "nowrap", wordBreak: "break-word" }}>{cs.label}</div>
                                                    {cs.sublabel && <div style={{ fontSize: 9, color: cs.color + "CC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cs.sublabel}</div>}
                                                </div>
                                                <span onClick={e => { e.stopPropagation(); removeFromCell(s.id, idx, val); }} style={{ fontSize: 13, color: cs.color + "88", lineHeight: 1, flexShrink: 0, cursor: "pointer" }}>×</span>
                                            </div>
                                        );
                                    })}
                                    <div onClick={e => { e.stopPropagation(); setOpenCell(open ? null : { staffId: s.id, dayIdx: idx }); }}
                                        style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 7, border: "1.5px dashed var(--border)", padding: entries.length ? "3px 0" : "14px 0", transition: "border-color .15s, background .15s" }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = ACCENT_SOFT; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "transparent"; }}>
                                        <span style={{ fontSize: entries.length ? 14 : 18, color: "var(--border-strong)" }}>+</span>
                                    </div>
                                </div>
                                {open && (
                                    <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 500 }} onClick={e => e.stopPropagation()}>
                                        <CellPicker jobs={jobs} onSelect={v => { addToCell(s.id, idx, v); setOpenCell(null); }} onClose={() => setOpenCell(null)} />
                                    </div>
                                )}
                            </td>
                        );
                    })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 16px", fontSize: 11, color:"var(--text-muted)", borderTop: "1px solid #F1F4F8" }}>Click a cell to assign a job or leave type. Click a filled cell's × to clear it.</div>
      </div>
    </div>
  );
}

// ─── TIMESHEETS ───────────────────────────────────────────────────────────────
function TimeEntryPicker({ jobs, editingEntry, staffId, dayEntries, timeStep, onSave, onDelete, onClose }) {
  const isEditing = !!editingEntry;
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState(editingEntry ? jobs.find(j=>j.id===editingEntry.jobId) || null : null);
  const lastEnd = (dayEntries || []).filter(t => !editingEntry || t.id !== editingEntry.id).map(t => t.endTime).filter(Boolean).sort().pop();
  const [startTime, setStartTime] = useState(editingEntry?.startTime || lastEnd || "08:00");
  const [endTime, setEndTime] = useState(editingEntry?.endTime || "");
  const [timeError, setTimeError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const searchRef = useRef(null);
  const startRef = useRef(null);
  useEffect(() => { (selectedJob ? startRef : searchRef).current?.focus(); }, [selectedJob]);

  const activeJobs = jobs.filter(j => j.status !== "completed" || (editingEntry && j.id === editingEntry.jobId));
const q = search.toLowerCase();
  const isMine = (j) => (j.assignedTo || []).includes(staffId);
  const filtered = activeJobs
    .filter(j => !q || j.id.toLowerCase().includes(q) || j.title.toLowerCase().includes(q) || (j.client || "").toLowerCase().includes(q) || (j.workOrderNo || "").toLowerCase().includes(q))
    .sort((a, b) => (isMine(b) ? 1 : 0) - (isMine(a) ? 1 : 0));

  // Adds time to the End field (or to Start if End is empty). Typing in the fields still overrides.
  const addDuration = (mins) => {
    if (!startTime) return;
    const base = endTime ? timeToMinutes(endTime) : timeToMinutes(startTime);
    const next = Math.min(base + mins, 23 * 60 + 59);
    setEndTime(`${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`);
    setTimeError("");
  };
  const quickBtns = [...new Set([timeStep || 15, 30, 60])].sort((a, b) => a - b);
  const computedHours = (startTime && endTime) ? minutesToHours(timeToMinutes(endTime) - timeToMinutes(startTime)) : null;

  const submit = () => {
    if (!selectedJob || !startTime || !endTime) return;
    if (computedHours === null || computedHours <= 0) { setTimeError("End time must be after start time."); return; }
    onSave(selectedJob.id, startTime, endTime, computedHours);
  };

  return (
    <div style={{ position: "absolute", zIndex: 500, background:"var(--card-bg)", border: "1.5px solid var(--border-strong)", borderRadius: 12, boxShadow: "0 8px 32px #1C233330", width: 300, overflow: "hidden" }}>
      {confirmingDelete ? (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>Delete this entry?</div>
          <div style={{ fontSize: 12, color: "#7F1D1D", marginBottom: 14 }}>{editingEntry.jobId} · {formatTimeRange(editingEntry.startTime, editingEntry.endTime)}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="secondary" style={{ padding: "7px 14px", fontSize: 12 }} onClick={()=>setConfirmingDelete(false)}>Cancel</Btn>
            <Btn variant="danger" style={{ padding: "7px 14px", fontSize: 12 }} onClick={()=>onDelete(editingEntry.id)}>Delete</Btn>
          </div>
        </div>
      ) : !selectedJob ? (
        <>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #F1F4F8" }}>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job number or description..." style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 7, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.length === 0 && <div style={{ padding: "10px 14px", fontSize: 12, color: "#C4CAD4" }}>No jobs match.</div>}
                        {filtered.map(j => {
              const sm = STATUS_META[j.status] || { label: j.status, color:"var(--text-muted)" };
              const mine = isMine(j);
              return (
                <div key={j.id} onClick={() => setSelectedJob(j)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 14px", cursor: "pointer", transition: "background .1s", borderLeft: mine ? "3px solid #10B981" : "3px solid transparent" }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--bg-subtle)"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: sm.color, flexShrink: 0, marginTop: 3 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT_TEXT }}>{j.id}{j.workOrderNo ? <span style={{ fontWeight: 600, color: "var(--text-muted)" }}> · WO {j.workOrderNo}</span> : null}{mine && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: "#10B981", textTransform: "uppercase", letterSpacing: 0.4 }}>Assigned</span>}</div>
                    <div style={{ fontSize: 11, color:"var(--text-secondary)" }}>{j.title}</div>
                    {j.client && <div style={{ fontSize: 11, color:"var(--text-muted)" }}>{j.client}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "8px 12px", borderTop: "1px solid #F1F4F8" }}>
            <button onClick={onClose} style={{ fontSize: 12, color:"var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
          </div>
        </>
      ) : (
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, cursor: "pointer" }} onClick={() => setSelectedJob(null)}>
            <span style={{ fontSize: 14, color:"var(--text-muted)" }}>←</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT_TEXT }}>{selectedJob.id}</span>
          </div>
          <div style={{ fontSize: 12, color:"var(--text-secondary)", marginBottom: 12 }}>{selectedJob.title}{(selectedJob.client || selectedJob.workOrderNo) && <div style={{ fontSize: 11, color:"var(--text-muted)", marginTop: 2 }}>{[selectedJob.client, selectedJob.workOrderNo && `WO ${selectedJob.workOrderNo}`].filter(Boolean).join(" · ")}</div>}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color:"var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Start</label>
              <input ref={startRef} type="time" step={(timeStep || 15) * 60} value={startTime} onChange={e => { setStartTime(e.target.value); setTimeError(""); }} style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 7, padding: "7px 8px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color:"var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>End</label>
              <input type="time" step={(timeStep || 15) * 60} value={endTime} onChange={e => { setEndTime(e.target.value); setTimeError(""); }} onKeyDown={e => e.key === "Enter" && submit()} style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 7, padding: "7px 8px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color:"var(--text-muted)", fontWeight: 700 }}>Add time:</span>
            {quickBtns.map(m => (
              <button key={m} type="button" onClick={() => addDuration(m)} style={{ padding: "4px 10px", border: "1.5px solid var(--border-strong)", borderRadius: 6, background: "var(--bg-subtle)", color: "var(--text-primary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+{m < 60 ? `${m}m` : `${m / 60}h`}</button>
            ))}
          </div>
          {timeError && <div style={{ fontSize: 11, color: "#DC2626", marginBottom: 8 }}>{timeError}</div>}
          {computedHours !== null && computedHours > 0 && (
            <div style={{ fontSize: 12, color: ACCENT_TEXT, fontWeight: 700, marginBottom: 12 }}>= {computedHours % 1 === 0 ? computedHours : computedHours.toFixed(2)} hours</div>
          )}
          {(computedHours === null || computedHours <= 0) && <div style={{ marginBottom: 12 }} />}
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <div>{isEditing && <Btn variant="danger" style={{ padding: "7px 14px", fontSize: 12 }} onClick={()=>setConfirmingDelete(true)}>Delete</Btn>}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" style={{ padding: "7px 14px", fontSize: 12 }} onClick={onClose}>Cancel</Btn>
              <Btn style={{ padding: "7px 14px", fontSize: 12 }} onClick={submit}>{isEditing ? "Save Changes" : "Add Entry"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimesheetsView({ jobs, staff: allStaff, roles, timeEntries, setTimeEntries, settings }) {
    const staff = (settings?.timesheetsStaffIds && settings.timesheetsStaffIds.length) ? allStaff.filter(s => settings.timesheetsStaffIds.includes(s.id)) : allStaff;
  const [weekOffset, setWeekOffset] = useState(0);
  const [openCell, setOpenCell] = useState(null); // { staffId, dayIdx }
    const showCost = !settings?.hideLabourCosts;
  const startDay = settings?.weekStartDay ?? 1;

  const weekStart = useMemo(() => getWeekStartDate(weekOffset, startDay), [weekOffset, startDay]);
  const weekLabel = useMemo(() => { const end = new Date(weekStart); end.setDate(end.getDate() + 6); return `${weekStart.toLocaleDateString("en-AU",{day:"numeric",month:"short"})} – ${end.toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}`; }, [weekStart]);
  const weekDays = useMemo(() => getOrderedWeekDays(startDay).map(({ name, weekend }, i) => { const dt = new Date(weekStart); dt.setDate(dt.getDate()+i); return { name, weekend, date: localISO(dt), display: dt.toLocaleDateString("en-AU",{day:"numeric",month:"short"}) }; }), [weekStart, startDay]);

  const jobColor = (jobId) => { const j = jobs.find(j=>j.id===jobId); return (STATUS_META[j?.status]||{color:ACCENT_TEXT}).color; };
  const entriesFor = (staffId, date) => timeEntries.filter(t => t.staffId===staffId && t.date===date);
  const dayTotal = (staffId, date) => entriesFor(staffId, date).reduce((s,t)=>s+t.hours,0);
  const weekTotal = (staffId) => weekDays.reduce((s,{date})=>s+dayTotal(staffId,date),0);
  const weekCost = (staffId) => { const rate = getRoleRates(staff.find(s=>s.id===staffId)?.roleId, roles).costRate; return weekTotal(staffId)*rate; };
  const grandHours = () => staff.reduce((s,st)=>s+weekTotal(st.id),0);
  const grandCost = () => staff.reduce((s,st)=>s+weekCost(st.id),0);

  const addEntry = (staffId, date, jobId, startTime, endTime, hours) => {
    setTimeEntries(prev => [...prev, { id: tuid(), staffId, date, jobId, startTime, endTime, hours }]);
    setOpenCell(null);
  };
  const updateEntry = (id, jobId, startTime, endTime, hours) => {
    setTimeEntries(prev => prev.map(t => t.id===id ? { ...t, jobId, startTime, endTime, hours } : t));
    setOpenCell(null);
  };
  const removeEntry = (id) => { setTimeEntries(prev => prev.filter(t => t.id !== id)); setOpenCell(null); };

  const fmt = (n) => n % 1 === 0 ? String(n) : n.toFixed(1);

  const handleExport = () => {
    // Sorted by surname (last word of the name) so the export stays alphabetical
    // regardless of the order staff were added in Contacts.
    const bySurname = [...staff].sort((a, b) => {
      const lastA = a.name.trim().split(" ").pop();
      const lastB = b.name.trim().split(" ").pop();
      return lastA.localeCompare(lastB);
    });
    const headers = ["Staff", ...weekDays.map(d=>`${d.name} ${d.display}`), "Total Hours"];
    const rows = bySurname.map(s => [s.name, ...weekDays.map(({date})=>dayTotal(s.id,date)||0), weekTotal(s.id)]);
    exportCSV(`timesheet-${localISO(weekStart)}.csv`, headers, rows);
  };

  return (
    <div onClick={() => setOpenCell(null)}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24,fontWeight:900,color:"var(--text-primary)",margin:"0 0 4px" }}>Timesheets</h1>
          <p style={{ color:"var(--text-secondary)",fontSize:14,margin:0 }}>{weekLabel}</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <Btn variant="secondary" onClick={handleExport}>⬇ Export Weekly CSV</Btn>
                  <button onClick={() => setWeekOffset(w => w - 1)} style={{ padding: "8px 16px", border: "1.5px solid var(--border-strong)", borderRadius: 8, background: "var(--card-bg)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700 }}>← Prev</button>
                  <button onClick={() => setWeekOffset(0)} style={{ padding: "8px 14px", border: "1.5px solid var(--border-strong)", borderRadius: 8, background: "var(--card-bg)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>Today</button>
                  <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: "8px 16px", border: "1.5px solid var(--border-strong)", borderRadius: 8, background: "var(--card-bg)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700 }}>Next →</button>
        </div>
      </div>

      <div style={{ background:"var(--card-bg)", borderRadius:14, overflow:"auto", boxShadow:"0 1px 4px #1C233310" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", minWidth:1000 }}>
          <thead>
            <tr>
              <th style={{ padding:"12px 16px", textAlign:"left", fontSize:12, fontWeight:700, color:"var(--text-muted)", background:"var(--bg-subtle)", borderBottom:"2px solid var(--border)", minWidth:170 }}>Person</th>
              {weekDays.map(({ name, display, weekend }) => (
                <th key={name} style={{ padding:"12px 8px", textAlign:"center", fontSize:13, fontWeight:700, color:weekend?"#B0B8C4":ACCENT_TEXT, background:weekend?"var(--bg-page)":"var(--bg-subtle)", borderBottom:"2px solid var(--border)", borderLeft:"1.5px solid var(--border)", minWidth:110 }}>
                  <div>{name}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", fontWeight:500, marginTop:2 }}>{display}</div>
                </th>
              ))}
              <th style={{ padding:"12px 8px", textAlign:"center", fontSize:12, fontWeight:700, color:"var(--text-primary)", background:"var(--bg-subtle2)", borderBottom:"2px solid var(--border)", borderLeft:"1.5px solid var(--border)", minWidth:80 }}>Total Hrs</th>
              <th style={{ padding:"12px 8px", textAlign:"center", fontSize:12, fontWeight:700, color:"#065F46", background:"#F0FDF4", borderBottom:"2px solid var(--border)", borderLeft:"1.5px solid var(--border)", minWidth:90, display: showCost ? "table-cell" : "none" }}>Labour Cost</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s, si) => (
              <tr key={s.id} style={{ borderBottom:"1.5px solid #F1F4F8" }}>
                <td style={{ padding:"12px 16px", background:si%2===0?"var(--bg-subtle)":"var(--card-bg)", borderRight:"1.5px solid var(--border)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <Avatar name={s.name} color={s.color} size={32}/>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>{s.name}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>{(() => { const rr = getRoleRates(s.roleId, roles); return (rr.costRate && showCost) ?`$${rr.costRate}/hr cost` : rr.roleName; })()}</div>
                    </div>
                  </div>
                </td>
                {weekDays.map(({ date, weekend }, di) => {
                  const entries = entriesFor(s.id, date);
                  const open = openCell?.staffId===s.id && openCell?.dayIdx===di;
                  const editingEntry = open && openCell.entryId ? entries.find(e=>e.id===openCell.entryId) : null;
                  return (
                    <td key={date} style={{ borderLeft:"1.5px solid var(--border)", background:weekend?(si%2===0?"var(--bg-subtle2)":"var(--bg-subtle)"):(si%2===0?"var(--bg-subtle)":"var(--card-bg)"), padding:6, verticalAlign:"top", position:"relative" }}>
                      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                        {entries.map(t => {
                          const c = jobColor(t.jobId);
                          const range = formatTimeRange(t.startTime, t.endTime);
                          return (
                            <div key={t.id} title={`${range} — click to edit`}
                              onClick={e=>{e.stopPropagation(); setOpenCell(open && openCell.entryId===t.id ? null : {staffId:s.id, dayIdx:di, entryId:t.id});}}
                              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:4, background:c+"18", border:`1px solid ${c}55`, borderLeft:`3px solid ${c}`, borderRadius:6, padding:"3px 6px", cursor:"pointer" }}>
                              <span style={{ fontSize:11, fontWeight:700, color:c, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.jobId} · {fmt(t.hours)}h</span>
                              <span onClick={e=>{e.stopPropagation(); removeEntry(t.id);}} style={{ fontSize:13, color:c+"99", cursor:"pointer", lineHeight:1, flexShrink:0 }}>×</span>
                            </div>
                          );
                        })}
                        <div onClick={e=>{e.stopPropagation(); setOpenCell(open && !openCell.entryId ? null : {staffId:s.id, dayIdx:di, entryId:null});}}
                          style={{ textAlign:"center", padding:"4px 0", fontSize:11, color:"#C4CAD4", cursor:"pointer", border:"1.5px dashed var(--border)", borderRadius:6 }}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor="#2E4A7A55"; e.currentTarget.style.background=ACCENT_SOFT;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.background="transparent";}}>
                          + Add
                        </div>
                      </div>
                      {open && (
                        <div style={{ position:"absolute", top:"100%", left:0 }} onClick={e=>e.stopPropagation()}>
                          <TimeEntryPicker jobs={jobs} editingEntry={editingEntry} staffId={s.id} dayEntries={entries} timeStep={settings?.timeStep || 15}
                            onSave={(jobId,startTime,endTime,hours)=> editingEntry ? updateEntry(editingEntry.id,jobId,startTime,endTime,hours) : addEntry(s.id,date,jobId,startTime,endTime,hours)}
                            onDelete={removeEntry}
                            onClose={()=>setOpenCell(null)} />
                        </div>
                      )}
                    </td>
                  );
                })}
                <td style={{ borderLeft:"1.5px solid var(--border)", background:"var(--bg-subtle2)", textAlign:"center", fontSize:13, fontWeight:800, color:"var(--text-primary)" }}>{fmt(weekTotal(s.id))}</td>
                <td style={{ borderLeft:"1.5px solid var(--border)", background:"#F0FDF4", textAlign:"center", fontSize:13, fontWeight:800, color:"#065F46", display: showCost ? "table-cell" : "none" }}>${weekCost(s.id).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background:"var(--bg-subtle)", borderTop:"2px solid var(--border-strong)" }}>
              <td style={{ padding:"10px 16px", fontSize:12, fontWeight:800, color:"var(--text-primary)", textTransform:"uppercase", letterSpacing:0.5 }}>Team Total</td>
              {weekDays.map(({date, weekend}) => (
                <td key={date} style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"var(--text-secondary)", borderLeft:"1.5px solid var(--border)", background:weekend?"var(--bg-page)":"transparent" }}>
                  {fmt(staff.reduce((s,st)=>s+dayTotal(st.id,date),0))}
                </td>
              ))}
              <td style={{ textAlign:"center", fontSize:13, fontWeight:900, color:"var(--text-primary)", background:"var(--bg-subtle2)", borderLeft:"1.5px solid var(--border)" }}>{fmt(grandHours())}</td>
              <td style={{ textAlign:"center", fontSize:13, fontWeight:900, color:"#065F46", background:"#F0FDF4", borderLeft:"1.5px solid var(--border)", display: showCost ? "table-cell" : "none" }}>${grandCost().toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ padding:"10px 16px", fontSize:11, color:"var(--text-muted)", borderTop:"1px solid #F1F4F8" }}>Click "+ Add" and enter a start and end time (e.g. 8:00am–12:00pm = 4 hours) — hours are calculated automatically. Click an existing entry to edit it, or × to remove it. Multiple entries per person per day are supported.</div>
      </div>
    </div>
  );
}

// ─── OFFSITE ──────────────────────────────────────────────────────────────────
function OffsiteView({ cols, setCols, data, setData, allocated, setAllocated }) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
  const [editingCol, setEditingCol] = useState(null);
  const [colDraft, setColDraft] = useState({ label: "", type: "number" });

  const monthKey = `${year}-${month}`;
  const days = getMonthDays(year, month);
  const cellKey = (day, cid) => `${monthKey}-${day}-${cid}`;
  const getCell = (day, cid) => data[cellKey(day, cid)] ?? "";
  const setCell = (day, cid, v) => setData(p => ({ ...p, [cellKey(day,cid)]: v }));
  const allocKey = (cid) => `alloc-${monthKey}-${cid}`;
  const getAlloc = (cid) => allocated[allocKey(cid)] ?? "";
  const setAlloc = (cid, v) => setAllocated(p => ({ ...p, [allocKey(cid)]: v }));
  const colTotal = (cid) => { const c = cols.find(c=>c.id===cid); if (c?.type!=="number") return ""; return days.reduce((s,{day}) => s+(parseFloat(getCell(day,cid))||0), 0); };
  const navMonth = (dir) => { let m=month+dir,y=year; if(m<0){m=11;y--;} if(m>11){m=0;y++;} setMonth(m);setYear(y); };
  const saveCol = () => {
    if (!colDraft.label.trim()) return;
    if (editingCol==="new") { if(cols.length>=8) return; setCols(p=>[...p,{id:"c"+Date.now(),label:colDraft.label,type:colDraft.type}]); }
    else { setCols(p=>p.map((c,i)=>i===editingCol?{...c,...colDraft}:c)); }
    setEditingCol(null);
  };
  const handleExport = () => {
    const headers=["Date","Day",...cols.map(c=>c.label)];
    const rows=days.map(({day,dayName})=>[`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,dayName,...cols.map(c=>getCell(day,c.id))]);
    rows.push(["TOTALS","",...cols.map(c=>c.type==="number"?colTotal(c.id):"")]);
    rows.push(["ALLOCATED","",...cols.map(c=>getAlloc(c.id))]);
    rows.push(["REMAINING","",...cols.map(c=>{ if(c.type!=="number")return""; return(parseFloat(getAlloc(c.id))||0)-colTotal(c.id); })]);
    exportCSV(`offsite-${MONTH_NAMES[month]}-${year}.csv`,headers,rows);
  };
  const th={padding:"9px 6px",fontSize:11,fontWeight:700,color:"var(--text-secondary)",background:"var(--bg-subtle)",borderBottom:"2px solid var(--border)",borderRight:"1px solid var(--border)",textAlign:"center",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:0.4,userSelect:"none"};
    const td = (wk) => ({ padding: 0, borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: wk ? "var(--bg-subtle2)" : "var(--card-bg)", height: 34 });
  const inp={width:"100%",height:"100%",border:"none",background:"transparent",fontSize:12,textAlign:"center",outline:"none",padding:"0 4px",boxSizing:"border-box",color:"var(--text-primary)"};
  const sumTd={padding:"9px 6px",fontSize:12,fontWeight:700,textAlign:"center",borderRight:"1px solid var(--border-strong)",color:"var(--text-primary)"};
  const fmt=(n)=>n===0?"0":n%1===0?String(n):n.toFixed(1);

  // Group columns by trade-role prefix for the summary cards
  const groupCols = (prefix) => cols.filter(c => c.type==="number" && c.label.toLowerCase().startsWith(prefix.toLowerCase()));
  const groupTotal = (prefix) => groupCols(prefix).reduce((s,c) => s + (colTotal(c.id) || 0), 0);
  const groupAlloc = (prefix) => groupCols(prefix).reduce((s,c) => s + (parseFloat(getAlloc(c.id)) || 0), 0);
  const SUMMARY_CARDS = [
    { label: "Fitter Hours", prefix: "fitter" },
    { label: "Super Hours",  prefix: "super"  },
    { label: "TA Hours",     prefix: "ta"     },
    { label: "KMs",          prefix: "kms"    },
  ];

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
        <div><h1 style={{ fontSize:24,fontWeight:900,color:"var(--text-primary)",margin:"0 0 4px" }}>Offsite Tracker</h1><p style={{ color:"var(--text-secondary)",fontSize:14,margin:0 }}>Monthly log of hours, kilometres and costs</p></div>
        <div style={{ display:"flex",gap:10 }}><Btn variant="secondary" onClick={handleExport}>⬇ Export CSV</Btn>{cols.length<8&&<Btn variant="secondary" onClick={()=>{setEditingCol("new");setColDraft({label:"",type:"number"});}}>+ Column</Btn>}</div>
      </div>
      <div style={{ display:"flex",alignItems:"center",gap:12,margin:"16px 0",background:"var(--card-bg)",borderRadius:12,padding:"12px 20px",boxShadow:"0 1px 4px #1C233310",width:"fit-content" }}>
        <button onClick={()=>navMonth(-1)} style={{ border:"1.5px solid var(--border-strong)",background:"var(--card-bg)",borderRadius:7,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:14 }}>←</button>
        <span style={{ fontSize:17,fontWeight:800,color:"var(--text-primary)",minWidth:180,textAlign:"center" }}>{MONTH_NAMES[month]} {year}</span>
        <button onClick={()=>navMonth(1)} style={{ border:"1.5px solid var(--border-strong)",background:"var(--card-bg)",borderRadius:7,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:14 }}>→</button>
        <button onClick={()=>{setMonth(now.getMonth());setYear(now.getFullYear());}} style={{ border:"1.5px solid var(--border-strong)",background:"var(--card-bg)",borderRadius:7,padding:"6px 12px",cursor:"pointer",fontSize:12,color:"var(--text-secondary)" }}>This Month</button>
      </div>
      <div style={{ display:"flex",gap:12,marginBottom:16,flexWrap:"wrap" }}>
        {SUMMARY_CARDS.map(card=>{ const tot=groupTotal(card.prefix),alloc=groupAlloc(card.prefix),rem=alloc-tot; return (<div key={card.label} style={{ background:"var(--card-bg)",borderRadius:10,padding:"12px 18px",boxShadow:"0 1px 4px #1C233310",minWidth:130,borderTop:`3px solid ${rem<0?"#EF4444":ACCENT}` }}><div style={{ fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:0.4 }}>{card.label}</div><div style={{ fontSize:22,fontWeight:900,color:"var(--text-primary)",margin:"4px 0 2px" }}>{fmt(tot)}</div>{alloc>0&&<div style={{ fontSize:11,color:rem<0?"#EF4444":"#10B981",fontWeight:600 }}>{rem<0?"Over by ":"Remaining: "}{fmt(Math.abs(rem))}</div>}</div>); })}
      </div>
      <div style={{ background:"var(--card-bg)",borderRadius:14,boxShadow:"0 1px 6px #1C233315",overflow:"auto" }}>
        <table style={{ borderCollapse:"collapse",width:"100%",minWidth:600,tableLayout:"fixed" }}>
          <colgroup><col style={{ width:44 }}/><col style={{ width:38 }}/>{cols.map((_,i)=><col key={i}/>)}</colgroup>
          <thead><tr>
            <th style={{ ...th,textAlign:"left",paddingLeft:12 }}>Day</th>
            <th style={th}>#</th>
            {cols.map((col,i)=>(
              <th key={col.id} style={{ ...th,cursor:"pointer" }} onClick={()=>{setEditingCol(i);setColDraft({label:col.label,type:col.type});}} title="Click to edit">
                <span style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>{col.label}<span style={{ fontSize:9,color:"#C4CAD4" }}>✎</span></span>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {days.map(({day,dayName,isWeekend})=>(
              <tr key={day} style={{ opacity:isWeekend?0.55:1 }}>
                <td style={{ ...td(isWeekend),paddingLeft:12,fontSize:11,fontWeight:700,color:isWeekend?"#9CA3AF":"#5C6B82",background:isWeekend?"var(--bg-subtle)":"var(--card-bg)" }}>{dayName}</td>
                <td style={{ ...td(isWeekend),fontSize:12,fontWeight:700,color:"#C4CAD4",textAlign:"center" }}>{day}</td>
                    {cols.map(col => (
                        <td key={col.id} style={td(isWeekend)}>
                            <input type={col.type === "number" ? "number" : "text"} value={getCell(day, col.id)} onChange={e => setCell(day, col.id, e.target.value)} style={{ ...inp, color: isWeekend ? "var(--text-muted)" : "var(--text-primary)" }} placeholder={isWeekend ? "—" : ""} min={0} />
                        </td>
                    ))}
              </tr>
            ))}
            <tr style={{ background:"var(--bg-subtle2)",borderTop:"2px solid var(--border-strong)" }}>
              <td colSpan={2} style={{ ...sumTd,textAlign:"left",paddingLeft:12,color:ACCENT_TEXT,fontSize:11,fontWeight:800,textTransform:"uppercase" }}>Monthly Total</td>
              {cols.map(col=><td key={col.id} style={{ ...sumTd,color:ACCENT_TEXT }}>{col.type==="number"?fmt(colTotal(col.id)):""}</td>)}
            </tr>
            <tr style={{ background:"#F0FDF4",borderTop:"2px solid var(--border-strong)" }}>
              <td colSpan={2} style={{ ...sumTd,textAlign:"left",paddingLeft:12,color:"#065F46",fontSize:11,fontWeight:800,textTransform:"uppercase" }}>Allocated</td>
              {cols.map(col=><td key={col.id} style={{ ...sumTd,padding:0,background:"#F0FDF4" }}>{col.type==="number"?<input type="number" value={getAlloc(col.id)} onChange={e=>setAlloc(col.id,e.target.value)} style={{ ...inp,fontWeight:700,color:"#065F46",background:"transparent" }} placeholder="0" min={0}/>:null}</td>)}
            </tr>
            <tr style={{ background:"#FFFBF0",borderTop:"2px solid var(--border-strong)" }}>
              <td colSpan={2} style={{ ...sumTd,textAlign:"left",paddingLeft:12,color:"#92400E",fontSize:11,fontWeight:800,textTransform:"uppercase" }}>Remaining</td>
              {cols.map(col=>{ if(col.type!=="number") return <td key={col.id} style={sumTd}/>; const rem=(parseFloat(getAlloc(col.id))||0)-colTotal(col.id); const over=rem<0; return (<td key={col.id} style={{ ...sumTd,color:over?"#DC2626":"#059669",fontWeight:800 }}>{getAlloc(col.id)!==""?(over?"-":"")+fmt(Math.abs(rem)):""}</td>); })}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:10,fontSize:11,color:"var(--text-muted)" }}>Click a column header to rename or change type. Allocated row is editable.{cols.length<8&&" Use + Column to add more (max 8)."}</div>
      {editingCol!==null&&(
        <Modal title={editingCol==="new"?"Add Column":"Edit Column"} onClose={()=>setEditingCol(null)}>
          <Inp label="Column Name" value={colDraft.label} onChange={e=>setColDraft(p=>({...p,label:e.target.value}))} placeholder="e.g. Fitter T1, KMs" autoFocus/>
          <Sel label="Column Type" value={colDraft.type} onChange={e=>setColDraft(p=>({...p,type:e.target.value}))} options={[{value:"number",label:"Number (summed in totals)"},{value:"text",label:"Text (notes)"}]}/>
          <div style={{ display:"flex",gap:10,justifyContent:"space-between",marginTop:8 }}>
            <div>{editingCol!=="new"&&cols.length>1&&<Btn variant="danger" onClick={()=>{ setCols(p=>p.filter((_,i)=>i!==editingCol)); setEditingCol(null); }}>Delete</Btn>}</div>
            <div style={{ display:"flex",gap:10 }}><Btn variant="secondary" onClick={()=>setEditingCol(null)}>Cancel</Btn><Btn onClick={saveCol}>{editingCol==="new"?"Add Column":"Save"}</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── CONTACTS (Team + Customers as separate pages) ───────────────────────────
function TeamPage({ staff, setStaff, roles }) {
  const [staffModal, setStaffModal] = useState(null); // null | "new" | member
  const [staffDraft, setStaffDraft] = useState({ name:"", roleId:"", color: STAFF_PALETTE[0] });
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const openStaff = (s) => { setStaffModal(s || "new"); setStaffDraft(s ? { name:s.name, roleId:s.roleId||"", color:s.color } : { name:"", roleId: roles[0]?.id || "", color: STAFF_PALETTE[staff.length % STAFF_PALETTE.length] }); setConfirmingDelete(false); };
  const closeModal = () => { setStaffModal(null); setConfirmingDelete(false); };
  const saveStaff = () => {
    if (!staffDraft.name.trim()) return;
    const payload = { ...staffDraft };
    if (staffModal === "new") setStaff(p => [...p, { id: suid(), ...payload }]);
    else setStaff(p => p.map(s => s.id===staffModal.id ? { ...s, ...payload } : s));
    closeModal();
  };
  const confirmDeleteStaff = () => { setStaff(p => p.filter(s => s.id!==staffModal.id)); closeModal(); };

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24,fontWeight:900,color:"var(--text-primary)",margin:"0 0 4px" }}>Team Members</h1>
          <p style={{ color:"var(--text-secondary)",fontSize:14,margin:0 }}>{staff.length} member{staff.length!==1?"s":""}</p>
        </div>
        <Btn onClick={()=>openStaff(null)}>+ Add Member</Btn>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {staff.map(s => {
          const { costRate, chargeOutRate, roleName } = getRoleRates(s.roleId, roles);
          return (
            <div key={s.id} style={{ background:"var(--card-bg)",borderRadius:12,padding:"14px 18px",boxShadow:"0 1px 4px #1C233310",display:"flex",alignItems:"center",gap:14,borderLeft:`4px solid ${s.color}` }}>
              <Avatar name={s.name} color={s.color} size={40}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15,fontWeight:800,color:"var(--text-primary)" }}>{s.name}</div>
                <div style={{ fontSize:12,color:"var(--text-secondary)",marginTop:2 }}>{roleName}</div>
              </div>
              {(costRate > 0 || chargeOutRate > 0) && (
                <div style={{ display:"flex", gap:6 }}>
                  {costRate > 0 && <div style={{ fontSize:11, fontWeight:700, color:"#5C6B82", background:"var(--bg-subtle)", borderRadius:6, padding:"4px 10px" }}>${costRate}/hr cost</div>}
                  {chargeOutRate > 0 && <div style={{ fontSize:11, fontWeight:700, color:ACCENT_TEXT, background:ACCENT_SOFT, borderRadius:6, padding:"4px 10px" }}>${chargeOutRate}/hr charge</div>}
                </div>
              )}
              <div style={{ width:20,height:20,borderRadius:"50%",background:s.color,border:"2px solid var(--border)",marginRight:4 }}/>
              <Btn variant="secondary" style={{ padding:"6px 14px",fontSize:12 }} onClick={()=>openStaff(s)}>Edit</Btn>
            </div>
          );
        })}
        {staff.length===0 && <div style={{ textAlign:"center",color:"var(--text-muted)",padding:30,fontSize:14 }}>No team members yet.</div>}
      </div>

      {staffModal && (
        <Modal title={staffModal==="new"?"Add Team Member":`Edit — ${staffModal.name||""}`} onClose={closeModal}>
          {confirmingDelete ? (
            <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>Remove {staffModal.name}?</div>
              <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>This can't be undone. They'll be removed from the team list but will stay assigned on any existing jobs.</div>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <Btn variant="secondary" onClick={()=>setConfirmingDelete(false)}>Cancel</Btn>
                <Btn variant="danger" onClick={confirmDeleteStaff}>Yes, Remove</Btn>
              </div>
            </div>
          ) : (
            <>
              <Inp label="Full Name" value={staffDraft.name} onChange={e=>setStaffDraft(p=>({...p,name:e.target.value}))} placeholder="e.g. Alex Reid" autoFocus/>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Role</label>
                <select value={staffDraft.roleId} onChange={e=>setStaffDraft(p=>({...p,roleId:e.target.value}))} style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,color:"var(--text-primary)",outline:"none",background:"var(--bg-subtle)",boxSizing:"border-box" }}>
                  <option value="">— No role —</option>
                  {roles.map(r=><option key={r.id} value={r.id}>{r.name} (${r.costRate} cost / ${r.chargeOutRate} charge)</option>)}
                </select>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:6 }}>Cost and charge rates come from the assigned role. Manage roles and their rates under Settings → Company → Roles.</div>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>Colour</label>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  {STAFF_PALETTE.map(c=>(
                    <div key={c} onClick={()=>setStaffDraft(p=>({...p,color:c}))} style={{ width:32,height:32,borderRadius:"50%",background:c,cursor:"pointer",border:staffDraft.color===c?"3px solid #1C2333":"3px solid transparent",transition:"border .1s" }}/>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:16,padding:12,background:"var(--bg-subtle)",borderRadius:8,display:"flex",alignItems:"center",gap:10 }}>
                <Avatar name={staffDraft.name||"?"} color={staffDraft.color} size={36}/>
                <div>
                  <div style={{ fontSize:14,fontWeight:700,color:"var(--text-primary)" }}>{staffDraft.name||"Name preview"}</div>
                  <div style={{ fontSize:12,color:"var(--text-secondary)" }}>{getRoleRates(staffDraft.roleId, roles).roleName}</div>
                </div>
              </div>
              <div style={{ display:"flex",gap:10,justifyContent:"space-between" }}>
                <div>{staffModal!=="new"&&<Btn variant="danger" onClick={()=>setConfirmingDelete(true)}>Remove</Btn>}</div>
                <div style={{ display:"flex",gap:10 }}><Btn variant="secondary" onClick={closeModal}>Cancel</Btn><Btn onClick={saveStaff}>Save</Btn></div>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// Company roles — cost/charge rates live here, not on individual team members.
function RolesPage({ roles, setRoles, staff }) {
  const [roleModal, setRoleModal] = useState(null); // null | "new" | role
  const [roleDraft, setRoleDraft] = useState({ name:"", costRate:"", chargeOutRate:"" });
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const openRole = (r) => { setRoleModal(r || "new"); setRoleDraft(r ? { name:r.name, costRate:r.costRate??"", chargeOutRate:r.chargeOutRate??"" } : { name:"", costRate:"", chargeOutRate:"" }); setConfirmingDelete(false); };
  const closeModal = () => { setRoleModal(null); setConfirmingDelete(false); };
  const saveRole = () => {
    if (!roleDraft.name.trim()) return;
    const payload = { name: roleDraft.name.trim(), costRate: parseFloat(roleDraft.costRate) || 0, chargeOutRate: parseFloat(roleDraft.chargeOutRate) || 0 };
    if (roleModal === "new") setRoles(p => [...p, { id: ruid(), ...payload }]);
    else setRoles(p => p.map(r => r.id===roleModal.id ? { ...r, ...payload } : r));
    closeModal();
  };
  const confirmDeleteRole = () => { setRoles(p => p.filter(r => r.id!==roleModal.id)); closeModal(); };
  const memberCount = (roleId) => staff.filter(s=>s.roleId===roleId).length;

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24,fontWeight:900,color:"var(--text-primary)",margin:"0 0 4px" }}>Roles</h1>
          <p style={{ color:"var(--text-secondary)",fontSize:14,margin:0 }}>{roles.length} role{roles.length!==1?"s":""} · cost and charge rates are set here and apply to everyone assigned that role</p>
        </div>
        <Btn onClick={()=>openRole(null)}>+ Add Role</Btn>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {roles.map(r => (
          <div key={r.id} style={{ background:"var(--card-bg)",borderRadius:12,padding:"14px 18px",boxShadow:"0 1px 4px #1C233310",display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15,fontWeight:800,color:"var(--text-primary)" }}>{r.name}</div>
              <div style={{ fontSize:12,color:"var(--text-muted)",marginTop:2 }}>{memberCount(r.id)} team member{memberCount(r.id)!==1?"s":""}</div>
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:"#5C6B82", background:"var(--bg-subtle)", borderRadius:6, padding:"5px 12px" }}>${r.costRate}/hr cost</div>
            <div style={{ fontSize:12, fontWeight:700, color:ACCENT_TEXT, background:ACCENT_SOFT, borderRadius:6, padding:"5px 12px" }}>${r.chargeOutRate}/hr charge</div>
            <Btn variant="secondary" style={{ padding:"6px 14px",fontSize:12 }} onClick={()=>openRole(r)}>Edit</Btn>
          </div>
        ))}
        {roles.length===0 && <div style={{ textAlign:"center",color:"var(--text-muted)",padding:30,fontSize:14 }}>No roles set up yet.</div>}
      </div>

      {roleModal && (
        <Modal title={roleModal==="new"?"Add Role":`Edit — ${roleModal.name||""}`} onClose={closeModal}>
          {confirmingDelete ? (
            <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>Remove {roleModal.name}?</div>
              <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>{memberCount(roleModal.id)>0 ? `${memberCount(roleModal.id)} team member${memberCount(roleModal.id)!==1?"s":""} currently have this role assigned — their rates will show as $0 until reassigned.` : "This can't be undone."}</div>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <Btn variant="secondary" onClick={()=>setConfirmingDelete(false)}>Cancel</Btn>
                <Btn variant="danger" onClick={confirmDeleteRole}>Yes, Remove</Btn>
              </div>
            </div>
          ) : (
            <>
              <Inp label="Role Name" value={roleDraft.name} onChange={e=>setRoleDraft(p=>({...p,name:e.target.value}))} placeholder="e.g. Senior Engineer" autoFocus/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
                <Inp label="Cost Rate ($/hr)" type="number" min={0} value={roleDraft.costRate} onChange={e=>setRoleDraft(p=>({...p,costRate:e.target.value}))} placeholder="e.g. 55"/>
                <Inp label="Charge Out Rate ($/hr)" type="number" min={0} value={roleDraft.chargeOutRate} onChange={e=>setRoleDraft(p=>({...p,chargeOutRate:e.target.value}))} placeholder="e.g. 95"/>
              </div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:-10, marginBottom:20 }}>Cost rate is what this role costs the company per hour. Charge out rate is what customers are billed per hour — used on job sheets, and future quotes and invoices.</div>
              <div style={{ display:"flex",gap:10,justifyContent:"space-between" }}>
                <div>{roleModal!=="new"&&<Btn variant="danger" onClick={()=>setConfirmingDelete(true)}>Remove</Btn>}</div>
                <div style={{ display:"flex",gap:10 }}><Btn variant="secondary" onClick={closeModal}>Cancel</Btn><Btn onClick={saveRole}>Save</Btn></div>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// Generic contact-entity page (used for both Customers and Suppliers — same shape)
function ContactEntityPage({ title, singular, entities, setEntities, idGen, addLabel, removeNote }) {
  const emptyDraft = { name:"", contactPerson:"", phone:"", email:"", address:"" };
  const [modal, setModal] = useState(null); // null | "new" | entity
  const [draft, setDraft] = useState(emptyDraft);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const open = (c) => { setModal(c || "new"); setDraft(c ? { name:c.name, contactPerson:c.contactPerson||"", phone:c.phone||"", email:c.email||"", address:c.address||"" } : emptyDraft); setConfirmingDelete(false); };
  const closeModal = () => { setModal(null); setConfirmingDelete(false); };
  const save = () => {
    if (!draft.name.trim()) return;
    if (modal === "new") setEntities(p => [...p, { id: idGen(), ...draft }]);
    else setEntities(p => p.map(c => c.id===modal.id ? { ...c, ...draft } : c));
    closeModal();
  };
  const confirmDelete = () => { setEntities(p => p.filter(c => c.id!==modal.id)); closeModal(); };

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24,fontWeight:900,color:"var(--text-primary)",margin:"0 0 4px" }}>{title}</h1>
          <p style={{ color:"var(--text-secondary)",fontSize:14,margin:0 }}>{entities.length} {singular}{entities.length!==1?"s":""}</p>
        </div>
        <Btn onClick={()=>open(null)}>{addLabel}</Btn>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10 }}>
        {entities.map(c => (
          <div key={c.id} style={{ background:"var(--card-bg)",borderRadius:12,padding:"14px 18px",boxShadow:"0 1px 4px #1C233310" }}>
            <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:c.contactPerson||c.phone||c.email?8:0 }}>
              <div style={{ fontSize:14,fontWeight:700,color:"var(--text-primary)" }}>{c.name}</div>
              <Btn variant="secondary" style={{ padding:"5px 12px",fontSize:12 }} onClick={()=>open(c)}>Edit</Btn>
            </div>
            {c.contactPerson && <div style={{ fontSize:12,color:"var(--text-secondary)",marginBottom:2 }}>{c.contactPerson}</div>}
            {c.phone && <div style={{ fontSize:12,color:"var(--text-muted)",marginBottom:2 }}>{c.phone}</div>}
            {c.email && <div style={{ fontSize:12,color:"var(--text-muted)",marginBottom:2 }}>{c.email}</div>}
            {c.address && <div style={{ fontSize:11,color:"#C4CAD4",marginTop:4 }}>{c.address}</div>}
          </div>
        ))}
        {entities.length===0 && <div style={{ color:"var(--text-muted)",fontSize:14,padding:20 }}>No {singular}s yet.</div>}
      </div>

      {modal && (
        <Modal title={modal==="new"?`Add ${singular.charAt(0).toUpperCase()+singular.slice(1)}`:`Edit — ${modal.name||""}`} onClose={closeModal}>
          {confirmingDelete ? (
            <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>Remove {modal.name}?</div>
              <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>{removeNote}</div>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <Btn variant="secondary" onClick={()=>setConfirmingDelete(false)}>Cancel</Btn>
                <Btn variant="danger" onClick={confirmDelete}>Yes, Remove</Btn>
              </div>
            </div>
          ) : (
            <>
              <Inp label="Name" value={draft.name} onChange={e=>setDraft(p=>({...p,name:e.target.value}))} placeholder="Company name" autoFocus/>
              <Inp label="Contact Person" value={draft.contactPerson} onChange={e=>setDraft(p=>({...p,contactPerson:e.target.value}))} placeholder="e.g. Jane Smith"/>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
                <Inp label="Phone" value={draft.phone} onChange={e=>setDraft(p=>({...p,phone:e.target.value}))} placeholder="e.g. 07 3000 0000"/>
                <Inp label="Email" type="email" value={draft.email} onChange={e=>setDraft(p=>({...p,email:e.target.value}))} placeholder="e.g. contact@company.com"/>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Address</label>
                <textarea value={draft.address} onChange={e=>setDraft(p=>({...p,address:e.target.value}))} rows={2} placeholder="Street, suburb, state, postcode" style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,background:"var(--bg-subtle)",boxSizing:"border-box",resize:"vertical",outline:"none" }}/>
              </div>
              <div style={{ display:"flex",gap:10,justifyContent:"space-between" }}>
                <div>{modal!=="new"&&<Btn variant="danger" onClick={()=>setConfirmingDelete(true)}>Remove</Btn>}</div>
                <div style={{ display:"flex",gap:10 }}><Btn variant="secondary" onClick={closeModal}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function CompanyPage({ company, setCompany }) {
  const [draft, setDraft] = useState(company);
  const [saved, setSaved] = useState(false);
  const set = (k,v) => { setDraft(p=>({...p,[k]:v})); setSaved(false); };
  const handleSave = () => { setCompany(draft); setSaved(true); setTimeout(()=>setSaved(false), 2500); };

  return (
    <div>
      <h1 style={{ fontSize:24,fontWeight:900,color:"var(--text-primary)",margin:"0 0 4px" }}>Company Details</h1>
      <p style={{ color:"var(--text-secondary)",fontSize:14,margin:"0 0 20px" }}>Used on purchase orders and future invoices.</p>
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:24, boxShadow:"0 1px 4px #1C233310", maxWidth:520 }}>
        <Inp label="Company Name" value={draft.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Apex Engineering Pty Ltd"/>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Address</label>
          <textarea value={draft.address} onChange={e=>set("address",e.target.value)} rows={2} placeholder="Street, suburb, state, postcode" style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,background:"var(--bg-subtle)",boxSizing:"border-box",resize:"vertical",outline:"none" }}/>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
          <Inp label="Phone" value={draft.phone} onChange={e=>set("phone",e.target.value)} placeholder="e.g. 07 3000 0000"/>
          <Inp label="Email" type="email" value={draft.email} onChange={e=>set("email",e.target.value)} placeholder="e.g. office@company.com"/>
        </div>
        <Inp label="ABN / Tax ID" value={draft.abn} onChange={e=>set("abn",e.target.value)} placeholder="e.g. 45 123 456 789"/>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:6 }}>
          <Btn onClick={handleSave}>Save Company Details</Btn>
          {saved && <span style={{ fontSize:12, fontWeight:700, color:"#10B981" }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

function ContactsView({ customers, setCustomers, suppliers, setSuppliers, company, setCompany }) {
  const [page, setPage] = useState("customers"); // "customers" | "suppliers" | "company"
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, background:"var(--card-bg)", borderRadius: 10, padding: 4, width: "fit-content", boxShadow: "0 1px 4px #1C233310" }}>
        {[["customers","Customers"],["suppliers","Suppliers"],["company","Company"]].map(([val,lbl]) => (
          <button key={val} onClick={() => setPage(val)}
            style={{ padding: "8px 22px", border: "none", borderRadius: 8, background: page===val?ACCENT:"transparent", color: page===val?INK:"#5C6B82", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all .15s" }}>
            {lbl}
          </button>
        ))}
      </div>
      {page === "customers" && <ContactEntityPage title="Customers" singular="customer" entities={customers} setEntities={setCustomers} idGen={cuid} addLabel="+ Add Customer" removeNote="This can't be undone. Existing jobs will keep this customer's name as text." />}
      {page === "suppliers" && <ContactEntityPage title="Suppliers" singular="supplier" entities={suppliers} setEntities={setSuppliers} idGen={supid} addLabel="+ Add Supplier" removeNote="This can't be undone. Existing purchase orders will keep this supplier's name as text." />}
      {page === "company" && <CompanyPage company={company} setCompany={setCompany} />}
    </div>
  );
}

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────
function PurchaseOrderModal({ job, suppliers, purchaseOrders, editingPO, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState(editingPO?.supplierId || "");
  const [reference, setReference] = useState(editingPO?.reference || "");
  const [dateCreated, setDateCreated] = useState(editingPO?.dateCreated || "");
  const [details, setDetails] = useState(editingPO ? editingPO.details :`Work required for ${job.id} — ${job.title}`);
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!supplierId) { setError("Please select a supplier."); return; }
    if (!details.trim()) { setError("Please add details of the work needed."); return; } if (editingPO) { onSave({ ...editingPO, supplierId, reference: reference.trim(), details: details.trim(), dateCreated: dateCreated || editingPO.dateCreated }); return; }
    onSave({
      id: poid(),
      poNumber: nextPONumber(purchaseOrders),
      jobId: job.id,
      supplierId,
      reference: reference.trim(),
      details: details.trim(),
      dateCreated: todayISO(),
      status: "unbilled",
      billedCost: null,
    });
  };

  return (
    <Modal title={`${editingPO ? `Edit ${editingPO.poNumber}` : `New Purchase Order — ${job.id}`}`} onClose={onClose}>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Supplier</label>
        <select value={supplierId} onChange={e=>{ setSupplierId(e.target.value); if(error) setError(""); }} style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,color:"var(--text-primary)",outline:"none",background:"var(--bg-subtle)",boxSizing:"border-box" }}>
          <option value="">— Select supplier —</option>
          {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <Inp label="Reference" value={reference} onChange={e=>setReference(e.target.value)} placeholder="e.g. Retrofit steel supply"/>
      {editingPO && <Inp label="PO Date" type="date" value={dateCreated} onChange={e=>setDateCreated(e.target.value)} />}
      <div style={{ marginBottom:8 }}>
        <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Details of Work / Goods Needed</label>
        <textarea value={details} onChange={e=>{ setDetails(e.target.value); if(error) setError(""); }} rows={4} placeholder="Describe what's being ordered..." style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,background:"var(--bg-subtle)",boxSizing:"border-box",resize:"vertical",outline:"none" }}/>
      </div>
      {error && <div style={{ fontSize:12, color:"#DC2626", marginBottom:14 }}>{error}</div>}
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave}>{editingPO ? "Save Changes" : "Create Purchase Order"}</Btn>
      </div>
    </Modal>
  );
}

// PO billing status: "unbilled" (orange, default/primary) → "billed" (green, has a cost attached)
function POStatusBadge({ po, onClick }) {
  const isBilled = po.status === "billed";
  const color = isBilled ? "#10B981" : "#F59E0B";
  return (
    <button onClick={onClick} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:99, border:"1.5px solid "+color, background:color+"18", color, fontWeight:800, fontSize:11, textTransform:"uppercase", letterSpacing:0.3, cursor:onClick?"pointer":"default" }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:color }} />
      {isBilled ? `Billed · $${po.billedCost?.toFixed(2)}` : "Unbilled"}
    </button>
  );
}

function BillPOModal({ po, onSave, onClose }) {
  const [amount, setAmount] = useState(po.billedCost != null ? String(po.billedCost) : "");
  const [error, setError] = useState("");

  const save = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val < 0) { setError("Enter a valid cost amount."); return; }
    onSave({ ...po, status: "billed", billedCost: val });
  };
  const revert = () => onSave({ ...po, status: "unbilled", billedCost: null });

  return (
    <Modal title={`Mark ${po.poNumber} as Billed`} onClose={onClose}>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Enter the actual invoiced cost for this purchase order. It'll show as Billed (green) and this cost will be included in the job's total costs.</p>
      <Inp label="Billed Cost ($)" type="number" step="0.01" min="0" value={amount} onChange={e=>{ setAmount(e.target.value); if(error) setError(""); }} placeholder="e.g. 1250.00" autoFocus/>
      {error && <div style={{ fontSize:12, color:"#DC2626", marginTop:-10, marginBottom:14 }}>{error}</div>}
      <div style={{ display:"flex", gap:10, justifyContent:"space-between" }}>
        <div>{po.status==="billed" && <Btn variant="danger" onClick={revert}>Revert to Unbilled</Btn>}</div>
        <div style={{ display:"flex", gap:10 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save}>Save</Btn>
        </div>
      </div>
    </Modal>
  );
}

function POPrintView({ po, job, supplier, company, settings, onClose }) {
  const footerNote = (settings?.poFooterNote || "Please reference {PO} on all correspondence and delivery documentation.").replace("{PO}", po.poNumber);
  return (
    <div style={{ position:"fixed", inset:0, background:"#5C6B82", zIndex:3000, overflowY:"auto" }}>
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          html, body { width: 210mm; height: 297mm; }
          body * { visibility: hidden; }
          #po-print-area, #po-print-area * { visibility: visible; }
          #po-print-area {
            position: absolute; top: 0; left: 0;
            width: 210mm; min-height: 297mm; max-width: none;
            margin: 0; box-shadow: none;
            background: #fff !important; color: #1C2333 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print" style={{ position:"sticky", top:0, background:"#1C2333", padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", zIndex:10 }}>
        <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>Purchase Order {po.poNumber}</span>
        <div style={{ display:"flex", gap:10 }}>
                  <Btn onClick={() => window.print()}>🖨 Print</Btn>
                  <Btn variant="secondary" onClick={() => downloadElementAsPDF("po-print-area", `${po.poNumber}.pdf`)}>⬇ Save as PDF</Btn>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </div>
      <div id="po-print-area" style={{ background:"#fff", width:"210mm", minHeight:"297mm", margin:"30px auto", padding:"18mm 16mm", boxSizing:"border-box", boxShadow:"0 4px 24px #00000030", fontFamily:"'Inter',system-ui,sans-serif", color:"#1C2333" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:36, paddingBottom:24, borderBottom:"2px solid #1C2333" }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900 }}>{company.name || "Your Company Name"}</div>
            {company.address && <div style={{ fontSize:12, color:"#5C6B82", marginTop:6, whiteSpace:"pre-line" }}>{company.address}</div>}
            {company.phone && <div style={{ fontSize:12, color:"#5C6B82", marginTop:2 }}>{company.phone}</div>}
            {company.email && <div style={{ fontSize:12, color:"#5C6B82" }}>{company.email}</div>}
            {company.abn && <div style={{ fontSize:12, color:"#5C6B82", marginTop:2 }}>ABN {company.abn}</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:26, fontWeight:900, letterSpacing:1, color:"#1C2333" }}>PURCHASE ORDER</div>
            <div style={{ fontSize:14, fontWeight:700, color:ACCENT_TEXT, marginTop:6 }}>{po.poNumber}</div>
            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>Date: {formatDate(po.dateCreated)}</div>
            <div style={{ fontSize:11, fontWeight:800, marginTop:6, color: po.status==="billed" ? "#065F46" : "#92400E" }}>
              {po.status==="billed" ? `BILLED · $${po.billedCost?.toFixed(2)}` : "UNBILLED"}
            </div>
          </div>
        </div>

        {/* Supplier + Job blocks */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginBottom:32 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Supplier</div>
            <div style={{ fontSize:14, fontWeight:700 }}>{supplier?.name || "—"}</div>
            {supplier?.contactPerson && <div style={{ fontSize:13, color:"#5C6B82", marginTop:3 }}>Attn: {supplier.contactPerson}</div>}
            {supplier?.phone && <div style={{ fontSize:13, color:"#5C6B82", marginTop:3 }}>{supplier.phone}</div>}
            {supplier?.email && <div style={{ fontSize:13, color:"#5C6B82" }}>{supplier.email}</div>}
            {supplier?.address && <div style={{ fontSize:12, color:"#9CA3AF", marginTop:6, whiteSpace:"pre-line" }}>{supplier.address}</div>}
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Job Reference</div>
            <div style={{ fontSize:14, fontWeight:700 }}>{job.id}</div>
            <div style={{ fontSize:13, color:"#5C6B82", marginTop:3 }}>{job.title}</div>
            {po.reference && <div style={{ fontSize:13, color:"#5C6B82", marginTop:3 }}>PO Reference: {po.reference}</div>}
          </div>
        </div>

        {/* Details */}
        <div style={{ marginBottom:settings?.poTerms?24:36 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Details of Work / Goods Ordered</div>
          <div style={{ border:"1px solid #E5EAF0", borderRadius:8, padding:16, fontSize:13, lineHeight:1.6, whiteSpace:"pre-line", minHeight:100 }}>
            {po.details}
          </div>
        </div>

        {/* Standard terms, if configured in Settings */}
        {settings?.poTerms && (
          <div style={{ marginBottom:36 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Terms & Conditions</div>
            <div style={{ fontSize:12, color:"#5C6B82", lineHeight:1.6, whiteSpace:"pre-line" }}>{settings.poTerms}</div>
          </div>
        )}

        {/* Signature */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginTop:56 }}>
          <div>
            <div style={{ borderTop:"1px solid #C4CAD4", paddingTop:8, fontSize:11, color:"#9CA3AF" }}>Authorised by</div>
          </div>
          <div>
            <div style={{ borderTop:"1px solid #C4CAD4", paddingTop:8, fontSize:11, color:"#9CA3AF" }}>Date</div>
          </div>
        </div>

        <div style={{ marginTop:48, paddingTop:16, borderTop:"1px solid #E5EAF0", fontSize:11, color:"#C4CAD4", textAlign:"center" }}>
          {footerNote}
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onClick, disabled }) {
  return (
    <div onClick={disabled?undefined:onClick} style={{ width:34, height:19, borderRadius:99, background:on?ACCENT:"var(--border-strong)", position:"relative", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, transition:"background .15s", flexShrink:0 }}>
      <div style={{ width:13, height:13, borderRadius:"50%", background:on?INK:"#fff", position:"absolute", top:3, left:on?18:3, transition:"left .15s" }} />
    </div>
  );
}

function SettingsSystemPage({ settings, setSettings }) {
  const toggleTab = (id) => setSettings(p => ({ ...p, visibleTabs: { ...p.visibleTabs, [id]: !p.visibleTabs[id] } }));
  const toggleTheme = () => setSettings(p => ({ ...p, theme: p.theme==="dark" ? "light" : "dark" }));
  const TOGGLEABLE_ITEMS = useMemo(() => getOrderedNavItems(settings).filter(item => item.id !== "dashboard"), [settings]);
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const reorderTabs = (from, to) => {
    if (from == null || from === to) return;
    const next = [...TOGGLEABLE_ITEMS];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSettings(p => ({ ...p, tabOrder: next.map(i => i.id) }));
  };

  return (
    <div>
      {/* Appearance */}
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:"18px 24px", boxShadow:"0 1px 4px #1C233310", maxWidth:560, marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>Dark Mode</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{settings.theme==="dark" ? "Currently on" : "Currently off"}</div>
        </div>
        <ToggleSwitch on={settings.theme==="dark"} onClick={toggleTheme} />
      </div>

      {/* Visible tabs */}
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:24, boxShadow:"0 1px 4px #1C233310", maxWidth:560 }}>
        <h2 style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", margin:"0 0 4px" }}>Visible Tabs</h2>
        <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Turn off any pages your team doesn't use, and drag a row by its handle to reorder. Dashboard and Settings always stay first and visible.</p>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {TOGGLEABLE_ITEMS.map((item, i) => (
            <div key={item.id}
              draggable
              onDragStart={(e)=>{ dragIndex.current = i; e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e)=>{ e.preventDefault(); if (dragOverIndex !== i) setDragOverIndex(i); }}
              onDragLeave={()=>setDragOverIndex(prev => prev===i ? null : prev)}
              onDrop={(e)=>{ e.preventDefault(); reorderTabs(dragIndex.current, i); dragIndex.current = null; setDragOverIndex(null); }}
              onDragEnd={()=>{ dragIndex.current = null; setDragOverIndex(null); }}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 8px", borderRadius:6, background: dragOverIndex===i ? "var(--bg-subtle)" : "transparent", border: dragOverIndex===i ? `1.5px dashed ${ACCENT_TEXT}` : "1.5px solid transparent" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:15, color:"var(--text-muted)", cursor:"grab", userSelect:"none", lineHeight:1 }}>⠿</span>
                <span style={{ fontSize:14 }}>{item.icon}</span>{item.label}
              </span>
              <ToggleSwitch on={settings.visibleTabs[item.id] !== false} onClick={()=>toggleTab(item.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function CustomStatusRow({ status, count, onChange, onRemove }) {
  const [label, setLabel] = useState(status.label);
  const commitLabel = () => {
    const v = label.trim();
    if (!v) { setLabel(status.label); return; }
    if (v !== status.label) onChange({ ...status, label: v });
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"var(--bg-subtle)", borderRadius:8 }}>
      <span style={{ width:12, height:12, borderRadius:3, background:status.color, flexShrink:0 }} />
      <input value={label} onChange={e=>setLabel(e.target.value)} onBlur={commitLabel} onKeyDown={e=>{ if (e.key==="Enter") e.target.blur(); }}
        style={{ flex:1, minWidth:0, border:"1.5px solid var(--border)", borderRadius:6, padding:"5px 8px", fontSize:13, fontWeight:600, background:"var(--card-bg)", color:"var(--text-primary)", outline:"none" }} />
      <div style={{ display:"flex", gap:4 }}>
        {CUSTOM_STATUS_COLORS.map(c => (
          <div key={c} onClick={()=>onChange({ ...status, color:c })} style={{ width:16, height:16, borderRadius:"50%", background:c, cursor:"pointer", border: status.color===c ? "2px solid var(--text-primary)" : "2px solid transparent", boxSizing:"border-box" }} />
        ))}
      </div>
      <span style={{ fontSize:11, color:"var(--text-muted)", minWidth:44, textAlign:"right" }}>{count} job{count!==1?"s":""}</span>
      <Btn variant="danger" style={{ padding:"4px 10px", fontSize:12 }} disabled={count>0} title={count>0 ? "Move these jobs to another status first" : "Remove this status"} onClick={onRemove}>×</Btn>
    </div>
  );
}

function CustomStatusesCard({ settings, setSettings, jobs }) {
  const statuses = settings.customStatuses || [];
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(CUSTOM_STATUS_COLORS[0]);
  const [error, setError] = useState("");
  const builtInLabels = ["in progress","not started","on hold","follow up","ready to assemble","completed"];
  const countFor = (id) => (jobs || []).filter(j => j.status === id).length;
  const update = (s) => setSettings(p => ({ ...p, customStatuses: (p.customStatuses || []).map(x => x.id === s.id ? s : x) }));
  const remove = (id) => setSettings(p => ({ ...p, customStatuses: (p.customStatuses || []).filter(x => x.id !== id) }));
  const add = () => {
    const label = newLabel.trim();
    if (!label) { setError("Give the status a name."); return; }
    if ([...builtInLabels, ...statuses.map(s => s.label.toLowerCase())].includes(label.toLowerCase())) { setError("A status with that name already exists."); return; }
    setSettings(p => ({ ...p, customStatuses: [...(p.customStatuses || []), { id: "cs_" + Date.now(), label, color: newColor }] }));
    setNewLabel(""); setError("");
    setNewColor(CUSTOM_STATUS_COLORS[(statuses.length + 1) % CUSTOM_STATUS_COLORS.length]);
  };
  return (
    <div style={{ background:"var(--card-bg)", borderRadius:14, padding:24, boxShadow:"0 1px 4px #1C233310", maxWidth:560, marginBottom:20 }}>
      <h2 style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", margin:"0 0 4px" }}>Custom Statuses</h2>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Add your own statuses (e.g. Ready to Quote, Quoted, Delivered, Invoiced). They sit alongside the built-in ones on the job form, Jobs filter and Dashboard. Click a name to rename it. A status can only be removed once no jobs are using it.</p>
      {statuses.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
          {statuses.map(s => <CustomStatusRow key={s.id} status={s} count={countFor(s.id)} onChange={update} onRemove={()=>remove(s.id)} />)}
        </div>
      )}
      <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Add a status</label>
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <input value={newLabel} onChange={e=>{ setNewLabel(e.target.value); if (error) setError(""); }} onKeyDown={e=>{ if (e.key==="Enter") add(); }} placeholder="e.g. Ready to Quote"
          style={{ flex:1, minWidth:160, border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, background:"var(--bg-subtle)", color:"var(--text-primary)", outline:"none", boxSizing:"border-box" }} />
        <div style={{ display:"flex", gap:4 }}>
          {CUSTOM_STATUS_COLORS.map(c => (
            <div key={c} onClick={()=>setNewColor(c)} style={{ width:18, height:18, borderRadius:"50%", background:c, cursor:"pointer", border: newColor===c ? "2px solid var(--text-primary)" : "2px solid transparent", boxSizing:"border-box" }} />
          ))}
        </div>
        <Btn onClick={add}>Add</Btn>
      </div>
      {error && <div style={{ fontSize:12, color:"#DC2626", marginTop:10 }}>{error}</div>}
    </div>
  );
}
function JobNumberSettingsCard({ settings, setSettings }) {
  const [prefix, setPrefix] = useState(settings.jobNumberPrefix || "");
  const [next, setNext] = useState(settings.jobNextNumber || "");
  const [saved, setSaved] = useState(false);
  const preview = next ? prefix + next : "";
  const save = () => {
    setSettings(p => ({ ...p, jobNumberPrefix: prefix.trim(), jobNextNumber: next.trim() }));
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  return (
    <div style={{ background:"var(--card-bg)", borderRadius:14, padding:24, boxShadow:"0 1px 4px #1C233310", maxWidth:560, marginBottom:20 }}>
      <h2 style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", margin:"0 0 4px" }}>Job Numbering</h2>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>New jobs open with the next number already filled in, and it counts up each time you save one. You can still type over it on any job.</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <Inp label="Prefix" value={prefix} onChange={e=>{ setPrefix(e.target.value); setSaved(false); }} placeholder="e.g. ABC" />
        <Inp label="Next Number" value={next} onChange={e=>{ setNext(e.target.value.replace(/\D/g, "")); setSaved(false); }} placeholder="e.g. 01235" />
      </div>
      <div style={{ fontSize:12, color:"var(--text-secondary)", marginBottom:14 }}>
        Next new job will be: <strong style={{ color:"var(--text-primary)" }}>{preview || "— (not set up, random number used)"}</strong>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <Btn onClick={save}>Save Job Numbering</Btn>
        {saved && <span style={{ fontSize:12, fontWeight:700, color:"#10B981" }}>✓ Saved</span>}
      </div>
    </div>
  );
}
function SettingsJobsPage({ settings, setSettings, jobs, onImport }) {
  const [editingFields, setEditingFields] = useState(false);
  const [importingJobs, setImportingJobs] = useState(false);
  const [editingJobSheet, setEditingJobSheet] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const fieldCount = settings.jobCustomFields?.length || 0;
  const summaryCount = (settings.jobSummaryFields || []).filter(f=>f.enabled!==false).length;

  return (
    <div>
      <JobNumberSettingsCard settings={settings} setSettings={setSettings} />

      <CustomStatusesCard settings={settings} setSettings={setSettings} jobs={jobs} />

      {/* Job summary fields */}
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:"18px 24px", boxShadow:"0 1px 4px #1C233310", maxWidth:560, marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>Job Summary Fields</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{summaryCount} field{summaryCount!==1?"s":""} shown, in order, on each job card on the Jobs page</div>
        </div>
        <Btn variant="secondary" onClick={()=>setEditingSummary(true)}>⚙ Edit Fields</Btn>
      </div>

      {/* Job custom fields */}
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:"18px 24px", boxShadow:"0 1px 4px #1C233310", maxWidth:560, marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>Job Custom Fields</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{fieldCount===0 ? "No custom fields set up" : `${fieldCount} field${fieldCount!==1?"s":""} shown on every job and job sheet`}</div>
        </div>
        <Btn variant="secondary" onClick={()=>setEditingFields(true)}>⚙ Edit Fields</Btn>
      </div>

      {/* Import jobs */}
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:"18px 24px", boxShadow:"0 1px 4px #1C233310", maxWidth:560, marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>Import Jobs</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Bulk-add or update jobs from a CSV file · {jobs.length} job{jobs.length!==1?"s":""} currently</div>
        </div>
        <Btn variant="secondary" onClick={()=>setImportingJobs(true)}>⬆ Import CSV</Btn>
      </div>

      {/* Job sheet template */}
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:"18px 24px", boxShadow:"0 1px 4px #1C233310", maxWidth:560, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>Job Sheet Template</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Customise the footer note and sections shown on printed job sheets</div>
        </div>
        <Btn variant="secondary" onClick={()=>setEditingJobSheet(true)}>⚙ Edit Template</Btn>
      </div>

      {editingSummary && (
        <JobSummaryFieldsModal settings={settings} setSettings={setSettings} onClose={()=>setEditingSummary(false)} />
      )}
      {editingFields && (
        <JobFieldsTemplateModal settings={settings} setSettings={setSettings} onClose={()=>setEditingFields(false)} />
      )}
      {importingJobs && (
        <JobImportModal onImport={onImport} onClose={()=>setImportingJobs(false)} />
      )}
      {editingJobSheet && (
        <JobSheetTemplateModal settings={settings} setSettings={setSettings} onClose={()=>setEditingJobSheet(false)} />
          )}
    </div>
  );
}

function SettingsEmptyPage({ label }) {
  return (
    <div style={{ background:"var(--card-bg)", borderRadius:14, padding:40, boxShadow:"0 1px 4px #1C233310", maxWidth:560, textAlign:"center" }}>
      <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>No {label} settings yet</div>
      <div style={{ fontSize:13, color:"var(--text-muted)" }}>Settings for this section will appear here as they're added.</div>
    </div>
  );
}

function SettingsPurchaseOrdersPage({ settings, setSettings }) {
  const [editingTemplate, setEditingTemplate] = useState(false);

  return (
    <div>
      {/* PO template */}
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:"18px 24px", boxShadow:"0 1px 4px #1C233310", maxWidth:560, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>Purchase Order Template</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Customise the footer note and terms shown on every purchase order PDF</div>
        </div>
        <Btn variant="secondary" onClick={()=>setEditingTemplate(true)}>⚙ Edit Template</Btn>
      </div>

      {editingTemplate && (
        <PurchaseOrderTemplateModal settings={settings} setSettings={setSettings} onClose={()=>setEditingTemplate(false)} />
      )}
    </div>
  );
}

function SettingsCompanyPage({ staff, setStaff, roles, setRoles }) {
  const [subPage, setSubPage] = useState("team"); // "team" | "roles"
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, background:"var(--card-bg)", borderRadius: 10, padding: 4, width: "fit-content", boxShadow: "0 1px 4px #1C233310" }}>
        {[["team","Team"],["roles","Roles"]].map(([val,lbl]) => (
          <button key={val} onClick={() => setSubPage(val)}
            style={{ padding: "8px 22px", border: "none", borderRadius: 8, background: subPage===val?ACCENT:"transparent", color: subPage===val?INK:"#5C6B82", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all .15s" }}>
            {lbl}
          </button>
        ))}
      </div>
      {subPage === "team" && <TeamPage staff={staff} setStaff={setStaff} roles={roles} />}
      {subPage === "roles" && <RolesPage roles={roles} setRoles={setRoles} staff={staff} />}
    </div>
  );
}

function SettingsAssetsPage({ settings, setSettings }) {
  const [editingFields, setEditingFields] = useState(false);
  const fieldCount = (settings.assetSummaryFields || []).filter(f=>f.enabled!==false).length;

  return (
    <div>
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:"18px 24px", boxShadow:"0 1px 4px #1C233310", maxWidth:560, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>Asset Fields</div>
          <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{fieldCount} field{fieldCount!==1?"s":""} shown, in order, as columns on the Asset Register</div>
        </div>
        <Btn variant="secondary" onClick={()=>setEditingFields(true)}>⚙ Edit Fields</Btn>
      </div>

      {editingFields && (
        <AssetSummaryFieldsModal settings={settings} setSettings={setSettings} onClose={()=>setEditingFields(false)} />
      )}
    </div>
  );
}
function SettingsSchedulerPage({ settings, setSettings, staff }) {
    const selected = settings.schedulerStaffIds && settings.schedulerStaffIds.length ? settings.schedulerStaffIds : staff.map(s => s.id);
    const toggle = (id) => {
        setSettings(p => {
            const current = (p.schedulerStaffIds && p.schedulerStaffIds.length) ? p.schedulerStaffIds : staff.map(s => s.id);
            const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            return { ...p, schedulerStaffIds: next };
        });
    };
    const showAll = () => setSettings(p => ({ ...p, schedulerStaffIds: [] }));
    return <StaffVisibilityPicker staff={staff} selectedIds={selected} onToggle={toggle} onShowAll={showAll} />;
}
function SettingsTimesheetsPage({ settings, setSettings, staff }) {
    const dayOptions = [
        { value: 0, label: "Sunday" }, { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" },
        { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" }, { value: 5, label: "Friday" }, { value: 6, label: "Saturday" },
    ];
    const current = settings.weekStartDay ?? 1;
    const selected = settings.timesheetsStaffIds && settings.timesheetsStaffIds.length ? settings.timesheetsStaffIds : staff.map(s => s.id);
    const toggle = (id) => {
        setSettings(p => {
            const cur = (p.timesheetsStaffIds && p.timesheetsStaffIds.length) ? p.timesheetsStaffIds : staff.map(s => s.id);
            const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
            return { ...p, timesheetsStaffIds: next };
        });
    };
    const showAll = () => setSettings(p => ({ ...p, timesheetsStaffIds: [] }));

    return (
        <div>
            <div style={{ background: "var(--card-bg)", borderRadius: 14, padding: "18px 24px", boxShadow: "0 1px 4px #1C233310", maxWidth: 560, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>Start of Week</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Choose which day the weekly grid on the Timesheets page starts from.</div>
                <select value={current} onChange={e => setSettings(p => ({ ...p, weekStartDay: parseInt(e.target.value, 10) }))}
                    style={{ width: "100%", maxWidth: 220, border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "var(--text-primary)", outline: "none", background: "var(--bg-subtle)", boxSizing: "border-box", fontWeight: 600, cursor: "pointer" }}>
                    {dayOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
            </div>
           <div style={{ background: "var(--card-bg)", borderRadius: 14, padding: "18px 24px", boxShadow: "0 1px 4px #1C233310", maxWidth: 560, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>Time Entry Block Size</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Start/end time fields and the quick "+ time" buttons step in blocks of this size. You can still type any time.</div>
                <select value={settings.timeStep || 15} onChange={e => setSettings(p => ({ ...p, timeStep: parseInt(e.target.value, 10) }))}
                    style={{ width: "100%", maxWidth: 220, border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "var(--text-primary)", outline: "none", background: "var(--bg-subtle)", boxSizing: "border-box", fontWeight: 600, cursor: "pointer" }}>
                    {[5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m === 60 ? "1 hour" : `${m} minutes`}</option>)}
                </select>
            </div>
            <div style={{ background: "var(--card-bg)", borderRadius: 14, padding: "18px 24px", boxShadow: "0 1px 4px #1C233310", maxWidth: 560, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>Hide Labour Costs</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Hides cost rates and the Labour Cost column on the Timesheets page.</div>
                </div>
                <ToggleSwitch on={!!settings.hideLabourCosts} onClick={() => setSettings(p => ({ ...p, hideLabourCosts: !p.hideLabourCosts }))} />
            </div>
            <StaffVisibilityPicker staff={staff} selectedIds={selected} onToggle={toggle} onShowAll={showAll} />
        </div>
    );
}
function SettingsDashboardPage({ settings, setSettings, staff }) {
    const selected = settings.dashboardStaffIds && settings.dashboardStaffIds.length ? settings.dashboardStaffIds : staff.map(s => s.id);
    const allSelected = selected.length === staff.length;
    const visibleStatuses = { ...DEFAULT_DASHBOARD_VISIBLE_STATUSES, ...(settings.dashboardVisibleStatuses || {}) };
    const toggleStatus = (key) => {
        setSettings(p => ({ ...p, dashboardVisibleStatuses: { ...visibleStatuses, [key]: !visibleStatuses[key] } }));
    };

    const toggleStaffMember = (id) => {
        setSettings(p => {
            const current = (p.dashboardStaffIds && p.dashboardStaffIds.length) ? p.dashboardStaffIds : staff.map(s => s.id);
            const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
            return { ...p, dashboardStaffIds: next };
        });
    };
    const selectAll = () => setSettings(p => ({ ...p, dashboardStaffIds: [] }));

    return (
        <div>
            <div style={{ background: "var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310", maxWidth: 560 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Workload by Person</h2>
                    {!allSelected && <button onClick={selectAll} style={{ background: "none", border: "none", color: ACCENT_TEXT, fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Show All</button>}
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>Choose which team members appear in the "Workload by Person" section on the Dashboard.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {staff.map(s => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 4px", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                <Avatar name={s.name} color={s.color} size={26} />
                                {s.name}
                            </span>
                            <ToggleSwitch on={selected.includes(s.id)} onClick={() => toggleStaffMember(s.id)} />
                        </div>
                    ))}
                                {staff.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No team members yet.</div>}
          </div>
        </div>

        <div style={{ background:"var(--card-bg)", borderRadius:14, padding:24, boxShadow:"0 1px 4px #1C233310", maxWidth:560, marginTop:20 }}>
          <h2 style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", margin:"0 0 4px" }}>Status Visibility</h2>
          <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Choose which job statuses count toward the Dashboard's totals, breakdown, and workload. This doesn't affect the Jobs page.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 4px", borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{meta.label}</span>
                <ToggleSwitch on={visibleStatuses[key] !== false} onClick={()=>toggleStatus(key)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
function StaffVisibilityPicker({ staff, selectedIds, onToggle, onShowAll }) {
    const selected = selectedIds && selectedIds.length ? selectedIds : staff.map(s => s.id);
    const allSelected = selected.length === staff.length;
    return (
        <div style={{ background: "var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310", maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Visible Team Members</h2>
                {!allSelected && <button onClick={onShowAll} style={{ background: "none", border: "none", color: ACCENT_TEXT, fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Show All</button>}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>Choose which team members appear on this page.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {staff.map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 4px", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            <Avatar name={s.name} color={s.color} size={26} />
                            {s.name}
                        </span>
                        <ToggleSwitch on={selected.includes(s.id)} onClick={() => onToggle(s.id)} />
                    </div>
                ))}
                {staff.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No team members yet.</div>}
            </div>
        </div>
    );
}
function SettingsView({ settings, setSettings, jobs, staff, setStaff, roles, setRoles, onImport, customers, setCustomers, suppliers, setSuppliers, company, setCompany }) {
  const [page, setPage] = useState("system");

  const SETTINGS_TABS = [
      ["system", "System"],
      ["dashboard", "Dashboard"],
    ["jobs","Jobs"],
    ["schedule","Scheduler"],
    ["timesheets","Timesheets"],
    ["purchaseorders","Purchase Orders"],
    ["quotes","Quotes"],
    ["invoices","Invoices"],
    ["bills","Bills"],
    ["offsite","Offsite"],
    ["assets","Assets"],
    ["contacts","Contacts"],
      ["company", "Company"],
      ["mobilenav", "Mobile Nav"],
  ];

  return (
    <div>
      <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>Settings</h1>
      <p style={{ color:"var(--text-secondary)", fontSize:14, margin:"0 0 20px" }}>Customise the app to fit how your team works.</p>

          <div className="settings-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:2, background:"var(--card-bg)", borderRadius:12, padding:8, width:190, flexShrink:0, boxShadow:"0 1px 4px #1C233310" }}>
          {SETTINGS_TABS.map(([val,lbl]) => (
            <button key={val} onClick={() => setPage(val)}
              style={{ padding: "10px 14px", border: "none", borderRadius: 8, background: page===val?ACCENT:"transparent", color: page===val?INK:"var(--text-secondary)", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all .15s", textAlign:"left", width:"100%" }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
                  {page === "system" && <SettingsSystemPage settings={settings} setSettings={setSettings} />}
                  {page === "dashboard" && <SettingsDashboardPage settings={settings} setSettings={setSettings} staff={staff} />}
          {page === "jobs" && <SettingsJobsPage settings={settings} setSettings={setSettings} jobs={jobs} onImport={onImport} />}
                  {page === "schedule" && <SettingsSchedulerPage settings={settings} setSettings={setSettings} staff={staff} />}
                  {page === "timesheets" && <SettingsTimesheetsPage settings={settings} setSettings={setSettings} staff={staff} />}
          {page === "purchaseorders" && <SettingsPurchaseOrdersPage settings={settings} setSettings={setSettings} />}
          {page === "quotes" && <SettingsQuotesPage settings={settings} setSettings={setSettings} />}
          {page === "invoices" && <SettingsInvoicesPage settings={settings} setSettings={setSettings} />}
          {page === "bills" && <SettingsEmptyPage label="Bills" />}
          {page === "offsite" && <SettingsEmptyPage label="Offsite" />}
          {page === "assets" && <SettingsAssetsPage settings={settings} setSettings={setSettings} />}
                    {page === "contacts" && <ContactsView customers={customers} setCustomers={setCustomers} suppliers={suppliers} setSuppliers={setSuppliers} company={company} setCompany={setCompany} />}
          {page === "company" && <SettingsCompanyPage staff={staff} setStaff={setStaff} roles={roles} setRoles={setRoles} />}
                  {page === "mobilenav" && <SettingsMobileNavPage settings={settings} setSettings={setSettings} />}
              </div>
      </div>
    </div>
  );
}

// ─── PURCHASE ORDERS (top-level tab) ──────────────────────────────────────────
function JobPickerModal({ jobs, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const filtered = jobs.filter(j => !search || j.id.toLowerCase().includes(search.toLowerCase()) || j.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal title="Select a Job" onClose={onClose}>
      <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search job number or description..." style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:14, background:"var(--bg-subtle)", color:"var(--text-primary)" }} />
      <div style={{ maxHeight:320, overflowY:"auto" }}>
        {filtered.length===0 && <div style={{ padding:"14px 4px", fontSize:13, color:"var(--text-muted)" }}>No jobs match.</div>}
        {filtered.map(j => {
          const sm = STATUS_META[j.status] || { color:"#9CA3AF" };
          return (
            <div key={j.id} onClick={()=>onSelect(j)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, cursor:"pointer" }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--bg-subtle)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{ width:10, height:10, borderRadius:3, background:sm.color, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:ACCENT_TEXT }}>{j.id}</div>
                <div style={{ fontSize:12, color:"var(--text-secondary)" }}>{j.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function PurchaseOrderTemplateModal({ settings, setSettings, onClose }) {
  const [draft, setDraft] = useState({ poFooterNote: settings.poFooterNote, poTerms: settings.poTerms });
  const save = () => { setSettings(p => ({ ...p, ...draft })); onClose(); };
  return (
    <Modal title="Purchase Order Template" onClose={onClose}>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Customise the standard footer note and terms shown on every purchase order PDF. Use <code>{"{PO}"}</code> in the footer to insert the PO number.</p>
      <div style={{ marginBottom:14 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Footer Note</label>
        <input value={draft.poFooterNote} onChange={e=>setDraft(p=>({...p, poFooterNote:e.target.value}))} placeholder="e.g. Please reference {PO} on all correspondence." style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, background:"var(--bg-subtle)", boxSizing:"border-box", outline:"none", color:"var(--text-primary)" }} />
      </div>
      <div style={{ marginBottom:20 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Standard Terms & Conditions (optional)</label>
        <textarea value={draft.poTerms} onChange={e=>setDraft(p=>({...p, poTerms:e.target.value}))} rows={4} placeholder="e.g. Payment due 30 days from invoice. Goods remain property of supplier until paid in full." style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, background:"var(--bg-subtle)", boxSizing:"border-box", resize:"vertical", outline:"none", color:"var(--text-primary)" }} />
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save Template</Btn>
      </div>
    </Modal>
  );
}

function JobSheetTemplateModal({ settings, setSettings, onClose }) {
  const [footerNote, setFooterNote] = useState(settings.jobSheetFooterNote);
  const [fields, setFields] = useState({ ...settings.jobSheetFields });
  const toggleField = (key) => setFields(p => ({ ...p, [key]: !p[key] }));
  const save = () => { setSettings(p => ({ ...p, jobSheetFooterNote: footerNote, jobSheetFields: fields })); onClose(); };

  return (
    <Modal title="Job Sheet Template" onClose={onClose}>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Choose exactly what appears on every printed job sheet. Job number and company header always show.</p>
      <div style={{ marginBottom:20 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Footer Note</label>
        <input value={footerNote} onChange={e=>setFooterNote(e.target.value)} placeholder="e.g. Job sheet generated {DATE} — {JOB}" style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, background:"var(--bg-subtle)", boxSizing:"border-box", outline:"none", color:"var(--text-primary)" }} />
        <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:5 }}>Use <code>{"{JOB}"}</code> for the job number and <code>{"{DATE}"}</code> for today's date.</div>
      </div>
      <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Included Information</label>
      <div style={{ display:"flex", flexDirection:"column", marginBottom:20 }}>
        {JOB_SHEET_FIELD_LABELS.map(({ key, label }) => (
          <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 4px", borderBottom:"1px solid var(--border)" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{label}</span>
            <ToggleSwitch on={fields[key] !== false} onClick={()=>toggleField(key)} />
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Save Template</Btn>
      </div>
    </Modal>
  );
}

// ─── COMING SOON (Quotes, Invoices, Bills — placeholders for future features) ──
// ─── ASSET REGISTER ────────────────────────────────────────────────────────────
function AssetGroupsModal({ groups, setGroups, assets, onClose }) {
  const [editing, setEditing] = useState(null); // null | "new" | group
  const [draft, setDraft] = useState({ name:"", color: ASSET_GROUP_COLORS[0] });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const memberCount = (groupId) => assets.filter(a=>a.groupId===groupId).length;

  const openEdit = (g) => { setEditing(g || "new"); setDraft(g ? { name:g.name, color:g.color } : { name:"", color: ASSET_GROUP_COLORS[groups.length % ASSET_GROUP_COLORS.length] }); setConfirmingDelete(false); };
  const save = () => {
    if (!draft.name.trim()) return;
    if (editing === "new") setGroups(p => [...p, { id: agid(), name:draft.name.trim(), color:draft.color }]);
    else setGroups(p => p.map(g => g.id===editing.id ? { ...g, name:draft.name.trim(), color:draft.color } : g));
    setEditing(null);
  };
  const confirmDelete = () => { setGroups(p => p.filter(g=>g.id!==editing.id)); setEditing(null); };

  return (
    <Modal title="Asset Groups" onClose={onClose}>
      {editing ? (
        confirmingDelete ? (
          <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>Remove {editing.name}?</div>
            <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>{memberCount(editing.id)>0 ? `${memberCount(editing.id)} asset${memberCount(editing.id)!==1?"s":""} are in this group — they'll be left ungrouped.` : "This can't be undone."}</div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={()=>setConfirmingDelete(false)}>Cancel</Btn>
              <Btn variant="danger" onClick={confirmDelete}>Yes, Remove</Btn>
            </div>
          </div>
        ) : (
          <>
            <Inp label="Group Name" value={draft.name} onChange={e=>setDraft(p=>({...p,name:e.target.value}))} placeholder="e.g. Vehicles" autoFocus/>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>Colour</label>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {ASSET_GROUP_COLORS.map(c=>(
                  <div key={c} onClick={()=>setDraft(p=>({...p,color:c}))} style={{ width:32,height:32,borderRadius:"50%",background:c,cursor:"pointer",border:draft.color===c?"3px solid #1C2333":"3px solid transparent",transition:"border .1s" }}/>
                ))}
              </div>
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"space-between" }}>
              <div>{editing!=="new"&&<Btn variant="danger" onClick={()=>setConfirmingDelete(true)}>Remove</Btn>}</div>
              <div style={{ display:"flex",gap:10 }}><Btn variant="secondary" onClick={()=>setEditing(null)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
            </div>
          </>
        )
      ) : (
        <>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            {groups.map(g => (
              <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"var(--bg-subtle)", borderRadius:8 }}>
                <span style={{ width:12, height:12, borderRadius:"50%", background:g.color, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>{g.name}</span>
                <span style={{ fontSize:11, color:"var(--text-muted)" }}>{memberCount(g.id)} asset{memberCount(g.id)!==1?"s":""}</span>
                <Btn variant="secondary" style={{ padding:"4px 12px", fontSize:12 }} onClick={()=>openEdit(g)}>Edit</Btn>
              </div>
            ))}
            {groups.length===0 && <div style={{ fontSize:12, color:"var(--text-muted)" }}>No groups yet.</div>}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <Btn variant="secondary" onClick={()=>openEdit(null)}>+ Add Group</Btn>
            <Btn onClick={onClose}>Done</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

function AssetModal({ asset, groups, staff, onSave, onDelete, onClose }) {
  const isNew = !asset;
  const [form, setForm] = useState(asset || { id:auid(), name:"", groupId: groups[0]?.id || "", make:"", model:"", identifier:"", purchaseDate:"", purchasePrice:"", status:"active", location:"", assignedTo:"", nextServiceDate:"", notes:"" });
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = () => {
    if (!form.name.trim()) { setError("Asset name is required."); return; }
    onSave({ ...form, purchasePrice: parseFloat(form.purchasePrice) || 0 });
  };

  return (
    <Modal title={isNew ? "Add Asset" : `Edit — ${asset.name}`} onClose={onClose}>
      {confirmingDelete ? (
        <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>Remove {asset.name}?</div>
          <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>This can't be undone.</div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={()=>setConfirmingDelete(false)}>Cancel</Btn>
            <Btn variant="danger" onClick={()=>onDelete(asset.id)}>Yes, Remove</Btn>
          </div>
        </div>
      ) : (
        <>
          <Inp label="Asset Name" value={form.name} onChange={e=>{ set("name",e.target.value); if(error) setError(""); }} placeholder="e.g. Site Ute 1 — Hilux" autoFocus/>
          {error && <div style={{ fontSize:12, color:"#DC2626", marginTop:-10, marginBottom:14 }}>{error}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Group</label>
              <select value={form.groupId} onChange={e=>set("groupId",e.target.value)} style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,color:"var(--text-primary)",outline:"none",background:"var(--bg-subtle)",boxSizing:"border-box" }}>
                <option value="">— No group —</option>
                {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <Sel label="Status" value={form.status} onChange={e=>set("status",e.target.value)} options={Object.entries(ASSET_STATUS_META).map(([value,m])=>({value,label:m.label}))}/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Inp label="Make" value={form.make} onChange={e=>set("make",e.target.value)} placeholder="e.g. Toyota"/>
            <Inp label="Model" value={form.model} onChange={e=>set("model",e.target.value)} placeholder="e.g. Hilux SR5"/>
          </div>
          <Inp label="Serial No / Registration" value={form.identifier} onChange={e=>set("identifier",e.target.value)} placeholder="e.g. 123-ABC or SN-88213"/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Inp label="Purchase Date" type="date" value={form.purchaseDate} onChange={e=>set("purchaseDate",e.target.value)}/>
            <Inp label="Purchase Price ($)" type="number" min={0} step="0.01" value={form.purchasePrice} onChange={e=>set("purchasePrice",e.target.value)} placeholder="e.g. 52000"/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Inp label="Location" value={form.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Yatala Workshop"/>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Assigned To</label>
              <select value={form.assignedTo||""} onChange={e=>set("assignedTo",e.target.value)} style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,color:"var(--text-primary)",outline:"none",background:"var(--bg-subtle)",boxSizing:"border-box" }}>
                <option value="">— Unassigned —</option>
                {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <Inp label="Next Service / Inspection Date" type="date" value={form.nextServiceDate||""} onChange={e=>set("nextServiceDate",e.target.value)}/>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Notes</label>
            <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} placeholder="Any additional notes..." style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,background:"var(--bg-subtle)",boxSizing:"border-box",resize:"vertical",outline:"none" }}/>
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"space-between" }}>
            <div>{!isNew&&<Btn variant="danger" onClick={()=>setConfirmingDelete(true)}>Remove</Btn>}</div>
            <div style={{ display:"flex",gap:10 }}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={handleSave}>Save Asset</Btn></div>
          </div>
        </>
      )}
    </Modal>
  );
}

function AssetsView({ assets, setAssets, groups, setGroups, staff, settings, setSettings }) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingAsset, setEditingAsset] = useState(null); // null | "new" | asset
  const [managingGroups, setManagingGroups] = useState(false);
  const dragRef = useRef(null);
  const [, forceTick] = useState(0);

  const todayStr = todayISO();
  const filtered = assets.filter(a => {
    const mg = groupFilter==="all" || a.groupId===groupFilter;
    const ms = statusFilter==="all" || a.status===statusFilter;
    const q = search.toLowerCase();
    const mt = !search || a.name.toLowerCase().includes(q) || (a.make||"").toLowerCase().includes(q) || (a.model||"").toLowerCase().includes(q) || (a.identifier||"").toLowerCase().includes(q) || (a.location||"").toLowerCase().includes(q);
    return mg && ms && mt;
  });

  const totalValue = assets.reduce((s,a)=>s+(a.purchasePrice||0),0);
  const inMaintenance = assets.filter(a=>a.status==="maintenance").length;
  const serviceOverdue = assets.filter(a=>a.nextServiceDate && a.nextServiceDate < todayStr).length;

  const saveAsset = (a) => { setAssets(prev => { const idx=prev.findIndex(x=>x.id===a.id); if(idx>=0){const n=[...prev];n[idx]={...a,createdAt:prev[idx].createdAt};return n;} return [{...a, createdAt:todayISO()},...prev]; }); setEditingAsset(null); };
  const deleteAsset = (id) => { setAssets(prev => prev.filter(a=>a.id!==id)); setEditingAsset(null); };

  const handleExport = () => {
    const headers = ["Asset Name","Group","Make","Model","Serial/Rego","Purchase Date","Purchase Price","Status","Location","Assigned To","Next Service Date","Notes"];
    const rows = assets.map(a => [a.name, groups.find(g=>g.id===a.groupId)?.name||"", a.make||"", a.model||"", a.identifier||"", a.purchaseDate||"", (a.purchasePrice||0).toFixed(2), ASSET_STATUS_META[a.status]?.label||a.status, a.location||"", staff.find(s=>s.id===a.assignedTo)?.name||"", a.nextServiceDate||"", a.notes||""]);
    exportCSV(`asset-register-${todayStr}.csv`, headers, rows);
  };

  // Group the filtered assets by their group so similar assets sit together
  const sections = groups
    .map(g => ({ group: g, items: filtered.filter(a=>a.groupId===g.id) }))
    .filter(sec => sec.items.length > 0);
  const ungrouped = filtered.filter(a => !groups.some(g=>g.id===a.groupId));
  if (ungrouped.length) sections.push({ group: { id:"none", name:"Ungrouped", color:"#9CA3AF" }, items: ungrouped });

  const summaryFields = useMemo(() => (settings?.assetSummaryFields || []).filter(f => f.enabled !== false), [settings]);

  // ── Column resizing (same locked-width pattern as the Jobs table) ──────────
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      dragRef.current.currentWidth = Math.max(60, dragRef.current.startWidth + delta);
      forceTick(t => t + 1);
    };
    const onUp = () => {
      if (dragRef.current) {
        const { key, currentWidth } = dragRef.current;
        setSettings(p => ({ ...p, assetSummaryFields: (p.assetSummaryFields||[]).map(f => f.key === key ? { ...f, width: currentWidth } : f) }));
        dragRef.current = null;
        forceTick(t => t + 1);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [setSettings]);
  const startResize = (e, key, currentWidth) => {
    e.stopPropagation(); e.preventDefault();
    dragRef.current = { key, startX: e.clientX, startWidth: currentWidth, currentWidth };
    forceTick(t => t + 1);
  };
  const colWidth = (f) => (dragRef.current && dragRef.current.key === f.key) ? dragRef.current.currentWidth : (f.width || 130);

  const ellipsis = { display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" };
  const renderCell = (key, a) => {
    switch (key) {
      case "name":
        return <span style={{ ...ellipsis, fontWeight:700, color:"var(--text-primary)", fontSize:14 }}>{a.name}</span>;
      case "group": {
        const g = groups.find(g=>g.id===a.groupId);
        return g ? <span style={{ ...ellipsis, display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--text-secondary)" }}><span style={{ width:8, height:8, borderRadius:"50%", background:g.color, flexShrink:0 }}/>{g.name}</span> : <span style={{ fontSize:12, color:"var(--text-muted)" }}>—</span>;
      }
      case "make":
        return <span style={{ ...ellipsis, fontSize:12, color:"var(--text-secondary)" }}>{a.make || "—"}</span>;
      case "model":
        return <span style={{ ...ellipsis, fontSize:12, color:"var(--text-secondary)" }}>{a.model || "—"}</span>;
      case "identifier":
        return <span style={{ ...ellipsis, fontSize:12, color:"var(--text-secondary)" }}>{a.identifier || "—"}</span>;
      case "location":
        return <span style={{ ...ellipsis, fontSize:12, color:"var(--text-secondary)" }}>{a.location || "—"}</span>;
      case "assignedStaff": {
        const s = staff.find(s=>s.id===a.assignedTo);
        return s ? <Avatar name={s.name} color={s.color} size={22}/> : <span style={{ fontSize:12, color:"var(--border-strong)" }}>—</span>;
      }
      case "nextServiceDate": {
        if (!a.nextServiceDate) return <span style={{ fontSize:12, color:"var(--text-muted)" }}>—</span>;
        const overdue = a.nextServiceDate < todayStr;
        const dueSoon = !overdue && daysDiff(todayStr, a.nextServiceDate) <= 14;
        return <span style={{ ...ellipsis, fontSize:12, fontWeight:700, color: overdue?"#EF4444":dueSoon?"#F59E0B":"var(--text-secondary)" }}>{formatDate(a.nextServiceDate)}{overdue?" (overdue)":dueSoon?" (soon)":""}</span>;
      }
      case "purchasePrice":
        return <span style={{ ...ellipsis, fontWeight:700, color:"var(--text-primary)", fontSize:13 }}>${(a.purchasePrice||0).toLocaleString()}</span>;
      case "status": {
        const sm = ASSET_STATUS_META[a.status] || { label:a.status, color:"#9CA3AF" };
        return <Badge color={sm.color}>{sm.label}</Badge>;
      }
      default:
        return null;
    }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>Asset Register</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:14, margin:0 }}>{assets.length} asset{assets.length!==1?"s":""} across {groups.length} group{groups.length!==1?"s":""}</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <Btn variant="secondary" onClick={()=>setManagingGroups(true)}>⚙ Manage Groups</Btn>
          <Btn variant="secondary" onClick={handleExport}>⬇ Export CSV</Btn>
          <Btn onClick={()=>setEditingAsset("new")}>+ Add Asset</Btn>
        </div>
      </div>

      <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:20 }}>
        <StatCard label="Total Assets" value={assets.length} sub="In the register" accent={ACCENT}/>
        <StatCard label="Total Value" value={`$${totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}`} sub="Combined purchase price" accent="#6366F1"/>
        <StatCard label="In Maintenance" value={inMaintenance} sub="Currently out for service" accent="#F59E0B"/>
        <StatCard label="Service Overdue" value={serviceOverdue} sub="Past next service date" accent="#EF4444"/>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets, make, model, serial no..." style={{ flex:1, minWidth:200, border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 14px", fontSize:14, outline:"none", background:"var(--card-bg)", color:"var(--text-primary)" }}/>
        <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid var(--border-strong)", background:"var(--card-bg)", color:"var(--text-primary)", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          <option value="all">All Groups</option>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid var(--border-strong)", background:"var(--card-bg)", color:"var(--text-primary)", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          <option value="all">All Statuses</option>
          {Object.entries(ASSET_STATUS_META).map(([value,m])=><option key={value} value={value}>{m.label}</option>)}
        </select>
      </div>

      <div style={{ background:"var(--card-bg)", borderRadius:12, boxShadow:"0 1px 4px #1C233310", overflow:"auto" }}>
        <table style={{ borderCollapse:"collapse", width:"100%", tableLayout:"fixed" }}>
          <colgroup>
            {summaryFields.map(f => <col key={f.key} style={{ width: colWidth(f) }} />)}
          </colgroup>
          <thead>
            <tr>
              {summaryFields.map(f => (
                <th key={f.key} style={{ position:"relative", padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0.4, background:"var(--bg-subtle)", borderBottom:"2px solid var(--border)", userSelect:"none" }}>
                  <span style={ellipsis}>{f.label}</span>
                  <div onMouseDown={e=>startResize(e, f.key, colWidth(f))}
                    style={{ position:"absolute", right:0, top:0, bottom:0, width:8, cursor:"col-resize" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--border-strong)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.length===0 && (
              <tr><td colSpan={summaryFields.length} style={{ textAlign:"center", color:"var(--text-muted)", padding:40, fontSize:14 }}>No assets found.</td></tr>
            )}
            {sections.map(({ group, items }) => (
              <Fragment key={group.id}>
                <tr>
                  <td colSpan={summaryFields.length} style={{ padding:"10px 14px", background:"var(--bg-subtle2)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:10, height:10, borderRadius:"50%", background:group.color }}/>
                      <span style={{ fontSize:12, fontWeight:800, color:"var(--text-primary)", textTransform:"uppercase", letterSpacing:0.5 }}>{group.name}</span>
                      <span style={{ fontSize:11, color:"var(--text-muted)" }}>({items.length})</span>
                    </div>
                  </td>
                </tr>
                {items.map(a => (
                  <tr key={a.id} onClick={()=>setEditingAsset(a)} style={{ cursor:"pointer", borderBottom:"1px solid var(--border)" }}
                    onMouseEnter={e => e.currentTarget.style.background="var(--bg-subtle)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    {summaryFields.map((f,i) => (
                      <td key={f.key} style={{ padding:"10px 14px", overflow:"hidden", borderLeft: i===0 ? `4px solid ${group.color}` : "none", verticalAlign:"middle" }}>
                        {renderCell(f.key, a)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {editingAsset && (
        <AssetModal asset={editingAsset==="new"?null:editingAsset} groups={groups} staff={staff} onSave={saveAsset} onDelete={deleteAsset} onClose={()=>setEditingAsset(null)}/>
      )}
      {managingGroups && (
        <AssetGroupsModal groups={groups} setGroups={setGroups} assets={assets} onClose={()=>setManagingGroups(false)}/>
      )}
    </div>
  );
}

// ─── BILLS (supplier invoices you owe) ────────────────────────────────────────
const BILL_BUCKET = "bill-files";
function bid() { return "bill" + Date.now() + Math.floor(Math.random() * 1000); }
function fmtMoney(n) { return "$" + (Number(n) || 0).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtSize(b) { if (!b) return ""; return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1048576).toFixed(1) + " MB"; }
function isBillOverdue(b) { return b.status !== "paid" && !!b.dueDate && b.dueDate < todayISO(); }

async function uploadBillFiles(billId, files) {
  const out = [];
  for (const f of files) {
    const safe = f.name.replace(/[^\w.\-]+/g, "_");
    const path = `${billId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(BILL_BUCKET).upload(path, f, { contentType: f.type || undefined });
    if (error) throw error;
    out.push({ path, name: f.name, size: f.size, type: f.type });
  }
  return out;
}
async function openBillFile(att) {
  const w = window.open("about:blank", "_blank");
  const { data, error } = await supabase.storage.from(BILL_BUCKET).createSignedUrl(att.path, 300);
  if (error || !data?.signedUrl) { if (w) w.close(); alert("Couldn't open that file: " + (error?.message || "unknown error")); return; }
  if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}

function BillModal({ bill, prefill, suppliers, jobs, purchaseOrders, onSave, onClose }) {
  const src = bill || prefill || {};
  const [supplierId, setSupplierId] = useState(src.supplierId || "");
  const [supplierName, setSupplierName] = useState(src.supplierName || "");
  const [invoiceNumber, setInvoiceNumber] = useState(src.invoiceNumber || "");
  const [invoiceDate, setInvoiceDate] = useState(src.invoiceDate || todayISO());
  const [dueDate, setDueDate] = useState(src.dueDate || computeDueDate(src.invoiceDate || todayISO(), { invoiceDueMode: "monthday", invoiceDueValue: 20 }));
  const [dueTouched, setDueTouched] = useState(!!bill);
  const [amount, setAmount] = useState(src.amount != null && src.amount !== "" ? String(src.amount) : "");
  const [jobId, setJobId] = useState(src.jobId || "");
  const [notes, setNotes] = useState(src.notes || "");
  const [attachments, setAttachments] = useState(bill?.attachments || []);
  const [removedPaths, setRemovedPaths] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const linkedPO = (purchaseOrders || []).find(p => p.id === src.poId);
  const linkedCost = src.costId ? (jobs || []).flatMap(j => j.jobCosts || []).find(c => c.id === src.costId) : null;

  const save = async () => {
    if (!supplierId && !supplierName.trim()) { setError("Choose a supplier or type a supplier name."); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError("Enter the bill amount."); return; }
    const jid = jobId.trim();
    if (jid && !jobs.some(j => j.id === jid)) { setError("That job number wasn't found. Pick one from the list, or leave it blank."); return; }
    setSaving(true); setError("");
    const id = bill?.id || bid();
    try {
      const uploaded = newFiles.length ? await uploadBillFiles(id, newFiles) : [];
      if (removedPaths.length) await supabase.storage.from(BILL_BUCKET).remove(removedPaths);
      onSave({
        id, supplierId: supplierId || null, supplierName: supplierId ? "" : supplierName.trim(),
        invoiceNumber: invoiceNumber.trim(), invoiceDate: invoiceDate || null, dueDate: dueDate || null,
        amount: amt, jobId: jid || null, poId: src.poId || null, costId: src.costId || null,
        status: bill?.status || "unpaid", paidDate: bill?.paidDate || null, notes: notes.trim(),
        attachments: [...attachments, ...uploaded],
      });
    } catch (err) {
      setError("Couldn't save: " + (err.message || err));
      setSaving(false);
    }
  };

  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 };
  return (
    <Modal title={bill ? "Edit Bill" : "New Bill"} onClose={onClose} wide>
      {(linkedPO || linkedCost) && (
        <div style={{ background: "var(--bg-subtle)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "var(--text-secondary)" }}>
          {linkedPO && <div>Linked to purchase order <b>{linkedPO.poNumber}</b></div>}
          {linkedCost && <div>Linked to additional cost <b>{linkedCost.label}</b></div>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Sel label="Supplier" value={supplierId} onChange={e => { setSupplierId(e.target.value); setError(""); }}
          options={[{ value: "", label: "— Select supplier —" }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />
        {!supplierId
          ? <Inp label="…or type a supplier name" value={supplierName} onChange={e => { setSupplierName(e.target.value); setError(""); }} placeholder="Not in Contacts yet" />
          : <div />}
        <Inp label="Supplier Invoice No." value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Their invoice number" />
        <Inp label="Amount (ex. GST)" type="number" step="0.01" min="0" value={amount} onChange={e => { setAmount(e.target.value); setError(""); }} placeholder="0.00" />
        <Inp label="Invoice Date" type="date" value={invoiceDate} onChange={e => { setInvoiceDate(e.target.value); if (!dueTouched && e.target.value) setDueDate(computeDueDate(e.target.value, { invoiceDueMode: "monthday", invoiceDueValue: 20 })); }} />
        <Inp label="Due Date" type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); setDueTouched(true); }} />
      </div>
      <Inp label="Job (optional)" list="bill-job-list" value={jobId} onChange={e => { setJobId(e.target.value); setError(""); }} placeholder="Start typing a job number" />
      <datalist id="bill-job-list">
        {jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.client ? ` — ${j.client}` : ""}</option>)}
      </datalist>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything worth remembering about this bill"
          style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, background: "var(--bg-subtle)", boxSizing: "border-box", resize: "vertical", outline: "none", color: "var(--text-primary)", fontFamily: "'Inter',system-ui,sans-serif" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Attachments</label>
        {attachments.map(a => (
          <div key={a.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>📎 {a.name} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{fmtSize(a.size)}</span></span>
            <Btn variant="secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openBillFile(a)}>View</Btn>
            <Btn variant="danger" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { setAttachments(p => p.filter(x => x.path !== a.path)); setRemovedPaths(p => [...p, a.path]); }}>Remove</Btn>
          </div>
        ))}
        {newFiles.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>📎 {f.name} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{fmtSize(f.size)} · uploads when you save</span></span>
            <Btn variant="secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setNewFiles(p => p.filter((_, j) => j !== i))}>Remove</Btn>
          </div>
        ))}
        <input ref={fileRef} type="file" multiple style={{ display: "none" }}
          onChange={e => { const picked = Array.from(e.target.files || []); setNewFiles(p => [...p, ...picked]); e.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()} style={{ marginTop: 6, background: "none", border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: "8px 0", width: "100%", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Attach supplier invoice or other files</button>
      </div>

      {error && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 14 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : (bill ? "Save Changes" : "Create Bill")}</Btn>
      </div>
    </Modal>
  );
}

// Keeps a PO's billed cost (and so the job card) equal to the amount on its linked bill.
function syncPOFromBill(setPurchaseOrders, bill) {
  if (!bill.poId) return;
  setPurchaseOrders(prev => prev.map(p => p.id === bill.poId && (p.status !== "billed" || p.billedCost !== bill.amount) ? { ...p, status: "billed", billedCost: bill.amount } : p));
}

// Opens the bill for a purchase order: edits the existing bill if one is linked, otherwise starts a new one pre-filled from the PO.
function POBillModal({ po, bills, setBills, setPurchaseOrders, suppliers, jobs, purchaseOrders, onClose }) {
  const existing = bills.find(b => b.poId === po.id);
  return (
    <BillModal bill={existing || null}
      prefill={existing ? null : { supplierId: po.supplierId, jobId: po.jobId, poId: po.id, amount: po.billedCost, notes: po.reference ? `${po.poNumber} — ${po.reference}` : po.poNumber }}
      suppliers={suppliers} jobs={jobs} purchaseOrders={purchaseOrders}
      onSave={(b) => { setBills(prev => prev.some(x => x.id === b.id) ? prev.map(x => x.id === b.id ? b : x) : [...prev, b]); syncPOFromBill(setPurchaseOrders, b); onClose(); }}
      onClose={onClose} />
  );
}

function BillsView({ bills, setBills, setPurchaseOrders, setJobs, suppliers, jobs, purchaseOrders, settings }) {
  const [filter, setFilter] = useState("unpaid"); // unpaid | overdue | paid | all
  const [billFromPO, setBillFromPO] = useState(null);
  const [inclGST, setInclGST] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // bill object, "new", or null
  const [deleting, setDeleting] = useState(null);

  const supplierLabel = (b) => suppliers.find(s => s.id === b.supplierId)?.name || b.supplierName || "—";
  const unpaid = bills.filter(b => b.status !== "paid");
  const overdue = bills.filter(isBillOverdue);
  const rate = settings?.invoiceTaxRate ?? 15;
  const gstFactor = inclGST ? 1 + rate / 100 : 1;
  const amt = (b) => (b.amount || 0) * gstFactor;
  const sumOf = (list) => list.reduce((s, b) => s + amt(b), 0);
  const today = todayISO();
  const [ty, tm, td] = today.split("-").map(Number);
  const weekEnd = localISO(new Date(ty, tm - 1, td + 7));
  const monthEnd = localISO(new Date(ty, tm, 0));
  const dueWeek = unpaid.filter(b => b.dueDate && b.dueDate >= today && b.dueDate <= weekEnd);
  const dueMonth = unpaid.filter(b => b.dueDate && b.dueDate > weekEnd && b.dueDate <= monthEnd);
  const unbilledPOs = purchaseOrders.filter(p => p.status === "billed" && !bills.some(b => b.poId === p.id));

  const rows = bills
    .filter(b => filter === "all" ? true : filter === "paid" ? b.status === "paid" : filter === "overdue" ? isBillOverdue(b) : b.status !== "paid")
    .filter(b => {
      if (!search) return true;
      const q = search.toLowerCase();
      return supplierLabel(b).toLowerCase().includes(q) || (b.invoiceNumber || "").toLowerCase().includes(q) || (b.jobId || "").toLowerCase().includes(q) || (b.notes || "").toLowerCase().includes(q);
    })
    .sort((a, b) => filter === "paid" || filter === "all" ? (b.dueDate || "") < (a.dueDate || "") ? -1 : 1 : (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1);

  const saveBill = (b) => {
    syncCostFromBill(setJobs, b);
    syncPOFromBill(setPurchaseOrders, b);
    setBills(prev => prev.some(x => x.id === b.id) ? prev.map(x => x.id === b.id ? b : x) : [...prev, b]);
    setEditing(null);
  };
  const togglePaid = (b) => setBills(prev => prev.map(x => x.id === b.id ? { ...x, status: x.status === "paid" ? "unpaid" : "paid", paidDate: x.status === "paid" ? null : todayISO() } : x));
  const deleteBill = async (b) => {
    setBills(prev => prev.filter(x => x.id !== b.id));
    setDeleting(null);
    const paths = (b.attachments || []).map(a => a.path);
    if (paths.length) { try { await supabase.storage.from(BILL_BUCKET).remove(paths); } catch (e) { /* file clean-up is best effort */ } }
  };

  const chip = (id, label, count) => (
    <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 16px", border: "none", borderRadius: 8, background: filter === id ? ACCENT : "transparent", color: filter === id ? INK : "#5C6B82", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{label}{count != null ? ` (${count})` : ""}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 4px" }}>Costs</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>Supplier bills you owe — {fmtMoney(sumOf(unpaid))} {inclGST ? "incl. GST" : "ex. GST"} unpaid{overdue.length ? `, ${fmtMoney(sumOf(overdue))} overdue` : ""}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}>
            Show incl. GST ({rate}%)
            <ToggleSwitch on={inclGST} onClick={() => setInclGST(v => !v)} />
          </label>
          <Btn onClick={() => setEditing("new")}>+ New Bill</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Overdue" value={fmtMoney(sumOf(overdue))} sub={`${overdue.length} bill${overdue.length !== 1 ? "s" : ""}`} accent="#DC2626" onClick={() => setFilter("overdue")} />
        <StatCard label="Due in the next 7 days" value={fmtMoney(sumOf(dueWeek))} sub={`${dueWeek.length} bill${dueWeek.length !== 1 ? "s" : ""}`} accent="#F59E0B" />
        <StatCard label="Later this month" value={fmtMoney(sumOf(dueMonth))} sub={`${dueMonth.length} bill${dueMonth.length !== 1 ? "s" : ""}`} accent="#3B82F6" />
        <StatCard label="Total unpaid" value={fmtMoney(sumOf(unpaid))} sub={`${unpaid.length} bill${unpaid.length !== 1 ? "s" : ""} · ${inclGST ? "incl." : "ex."} GST`} accent="#64748B" onClick={() => setFilter("unpaid")} />
      </div>

      {unbilledPOs.length > 0 && (
        <div style={{ background: "#F59E0B18", border: "1.5px solid #F59E0B55", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>{unbilledPOs.length} billed purchase order{unbilledPOs.length !== 1 ? "s" : ""} not recorded as a bill yet</div>
          {unbilledPOs.map(po => (
            <div key={po.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0", fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, color: ACCENT_TEXT, minWidth: 80 }}>{po.poNumber}</span>
              <span style={{ flex: 1, minWidth: 120, color: "var(--text-secondary)" }}>{suppliers.find(s => s.id === po.supplierId)?.name || "Unknown supplier"} · {po.jobId}</span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fmtMoney((po.billedCost || 0) * gstFactor)}</span>
              <Btn variant="secondary" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setBillFromPO(po)}>+ Add bill</Btn>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--card-bg)", borderRadius: 10, padding: 4, boxShadow: "0 1px 4px #1C233310" }}>
          {chip("unpaid", "Unpaid", unpaid.length)}
          {chip("overdue", "Overdue", overdue.length)}
          {chip("paid", "Paid")}
          {chip("all", "All")}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier, invoice no. or job…"
          style={{ flex: 1, minWidth: 200, maxWidth: 340, border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "var(--text-primary)", outline: "none", background: "var(--card-bg)", boxSizing: "border-box" }} />
      </div>

      <style>{`
        .bill-row { display: grid; grid-template-columns: 100px minmax(0,1.3fr) minmax(0,1fr) 100px 110px 110px auto; column-gap: 14px; align-items: center; justify-items: start; }
        @media (max-width: 767px) { .bill-row { display: flex; flex-wrap: wrap; gap: 10px; } }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(b => {
          const late = isBillOverdue(b);
          const paid = b.status === "paid";
          const color = paid ? "#10B981" : late ? "#DC2626" : "#F59E0B";
          const po = b.poId ? purchaseOrders.find(p => p.id === b.poId) : null;
          return (
            <div key={b.id} className="bill-row" style={{ background: "var(--card-bg)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 4px #1C233310" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: late ? "#DC2626" : "var(--text-primary)" }}>{paid ? "Paid" : "Due"} {formatDate(paid ? b.paidDate : b.dueDate)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{supplierLabel(b)}</div>
                {po && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{po.poNumber}</div>}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", minWidth: 0 }}>{b.invoiceNumber || "—"}{(b.attachments || []).length > 0 && <span style={{ marginLeft: 6, fontSize: 11 }}>📎{b.attachments.length}</span>}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{b.jobId || "—"}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{fmtMoney(amt(b))}</div>
              <button onClick={() => togglePaid(b)} title={paid ? "Click to mark as unpaid" : "Click to mark as paid"}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, border: "1.5px solid " + color, background: color + "18", color, fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, cursor: "pointer" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />{paid ? "Paid" : late ? "Overdue" : "Unpaid"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                {!paid && <Btn onClick={() => togglePaid(b)}>Mark Paid</Btn>}
                <Btn variant="secondary" onClick={() => setEditing(b)}>Edit</Btn>
                <Btn variant="danger" onClick={() => setDeleting(b)}>Delete</Btn>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 14, background: "var(--card-bg)", borderRadius: 12 }}>{bills.length === 0 ? "No bills yet. Click “+ New Bill” to add your first supplier invoice." : "No bills match this view."}</div>}
      </div>

      {billFromPO && <POBillModal po={billFromPO} bills={bills} setBills={setBills} setPurchaseOrders={setPurchaseOrders} suppliers={suppliers} jobs={jobs} purchaseOrders={purchaseOrders} onClose={() => setBillFromPO(null)} />}
      {editing && (
        <BillModal bill={editing === "new" ? null : editing} suppliers={suppliers} jobs={jobs} purchaseOrders={purchaseOrders} onSave={saveBill} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <Modal title="Delete this bill?" onClose={() => setDeleting(null)}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 0 }}>{supplierLabel(deleting)} · {fmtMoney(deleting.amount)}{deleting.invoiceNumber ? ` · ${deleting.invoiceNumber}` : ""}. Any attached files are deleted too. This can't be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setDeleting(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => deleteBill(deleting)}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
// Keeps an additional cost's amount (and so the job card) equal to the amount on its linked bill.
function syncCostFromBill(setJobs, bill) {
  if (!bill.costId) return;
  setJobs(prev => prev.map(j => (j.jobCosts || []).some(c => c.id === bill.costId && c.amount !== bill.amount)
    ? { ...j, jobCosts: j.jobCosts.map(c => c.id === bill.costId ? { ...c, amount: bill.amount } : c) }
    : j));
}

// Opens the bill (supplier invoice) behind an additional cost: edits the linked bill, or starts a new one pre-filled from the cost.
function CostBillModal({ cost, job, bills, setBills, setJobs, suppliers, jobs, purchaseOrders, onClose }) {
  const existing = bills.find(b => b.costId === cost.id);
  return (
    <BillModal bill={existing || null}
      prefill={existing ? null : { jobId: job.id, costId: cost.id, amount: cost.amount, notes: cost.label }}
      suppliers={suppliers} jobs={jobs} purchaseOrders={purchaseOrders}
      onSave={(b) => { setBills(prev => prev.some(x => x.id === b.id) ? prev.map(x => x.id === b.id ? b : x) : [...prev, b]); syncCostFromBill(setJobs, b); onClose(); }}
      onClose={onClose} />
  );
}

// ─── QUOTES ───────────────────────────────────────────────────────────────────
const QUOTE_STATUS_META = {
  draft: { label: "Draft", color: "#9CA3AF" },
  sent: { label: "Sent", color: "#F59E0B" },
  accepted: { label: "Accepted", color: "#10B981" },
  declined: { label: "Declined", color: "#DC2626" },
};
function quid() { return "qt" + Date.now() + Math.floor(Math.random() * 1000); }
function quoteAddDays(iso, n) {
  const [y, m, d] = (iso || todayISO()).split("-").map(Number);
  return localISO(new Date(y, m - 1, d + n));
}
// Next quote number from Settings (prefix + counter). Skips numbers already used; falls back to counting up from existing quotes.
function nextQuoteNumber(quotes, settings) {
  const prefix = settings?.quoteNumberPrefix ?? "QUO-";
  const cur = settings?.quoteNextNumber;
  if (cur && /^\d+$/.test(cur)) {
    let n = parseInt(cur, 10);
    let candidate = prefix + cur;
    while (quotes.some(q => q.quoteNumber === candidate)) { n += 1; candidate = prefix + String(n).padStart(cur.length, "0"); }
    return candidate;
  }
  const nums = quotes.map(q => parseInt((q.quoteNumber || "").replace(/\D/g, ""), 10)).filter(n => !isNaN(n));
  return `${prefix}${(nums.length ? Math.max(...nums) : 1000) + 1}`;
}
// After a new quote is saved, works out what the counter should move to (keeps leading zeros). Returns null if no change is needed.
function advanceQuoteCounter(settings, savedNumber) {
  const prefix = settings?.quoteNumberPrefix ?? "QUO-";
  const cur = settings?.quoteNextNumber || "";
  if (!cur || !/^\d+$/.test(cur) || !savedNumber.startsWith(prefix)) return null;
  const tail = savedNumber.slice(prefix.length);
  if (!/^\d+$/.test(tail)) return null;
  const savedNum = parseInt(tail, 10);
  if (savedNum < parseInt(cur, 10)) return null;
  return String(savedNum + 1).padStart(cur.length, "0");
}
function isQuoteExpired(q) { return q.status === "sent" && !!q.validUntil && q.validUntil < todayISO(); }

function QuoteStatusBadge({ quote, onClick }) {
  const meta = QUOTE_STATUS_META[quote.status] || QUOTE_STATUS_META.draft;
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, border: "1.5px solid " + meta.color, background: meta.color + "18", color: meta.color, fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3, cursor: "pointer" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }} />
      {meta.label}
    </button>
  );
}

function QuoteStatusModal({ quote, onSave, onClose }) {
  return (
    <Modal title={`Update Status — ${quote.quoteNumber}`} onClose={onClose}>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>Choose the current status of this quote.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(QUOTE_STATUS_META).map(([key, meta]) => (
          <button key={key} onClick={() => onSave({ ...quote, status: key })}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 9, border: quote.status === key ? `2px solid ${meta.color}` : "1.5px solid var(--border-strong)", background: quote.status === key ? meta.color + "18" : "var(--card-bg)", cursor: "pointer", textAlign: "left" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color }} />
            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{meta.label}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <Btn variant="secondary" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}

function QuoteBuilderModal({ quote, presetJobId, customers, setCustomers, roles, jobs, quotes, settings, onSave, onClose }) {
  const [quoteNumber, setQuoteNumber] = useState(quote?.quoteNumber || nextQuoteNumber(quotes, settings));
  const [customerName, setCustomerName] = useState(quote?.customerName || (presetJobId ? (jobs.find(j => j.id === presetJobId)?.client || "") : ""));
  const [jobId, setJobId] = useState(quote?.jobId || presetJobId || "");
  const [issueDate, setIssueDate] = useState(quote?.issueDate || todayISO());
  const validDays = settings?.quoteValidDays ?? 30;
  const [validUntil, setValidUntil] = useState(quote?.validUntil || quoteAddDays(todayISO(), validDays));
  const [validTouched, setValidTouched] = useState(!!quote);
  const [status, setStatus] = useState(quote?.status || "draft");
  const [lines, setLines] = useState(quote?.lineItems || [{ id: liid(), type: "custom", description: "", quantity: 1, unitPrice: 0 }]);
  const [notes, setNotes] = useState(quote?.notes ?? (settings?.quoteTerms || ""));
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [error, setError] = useState("");
  const taxRate = quote?.taxRate ?? settings?.invoiceTaxRate ?? 15;
  const [hrRole, setHrRole] = useState("");
  const [hrQty, setHrQty] = useState("");
  const addHours = () => {
    const r = (roles || []).find(x => x.id === hrRole);
    const h = parseFloat(hrQty);
    if (!r || !h) return;
    const line = { id: liid(), type: "labour", description: `Labour — ${r.name}`, quantity: h, unitPrice: r.chargeOutRate || 0 };
    setLines(prev => (prev.length === 1 && !(prev[0].description || "").trim() && !Number(prev[0].unitPrice)) ? [line] : [...prev, line]);
    setHrQty(""); setError("");
  };

  const updateLine = (id, field, value) => setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  const removeLine = (id) => setLines(prev => prev.filter(l => l.id !== id));
  const addLine = () => setLines(prev => [...prev, { id: liid(), type: "custom", description: "", quantity: 1, unitPrice: 0 }]);
  const { subtotal, taxAmount, total } = calcInvoiceTotals(lines, taxRate);

  const onJobChange = (v) => {
    setJobId(v); setError("");
    const j = jobs.find(x => x.id === v.trim());
    if (j && j.client && !customerName) setCustomerName(j.client);
  };

  const handleSave = () => {
    if (!quoteNumber.trim()) { setError("Quote number is required."); return; }
    if (!customerName.trim()) { setError("Choose a customer (or add a new one)."); return; }
    const jid = jobId.trim();
    if (jid && !jobs.some(j => j.id === jid)) { setError("That job number wasn't found. Pick one from the list, or leave it blank."); return; }
    const usable = lines.filter(l => (l.description || "").trim() || Number(l.unitPrice));
    if (usable.length === 0) { setError("Add at least one line item."); return; }
    const t = calcInvoiceTotals(usable, taxRate);
    onSave({
      id: quote?.id || quid(), quoteNumber: quoteNumber.trim(), jobId: jid || null, customerName: customerName.trim(),
      status, issueDate, validUntil: validUntil || null, lineItems: usable, taxRate,
      subtotal: t.subtotal, taxAmount: t.taxAmount, total: t.total, notes,
      createdAt: quote?.createdAt || todayISO(),
    });
  };

  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 };
  const cell = { border: "1.5px solid var(--border-strong)", borderRadius: 7, padding: "7px 8px", fontSize: 13, background: "var(--card-bg)", color: "var(--text-primary)", outline: "none" };
  return (
    <Modal title={quote ? `Edit ${quote.quoteNumber}` : "New Quote"} onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Inp label="Quote Number" value={quoteNumber} onChange={e => { setQuoteNumber(e.target.value); setError(""); }} />
        <Sel label="Status" value={status} onChange={e => setStatus(e.target.value)} options={Object.entries(QUOTE_STATUS_META).map(([value, m]) => ({ value, label: m.label }))} />
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Customer</label>
          <CustomerPicker customers={customers} value={customerName} onChange={v => { setCustomerName(v); setError(""); }} onAddNew={(name) => setAddingCustomer(name || true)} />
        </div>
        <Inp label="Job (optional)" list="quote-job-list" value={jobId} onChange={e => onJobChange(e.target.value)} placeholder="Start typing a job number" />
        <Inp label="Issue Date" type="date" value={issueDate} onChange={e => { setIssueDate(e.target.value); if (!validTouched && e.target.value) setValidUntil(quoteAddDays(e.target.value, validDays)); }} />
        <Inp label="Valid Until" type="date" value={validUntil} onChange={e => { setValidUntil(e.target.value); setValidTouched(true); }} />
      </div>
      <datalist id="quote-job-list">
        {jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.client ? ` — ${j.client}` : ""}</option>)}
      </datalist>

      <label style={{ ...labelStyle, marginBottom: 8 }}>Line Items</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 280, overflowY: "auto" }}>
        {lines.map(l => (
          <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--bg-subtle)", borderRadius: 8, padding: 10 }}>
            <input value={l.description} onChange={e => updateLine(l.id, "description", e.target.value)} placeholder="Description" style={{ ...cell, flex: 2, minWidth: 0, boxSizing: "border-box" }} />
            <input type="number" value={l.quantity} onChange={e => updateLine(l.id, "quantity", parseFloat(e.target.value) || 0)} placeholder="Qty" style={{ ...cell, width: 70 }} />
            <input type="number" value={l.unitPrice} onChange={e => updateLine(l.id, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="Price" style={{ ...cell, width: 90 }} />
            <div style={{ width: 90, textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", paddingTop: 8 }}>${((l.quantity || 0) * (l.unitPrice || 0)).toFixed(2)}</div>
            <button onClick={() => removeLine(l.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: "6px 2px" }}>×</button>
          </div>
        ))}
        {lines.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>No line items yet.</div>}
      </div>
      {roles && roles.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "var(--bg-subtle)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Add hours:</span>
          <select value={hrRole} onChange={e => setHrRole(e.target.value)} style={{ ...cell, flex: 1, minWidth: 160 }}>
            <option value="">Choose a role…</option>
            {roles.filter(r => r.chargeOutRate > 0).map(r => <option key={r.id} value={r.id}>{r.name} — ${r.chargeOutRate}/hr</option>)}
          </select>
          <input type="number" min="0" step="0.5" value={hrQty} onChange={e => setHrQty(e.target.value)} placeholder="Hours" style={{ ...cell, width: 80 }} />
          <Btn variant="secondary" onClick={addHours}>+ Add</Btn>
        </div>
      )}
      <button onClick={addLine}style={{ background: "none", border: "1.5px dashed var(--border-strong)", borderRadius: 8, padding: "8px 0", width: "100%", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 20 }}>+ Add Line Item</button>

      <div style={{ background: "var(--bg-subtle)", borderRadius: 8, padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}><span>Tax ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900, color: "var(--text-primary)", paddingTop: 8, borderTop: "1px solid var(--border-strong)" }}><span>Total</span><span>${total.toFixed(2)}</span></div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Notes / Terms</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="e.g. Prices are valid for 30 days. Work to start on acceptance of this quote."
          style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, background: "var(--bg-subtle)", boxSizing: "border-box", resize: "vertical", outline: "none", color: "var(--text-primary)", fontFamily: "'Inter',system-ui,sans-serif" }} />
      </div>

      {error && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 14 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave}>{quote ? "Save Changes" : "Create Quote"}</Btn>
      </div>

      {addingCustomer && (
        <QuickAddCustomerModal customers={customers} initialName={typeof addingCustomer === "string" ? addingCustomer : ""} onClose={() => setAddingCustomer(false)}
          onSave={(c) => { setCustomers(p => [...p, c]); setCustomerName(c.name); setAddingCustomer(false); }} />
      )}
    </Modal>
  );
}

function QuotePrintView({ quote, job, customer, company, settings, onClose }) {
  const footerNote = settings?.quoteFooterNote || "Thank you for the opportunity to quote.";

  const handleEmailQuote = async () => {
    await downloadElementAsPDF("quote-print-area", `${quote.quoteNumber}.pdf`);
    const email = customer?.email || "";
    const subject = encodeURIComponent(`Quote ${quote.quoteNumber} from ${company?.name || ""}`);
    const body = encodeURIComponent(`Hi ${customer?.contactPerson || customer?.name || ""},\n\nPlease find attached quote ${quote.quoteNumber} for $${quote.total.toFixed(2)}${quote.validUntil ? `, valid until ${formatDate(quote.validUntil)}` : ""}.\n\nThe PDF has just been downloaded to your computer — please attach it to this email before sending.\n\nKind regards,\n${company?.name || ""}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#5C6B82", zIndex: 3000, overflowY: "auto" }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { width: 210mm; height: 297mm; }
          body * { visibility: hidden; }
          #quote-print-area, #quote-print-area * { visibility: visible; }
          #quote-print-area {
            position: absolute; top: 0; left: 0;
            width: 210mm; min-height: 297mm; max-width: none;
            margin: 0; box-shadow: none;
            background: #fff !important; color: #1C2333 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#1C2333", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Quote {quote.quoteNumber}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => window.print()}>🖨 Print</Btn>
          <Btn variant="secondary" onClick={() => downloadElementAsPDF("quote-print-area", `${quote.quoteNumber}.pdf`)}>⬇ Save as PDF</Btn>
          <Btn variant="secondary" onClick={handleEmailQuote}>✉ Email Quote</Btn>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </div>
      <div id="quote-print-area" style={{ background: "#fff", width: "210mm", minHeight: "297mm", margin: "30px auto", padding: "18mm 16mm", boxSizing: "border-box", boxShadow: "0 4px 24px #00000030", fontFamily: "'Inter',system-ui,sans-serif", color: "#1C2333" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36, paddingBottom: 24, borderBottom: "2px solid #1C2333" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{company?.name || "Your Company Name"}</div>
            {company?.address && <div style={{ fontSize: 12, color: "#5C6B82", marginTop: 6, whiteSpace: "pre-line" }}>{company.address}</div>}
            {company?.phone && <div style={{ fontSize: 12, color: "#5C6B82", marginTop: 2 }}>{company.phone}</div>}
            {company?.email && <div style={{ fontSize: 12, color: "#5C6B82" }}>{company.email}</div>}
            {company?.abn && <div style={{ fontSize: 12, color: "#5C6B82", marginTop: 2 }}>GST No. {company.abn}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 1 }}>QUOTE</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#7A8A00", marginTop: 6 }}>{quote.quoteNumber}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Issued: {formatDate(quote.issueDate)}</div>
            {quote.validUntil && <div style={{ fontSize: 12, color: "#9CA3AF" }}>Valid until: {formatDate(quote.validUntil)}</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Prepared For</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{customer?.name || quote.customerName || "—"}</div>
            {customer?.contactPerson && <div style={{ fontSize: 13, color: "#5C6B82", marginTop: 3 }}>Attn: {customer.contactPerson}</div>}
            {customer?.address && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6, whiteSpace: "pre-line" }}>{customer.address}</div>}
            {customer?.email && <div style={{ fontSize: 13, color: "#5C6B82", marginTop: 3 }}>{customer.email}</div>}
          </div>
          {quote.jobId && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Job Reference</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{quote.jobId}</div>
              {job?.title && <div style={{ fontSize: 13, color: "#5C6B82", marginTop: 3 }}>{job.title}</div>}
            </div>
          )}
        </div>

        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, marginBottom: 20 }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#5C6B82", borderBottom: "1px solid #E5EAF0", fontSize: 11, textTransform: "uppercase" }}>Description</th>
              <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#5C6B82", borderBottom: "1px solid #E5EAF0", fontSize: 11, textTransform: "uppercase" }}>Qty</th>
              <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#5C6B82", borderBottom: "1px solid #E5EAF0", fontSize: 11, textTransform: "uppercase" }}>Price</th>
              <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#5C6B82", borderBottom: "1px solid #E5EAF0", fontSize: 11, textTransform: "uppercase" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map(l => (
              <tr key={l.id} style={{ borderBottom: "1px solid #F1F4F8" }}>
                <td style={{ padding: "8px 10px" }}>{l.description}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#5C6B82" }}>{l.quantity}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#5C6B82" }}>${Number(l.unitPrice).toFixed(2)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>${(l.quantity * l.unitPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
          <div style={{ width: 240 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#5C6B82", padding: "4px 0" }}><span>Subtotal</span><span>${quote.subtotal.toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#5C6B82", padding: "4px 0" }}><span>Tax ({quote.taxRate}%)</span><span>${quote.taxAmount.toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900, padding: "10px 0", marginTop: 6, borderTop: "2px solid #1C2333" }}><span>Total</span><span>${quote.total.toFixed(2)}</span></div>
          </div>
        </div>

        {quote.notes && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Notes &amp; Terms</div>
            <div style={{ fontSize: 12, color: "#5C6B82", lineHeight: 1.6, whiteSpace: "pre-line" }}>{quote.notes}</div>
          </div>
        )}

        <div style={{ marginTop: 40, paddingTop: 16, borderTop: "1px solid #E5EAF0", fontSize: 11, color: "#C4CAD4", textAlign: "center" }}>
          {footerNote}
        </div>
      </div>
    </div>
  );
}

function QuotesView({ invoices, setInvoices, jobs, customers, setCustomers, roles, quotes, setQuotes, company, settings, setSettings, onOpenJob }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // quote object, "new", or null
  const [printing, setPrinting] = useState(null);
  const [statusQuote, setStatusQuote] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [converting, setConverting] = useState(null);
  const awaiting = quotes.filter(q => q.status === "sent");
  const rows = quotes
    .filter(q => filter === "all" || q.status === filter)
    .filter(q => {
      if (!search) return true;
      const s = search.toLowerCase();
      const job = jobs.find(j => j.id === q.jobId);
      return q.quoteNumber.toLowerCase().includes(s) || (q.customerName || "").toLowerCase().includes(s) || (q.jobId || "").toLowerCase().includes(s) || (job?.title || "").toLowerCase().includes(s);
    })
    .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : (a.quoteNumber < b.quoteNumber ? 1 : -1)));

  const saveQuote = (q) => {
    const isNew = !quotes.some(x => x.id === q.id);
    setQuotes(prev => prev.some(x => x.id === q.id) ? prev.map(x => x.id === q.id ? q : x) : [q, ...prev]);
    if (isNew) {
      const next = advanceQuoteCounter(settings, q.quoteNumber);
      if (next) setSettings(p => ({ ...p, quoteNextNumber: next }));
    }
    setEditing(null);
  };
  const updateStatus = (q) => { setQuotes(prev => prev.map(x => x.id === q.id ? q : x)); setStatusQuote(null); };
  const deleteQuote = (id) => { setQuotes(prev => prev.filter(x => x.id !== id)); setDeleting(null); };

  const chip = (id, label) => (
    <button key={id} onClick={() => setFilter(id)} style={{ padding: "7px 16px", border: "none", borderRadius: 8, background: filter === id ? ACCENT : "transparent", color: filter === id ? INK : "#5C6B82", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{label} ({id === "all" ? quotes.length : quotes.filter(q => q.status === id).length})</button>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 4px" }}>Quotes</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{quotes.length} quote{quotes.length !== 1 ? "s" : ""}{awaiting.length ? ` · ${fmtMoney(awaiting.reduce((s, q) => s + (q.total || 0), 0))} awaiting a response` : ""}</p>
        </div>
        <Btn onClick={() => setEditing("new")}>+ New Quote</Btn>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--card-bg)", borderRadius: 10, padding: 4, boxShadow: "0 1px 4px #1C233310", flexWrap: "wrap" }}>
          {chip("all", "All")}{chip("draft", "Draft")}{chip("sent", "Sent")}{chip("accepted", "Accepted")}{chip("declined", "Declined")}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quote number, customer or job…"
          style={{ flex: 1, minWidth: 200, maxWidth: 340, border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, color: "var(--text-primary)", outline: "none", background: "var(--card-bg)", boxSizing: "border-box" }} />
      </div>

      <style>{`
        .quote-row { display: grid; grid-template-columns: 110px minmax(0,1.5fr) 130px 110px 110px auto; column-gap: 14px; align-items: center; justify-items: start; }
        @media (max-width: 767px) { .quote-row { display: flex; flex-wrap: wrap; gap: 10px; } }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(q => {
          const job = jobs.find(j => j.id === q.jobId);
          const expired = isQuoteExpired(q);
          return (
            <div key={q.id} className="quote-row" style={{ background: "var(--card-bg)", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px #1C233310" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT_TEXT }}>{q.quoteNumber}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{formatDate(q.issueDate)}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{q.customerName || "Unknown customer"}</div>
                {job && <button onClick={() => onOpenJob(job)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: "var(--text-secondary)", textAlign: "left" }}>{job.id} — {job.title.slice(0, 40)}</button>}
                {!job && q.jobId && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{q.jobId} (deleted)</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Valid until</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: expired ? "#DC2626" : "var(--text-secondary)" }}>{q.validUntil ? formatDate(q.validUntil) : "—"}{expired ? " · expired" : ""}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{fmtMoney(q.total)}</div>
              <QuoteStatusBadge quote={q} onClick={() => setStatusQuote(q)} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {q.status === "accepted" && (isQuoteInvoiced(q, invoices)
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981" }}>Invoiced ✓</span>
                  : <Btn onClick={() => setConverting(q)}>Convert to Invoice</Btn>)}
                <Btn variant="secondary" onClick={() => setPrinting(q)}>View / Print</Btn>
                <Btn variant="secondary" onClick={() => setEditing(q)}>Edit</Btn>
                <Btn variant="danger" onClick={() => setDeleting(q)}>Delete</Btn>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 14, background: "var(--card-bg)", borderRadius: 12 }}>{quotes.length === 0 ? "No quotes yet. Click “+ New Quote” to create your first one." : "No quotes match this view."}</div>}
      </div>

      {editing && (
        <QuoteBuilderModal quote={editing === "new" ? null : editing} roles={roles} customers={customers} setCustomers={setCustomers} jobs={jobs} quotes={quotes} settings={settings} onSave={saveQuote} onClose={() => setEditing(null)} />
      )}
      {printing && (
        <QuotePrintView quote={printing} job={jobs.find(j => j.id === printing.jobId)} customer={customers.find(c => c.name === printing.customerName)} company={company} settings={settings} onClose={() => setPrinting(null)} />
      )}
      {statusQuote && <QuoteStatusModal quote={statusQuote} onSave={updateStatus} onClose={() => setStatusQuote(null)} />}
      {converting && <QuoteToInvoiceModal quote={converting} job={jobs.find(j => j.id === converting.jobId)} customers={customers} invoices={invoices} setInvoices={setInvoices} settings={settings} onClose={() => setConverting(null)} />}
      {deleting && (
        <Modal title={`Delete ${deleting.quoteNumber}?`} onClose={() => setDeleting(null)}>
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>This can't be undone.</div>
            <div style={{ fontSize: 13, color: "#7F1D1D", marginBottom: 16 }}>{deleting.quoteNumber} will be permanently deleted.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setDeleting(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => deleteQuote(deleting.id)}>Yes, Delete</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SettingsQuotesPage({ settings, setSettings }) {
  const [draft, setDraft] = useState({
    quoteNumberPrefix: settings.quoteNumberPrefix ?? "QUO-",
    quoteNextNumber: settings.quoteNextNumber || "",
    quoteValidDays: settings.quoteValidDays ?? 30,
    quoteTerms: settings.quoteTerms || "",
    quoteFooterNote: settings.quoteFooterNote || "",
  });
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setDraft(p => ({ ...p, [k]: v })); setSaved(false); };
  const preview = draft.quoteNextNumber ? draft.quoteNumberPrefix + draft.quoteNextNumber : "";
  const handleSave = () => {
    setSettings(p => ({ ...p, ...draft, quoteNumberPrefix: draft.quoteNumberPrefix.trim(), quoteNextNumber: draft.quoteNextNumber.trim() }));
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  return (
    <div>
      <div style={{ background: "var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310", maxWidth: 560 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px" }}>Quote Numbering</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>New quotes open with the next number already filled in, and it counts up each time you save one. You can still type over it on any quote.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Inp label="Prefix" value={draft.quoteNumberPrefix} onChange={e => set("quoteNumberPrefix", e.target.value)} placeholder="e.g. QUO-" />
          <Inp label="Next Number" value={draft.quoteNextNumber} onChange={e => set("quoteNextNumber", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1001" />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
          Next new quote will be: <strong style={{ color: "var(--text-primary)" }}>{preview || "— (not set, counts up from your existing quotes)"}</strong>
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px" }}>Quote Defaults</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>These apply to every new quote. You can still change anything on an individual quote.</p>
        <Inp label="Valid For (days)" type="number" min="1" value={draft.quoteValidDays} onChange={e => set("quoteValidDays", parseInt(e.target.value, 10) || 0)} placeholder="e.g. 30" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Default Notes / Terms</label>
          <textarea value={draft.quoteTerms} onChange={e => set("quoteTerms", e.target.value)} rows={3} placeholder="e.g. Prices are valid for 30 days. Work starts on acceptance of this quote."
            style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, background: "var(--bg-subtle)", boxSizing: "border-box", resize: "vertical", outline: "none", color: "var(--text-primary)", fontFamily: "'Inter',system-ui,sans-serif" }} />
        </div>
        <Inp label="Footer Note" value={draft.quoteFooterNote} onChange={e => set("quoteFooterNote", e.target.value)} placeholder="e.g. Thank you for the opportunity to quote." />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <Btn onClick={handleSave}>Save Quote Settings</Btn>
          {saved && <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981" }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}

// ─── QUOTES: CONVERT TO INVOICE + PER-JOB QUOTES PAGE ─────────────────────────
function QuoteToInvoiceModal({ quote, job, customers, invoices, setInvoices, settings, onClose }) {
  const lines = (quote.lineItems || []).map((l, i) => ({ ...l, id: liid() + "q" + i }));
  const pseudoJob = job || { id: quote.jobId || null, client: quote.customerName, title: "", jobCosts: [] };
  return (
    <InvoiceBuilderModal job={pseudoJob} staff={[]} roles={[]} customers={customers} timeEntries={[]} purchaseOrders={[]} invoices={invoices} settings={settings}
      prefill={{ lineItems: lines, notes: `Ref: Quote ${quote.quoteNumber}` + (settings?.invoiceFooterNote ? `\n${settings.invoiceFooterNote}` : "") }}
      onSave={(inv) => { setInvoices(prev => [inv, ...prev]); onClose(true); }} onClose={() => onClose(false)} />
  );
}
function isQuoteInvoiced(quote, invoices) {
  return (invoices || []).some(i => (i.notes || "").includes(`Ref: Quote ${quote.quoteNumber}`));
}

function JobQuotesPage({ job, jobs, customers, setCustomers, roles, quotes, setQuotes, invoices, setInvoices, company, settings, setSettings, onBack }) {
  const [editing, setEditing] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [statusQuote, setStatusQuote] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [converting, setConverting] = useState(null);
  const jobQuotes = (quotes || []).filter(q => q.jobId === job.id).sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));

  const saveQuote = (q) => {
    const isNew = !quotes.some(x => x.id === q.id);
    setQuotes(prev => prev.some(x => x.id === q.id) ? prev.map(x => x.id === q.id ? q : x) : [q, ...prev]);
    if (isNew) {
      const next = advanceQuoteCounter(settings, q.quoteNumber);
      if (next) setSettings(p => ({ ...p, quoteNextNumber: next }));
    }
    setEditing(null);
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14 }}>← Back to Job</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 4px" }}>Quotes</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{job.id} · {job.title}</p>
        </div>
        <Btn onClick={() => setEditing("new")}>+ New Quote</Btn>
      </div>

      {jobQuotes.length === 0 ? (
        <div style={{ background: "var(--card-bg)", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No quotes for this job yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {jobQuotes.map(q => (
            <div key={q.id} style={{ background: "var(--card-bg)", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px #1C233310", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 100 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT_TEXT }}>{q.quoteNumber}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{formatDate(q.issueDate)}</div>
              </div>
              <div style={{ flex: 1, fontSize: 13, color: isQuoteExpired(q) ? "#DC2626" : "var(--text-secondary)" }}>{q.validUntil ? `Valid until ${formatDate(q.validUntil)}${isQuoteExpired(q) ? " · expired" : ""}` : ""}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>${q.total.toFixed(2)}</div>
              <QuoteStatusBadge quote={q} onClick={() => setStatusQuote(q)} />
              {q.status === "accepted" && (isQuoteInvoiced(q, invoices)
                ? <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981" }}>Invoiced ✓</span>
                : <Btn onClick={() => setConverting(q)}>Convert to Invoice</Btn>)}
              <Btn variant="secondary" onClick={() => setPrinting(q)}>View / Print</Btn>
              <Btn variant="secondary" onClick={() => setEditing(q)}>Edit</Btn>
              <Btn variant="danger" onClick={() => setDeleting(q)}>Delete</Btn>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <QuoteBuilderModal quote={editing === "new" ? null : editing} presetJobId={job.id} roles={roles} customers={customers} setCustomers={setCustomers} jobs={jobs} quotes={quotes} settings={settings} onSave={saveQuote} onClose={() => setEditing(null)} />
      )}
      {printing && <QuotePrintView quote={printing} job={job} customer={customers.find(c => c.name === printing.customerName)} company={company} settings={settings} onClose={() => setPrinting(null)} />}
      {statusQuote && <QuoteStatusModal quote={statusQuote} onSave={(q) => { setQuotes(prev => prev.map(x => x.id === q.id ? q : x)); setStatusQuote(null); }} onClose={() => setStatusQuote(null)} />}
      {converting && <QuoteToInvoiceModal quote={converting} job={job} customers={customers} invoices={invoices} setInvoices={setInvoices} settings={settings} onClose={() => setConverting(null)} />}
      {deleting && (
        <Modal title={`Delete ${deleting.quoteNumber}?`} onClose={() => setDeleting(null)}>
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>This can't be undone.</div>
            <div style={{ fontSize: 13, color: "#7F1D1D", marginBottom: 16 }}>{deleting.quoteNumber} will be permanently deleted.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setDeleting(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => { setQuotes(prev => prev.filter(x => x.id !== deleting.id)); setDeleting(null); }}>Yes, Delete</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ComingSoonView({ title, description, icon }) {
  return (
    <div>
      <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>{title}</h1>
      <p style={{ color:"var(--text-secondary)", fontSize:14, margin:"0 0 24px" }}>{description}</p>
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:60, textAlign:"center", boxShadow:"0 1px 4px #1C233310" }}>
        <div style={{ fontSize:36, marginBottom:14, opacity:0.5 }}>{icon}</div>
        <div style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)", marginBottom:6 }}>Coming soon</div>
        <div style={{ fontSize:13, color:"var(--text-muted)", maxWidth:360, margin:"0 auto" }}>{title} aren't built yet, but they're planned — team rates and job costs are already set up to feed straight into them once they land.</div>
      </div>
    </div>
  );
}

function PurchaseOrdersView({ bills, setBills, jobs, staff, customers, suppliers, purchaseOrders, setPurchaseOrders, company, settings, onOpenJob }) {
  const [search, setSearch] = useState("");
  const [pickingJob, setPickingJob] = useState(false);
  const [creatingForJob, setCreatingForJob] = useState(null);
  const [billFormPO, setBillFormPO] = useState(null);
  const [editingPO, setEditingPO] = useState(null);
    const [printingPO, setPrintingPO] = useState(null);
    const [billingPO, setBillingPO] = useState(null);
    const [deletingPO, setDeletingPO] = useState(null);

  const rows = purchaseOrders
    .map(po => ({ po, job: jobs.find(j=>j.id===po.jobId), supplier: suppliers.find(s=>s.id===po.supplierId) }))
    .filter(({ po, job, supplier }) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return po.poNumber.toLowerCase().includes(q) || (job?.id||"").toLowerCase().includes(q) || (job?.title||"").toLowerCase().includes(q) || (supplier?.name||"").toLowerCase().includes(q) || (po.reference||"").toLowerCase().includes(q);
    })
    .sort((a,b) => a.po.dateCreated < b.po.dateCreated ? 1 : -1);

  const addPO = (po) => { setPurchaseOrders(prev=>[...prev, { ...po, poNumber: nextPONumber(prev) }]); setCreatingForJob(null); };
const updatePO = (updated) => { setPurchaseOrders(prev=>prev.map(p=>p.id===updated.id?updated:p)); setBillingPO(null); if (updated.status === "billed") { setBills(prev => prev.map(b => b.poId === updated.id && b.amount !== updated.billedCost ? { ...b, amount: updated.billedCost } : b)); if (!bills.some(b => b.poId === updated.id)) setBillFormPO(updated); } };  const deletePO = (poId) => { setPurchaseOrders(prev => prev.filter(p=>p.id!==poId)); setDeletingPO(null); };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>Purchase Orders</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:14, margin:0 }}>{purchaseOrders.length} purchase order{purchaseOrders.length!==1?"s":""} raised</p>
        </div>
        <Btn onClick={()=>setPickingJob(true)}>+ Create Purchase Order</Btn>
        <style>{`
  .po-row { display: grid; grid-template-columns: 100px minmax(0,1fr) 170px 240px auto auto auto; column-gap: 14px; justify-items: start; }
  @media (max-width: 767px) { .po-row { display: flex; flex-wrap: wrap; gap: 12px; } }
`}</style>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PO number, job, supplier, or reference..." style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 14px", fontSize:14, outline:"none", background:"var(--card-bg)", color:"var(--text-primary)", boxSizing:"border-box", marginBottom:18 }} />

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {rows.map(({ po, job, supplier }) => (
            <div key={po.id} className="po-row" style={{ background: "var(--card-bg)", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px #1C233310", alignItems: "center" }}>
            <div style={{ minWidth:100 }}>
              <div style={{ fontSize:13, fontWeight:800, color:ACCENT_TEXT }}>{po.poNumber}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{formatDate(po.dateCreated)}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{supplier?.name || "Unknown supplier"}</div>
              <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2 }}>{po.reference || po.details.slice(0,70)}</div>
            </div>
            <div style={{ minWidth:140 }}>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:2 }}>Job</div>
              {job ? (
                <button onClick={()=>onOpenJob(job)} style={{ background:"none", border:"none", padding:0, cursor:"pointer", textAlign:"left" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:ACCENT_TEXT }}>{job.id}</div>
                  <div style={{ fontSize:11, color:"var(--text-secondary)" }}>{job.title.slice(0,30)}</div>
                </button>
              ) : <span style={{ fontSize:12, color:"var(--text-muted)" }}>{po.jobId} (deleted)</span>}
            </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <POStatusBadge po={po} onClick={() => setBillingPO(po)} />
                  {po.status === "billed" && <button onClick={() => setBillFormPO(po)} style={{ background:"none", border:"1.5px solid var(--border-strong)", borderRadius:99, padding:"3px 10px", fontSize:11, fontWeight:700, color: bills.some(b => b.poId === po.id) ? "#10B981" : ACCENT_TEXT, cursor:"pointer" }}>{bills.some(b => b.poId === po.id) ? "Bill ✓" : "+ Bill"}</button>}
                </div>
                <Btn variant="secondary" onClick={() => setPrintingPO(po)}>View / Print</Btn><Btn variant="secondary" onClick={() => setEditingPO(po)}>Edit</Btn>
                <Btn variant="danger" onClick={() => setDeletingPO(po)}>Delete</Btn>
            </div>
        ))}
              {rows.length === 0 && <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 14, background: "var(--card-bg)", borderRadius: 12 }}>No purchase orders yet.</div>}
      </div>

      {billingPO && (
        <BillPOModal po={billingPO} onSave={updatePO} onClose={()=>setBillingPO(null)} />
      )}
      {pickingJob && (
        <JobPickerModal jobs={jobs} onClose={()=>setPickingJob(false)} onSelect={(j)=>{ setPickingJob(false); setCreatingForJob(j); }} />
      )}
      {billFormPO && <POBillModal po={billFormPO} bills={bills} setBills={setBills} setPurchaseOrders={setPurchaseOrders} suppliers={suppliers} jobs={jobs} purchaseOrders={purchaseOrders} onClose={() => setBillFormPO(null)} />}
      {editingPO && <PurchaseOrderModal job={{ id: editingPO.jobId, title: "" }} suppliers={suppliers} purchaseOrders={purchaseOrders} editingPO={editingPO} onSave={(u) => { setPurchaseOrders(prev => prev.map(p => p.id === u.id ? u : p)); setEditingPO(null); }} onClose={() => setEditingPO(null)} />}
      {creatingForJob && (
        <PurchaseOrderModal job={creatingForJob} suppliers={suppliers} purchaseOrders={purchaseOrders} onSave={addPO} onClose={()=>setCreatingForJob(null)} />
      )}
            {printingPO && (
                <POPrintView po={printingPO} job={jobs.find(j => j.id === printingPO.jobId) || { id: printingPO.jobId, title: "(job deleted)" }} supplier={suppliers.find(s => s.id === printingPO.supplierId)} company={company} settings={settings} onClose={() => setPrintingPO(null)} />
            )}
            {deletingPO && (
                <Modal title={`Delete ${deletingPO.poNumber}?`} onClose={() => setDeletingPO(null)}>
                    <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>This can't be undone.</div>
                        <div style={{ fontSize: 13, color: "#7F1D1D", marginBottom: 16 }}>{deletingPO.poNumber} will be permanently deleted{deletingPO.status === "billed" ? ", including its billed cost record" : ""}.</div>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <Btn variant="secondary" onClick={() => setDeletingPO(null)}>Cancel</Btn>
                            <Btn variant="danger" onClick={() => deletePO(deletingPO.id)}>Yes, Delete</Btn>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── NOTES EXPORT (PRINT / PDF) ────────────────────────────────────────────────
function NotesPrintView({ job, company, onClose }) {
  const notes = (job.jobNotes || []).slice().sort((a,b) => (a.createdAt||"").localeCompare(b.createdAt||""));
  const photoCount = notes.reduce((s,n)=>s+(n.photos?.length||0),0);

  return (
    <div style={{ position:"fixed", inset:0, background:"#5C6B82", zIndex:3000, overflowY:"auto" }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { width: 210mm; height: 297mm; }
          body * { visibility: hidden; }
          #notes-print-area, #notes-print-area * { visibility: visible; }
          #notes-print-area {
            position: absolute; top: 0; left: 0;
            width: 210mm; min-height: 297mm; max-width: none;
            margin: 0; box-shadow: none;
            background: #fff !important; color: #1C2333 !important;
          }
          .note-block { break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print" style={{ position:"sticky", top:0, background:"#1C2333", padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", zIndex:10 }}>
        <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>Notes & Photos — {job.id}</span>
        <div style={{ display:"flex", gap:10 }}>
                  <Btn onClick={() => window.print()}>🖨 Print</Btn>
                  <Btn variant="secondary" onClick={() => downloadElementAsPDF("notes-print-area", `${job.id}-notes.pdf`)}>⬇ Save as PDF</Btn>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </div>
      <div id="notes-print-area" style={{ background:"#fff", width:"210mm", minHeight:"297mm", margin:"30px auto", padding:"18mm 16mm", boxSizing:"border-box", boxShadow:"0 4px 24px #00000030", fontFamily:"'Inter',system-ui,sans-serif", color:"#1C2333" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32, paddingBottom:20, borderBottom:"2px solid #1C2333" }}>
          <div>
            <div style={{ fontSize:20, fontWeight:900 }}>{company?.name || "Your Company Name"}</div>
            {company?.address && <div style={{ fontSize:11, color:"#5C6B82", marginTop:5, whiteSpace:"pre-line" }}>{company.address}</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:22, fontWeight:900, letterSpacing:1 }}>JOB NOTES</div>
            <div style={{ fontSize:14, fontWeight:700, color:ACCENT_TEXT, marginTop:6 }}>{job.id}</div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>Printed: {formatDate(todayISO())}</div>
          </div>
        </div>

        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>{job.title}</div>
          <div style={{ fontSize:12, color:"#9CA3AF", marginTop:4 }}>{notes.length} note{notes.length!==1?"s":""} · {photoCount} photo{photoCount!==1?"s":""}</div>
        </div>

        {notes.length === 0 ? (
          <div style={{ fontSize:13, color:"#9CA3AF" }}>No notes recorded for this job.</div>
        ) : (
          notes.map((note, i) => (
            <div key={note.id} className="note-block" style={{ marginBottom:28, paddingBottom:24, borderBottom: i<notes.length-1 ? "1px solid #E5EAF0" : "none" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
                <div style={{ fontSize:14, fontWeight:800 }}>{note.name}</div>
                <div style={{ fontSize:11, color:"#9CA3AF" }}>{formatDate(note.createdAt)}</div>
              </div>
              {note.text && <div style={{ fontSize:12, lineHeight:1.6, whiteSpace:"pre-line", marginBottom: note.photos?.length ? 14 : 0 }}>{note.text}</div>}
              {note.photos && note.photos.length > 0 && (
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {note.photos.map((src,pi) => (
                    // Full photo, uncropped — scaled to fit the page while preserving its
                    // original aspect ratio (never stretched or cut off like a thumbnail crop).
                    <img key={pi} src={src} alt="" style={{ maxWidth: note.photos.length===1 ? "100%" : "48%", maxHeight:"220mm", width:"auto", height:"auto", objectFit:"contain", display:"block", borderRadius:6, border:"1px solid #E5EAF0" }} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        <div style={{ marginTop:20, paddingTop:14, borderTop:"1px solid #E5EAF0", fontSize:10, color:"#C4CAD4", textAlign:"center" }}>
          Notes exported {formatDate(todayISO())} — {job.id}
        </div>
      </div>
    </div>
  );
}

// ─── JOB SHEET PRINT VIEW ─────────────────────────────────────────────────────
function JobSheetPrintView({ job, staff, roles, customers, suppliers, timeEntries, purchaseOrders, company, settings, onClose }) {
  const assignedStaff = job.assignedTo.map(id => staff.find(s=>s.id===id)).filter(Boolean);
  const jobTimeEntries = timeEntries.filter(t=>t.jobId===job.id).sort((a,b)=> a.date<b.date?1:-1);
  const totalHours = jobTimeEntries.reduce((s,t)=>s+t.hours,0);
  const totalCost = jobTimeEntries.reduce((s,t)=>{ const rate = getRoleRates(staff.find(st=>st.id===t.staffId)?.roleId, roles).costRate; return s + t.hours*rate; },0);
  const jobPOs = purchaseOrders.filter(p=>p.jobId===job.id).sort((a,b)=> a.dateCreated<b.dateCreated?1:-1);
  const jobCosts = (job.jobCosts||[]).slice().sort((a,b)=> (a.createdAt||"").localeCompare(b.createdAt||""));
  const billedPOTotal = jobPOs.filter(po=>po.status==="billed").reduce((s,po)=>s+(po.billedCost||0),0);
  const additionalCostTotal = jobCosts.reduce((s,c)=>s+c.amount,0);
  const customFields = (settings?.jobCustomFields || []).filter(f => job.customFields && job.customFields[f.id]);
  const fields = settings?.jobSheetFields || {};
  const show = (key) => fields[key] !== false;
  const footerNote = (settings?.jobSheetFooterNote || "Job sheet generated {DATE} — {JOB}").replace("{JOB}", job.id).replace("{DATE}", formatDate(todayISO()));

  // Job Details grid is only rendered if at least one of its fields is enabled
  const detailFieldsOn = show("customer") || show("workOrderNo") || show("orderNo") || show("assignedStaff");

  return (
    <div style={{ position:"fixed", inset:0, background:"#5C6B82", zIndex:3000, overflowY:"auto" }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { width: 210mm; height: 297mm; }
          body * { visibility: hidden; }
          #job-sheet-print-area, #job-sheet-print-area * { visibility: visible; }
          #job-sheet-print-area {
            position: absolute; top: 0; left: 0;
            width: 210mm; min-height: 297mm; max-width: none;
            margin: 0; box-shadow: none;
            background: #fff !important; color: #1C2333 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print" style={{ position:"sticky", top:0, background:"#1C2333", padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", zIndex:10 }}>
        <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>Job Sheet — {job.id}</span>
        <div style={{ display:"flex", gap:10 }}>
                  <Btn onClick={() => window.print()}>🖨 Print</Btn>
                  <Btn variant="secondary" onClick={() => downloadElementAsPDF("job-sheet-print-area", `${job.id}-job-sheet.pdf`)}>⬇ Save as PDF</Btn>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </div>
      <div id="job-sheet-print-area" style={{ background:"#fff", width:"210mm", minHeight:"297mm", margin:"30px auto", padding:"18mm 16mm", boxSizing:"border-box", boxShadow:"0 4px 24px #00000030", fontFamily:"'Inter',system-ui,sans-serif", color:"#1C2333" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32, paddingBottom:20, borderBottom:"2px solid #1C2333" }}>
          <div>
            <div style={{ fontSize:20, fontWeight:900 }}>{company?.name || "Your Company Name"}</div>
            {company?.address && <div style={{ fontSize:11, color:"#5C6B82", marginTop:5, whiteSpace:"pre-line" }}>{company.address}</div>}
            {company?.phone && <div style={{ fontSize:11, color:"#5C6B82", marginTop:2 }}>{company.phone}</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:24, fontWeight:900, letterSpacing:1 }}>JOB SHEET</div>
            <div style={{ fontSize:14, fontWeight:700, color:ACCENT_TEXT, marginTop:6 }}>{job.id}</div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>Printed: {formatDate(todayISO())}</div>
          </div>
        </div>

        {/* Job details */}
        {(show("description") || detailFieldsOn || show("notes")) && (
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Job Details</div>
            {show("description") && <div style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>{job.title}</div>}
            {detailFieldsOn && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                {show("customer") && <div><div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase" }}>Customer</div><div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{job.client || "—"}</div></div>}
                {show("workOrderNo") && <div><div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase" }}>Work Order No</div><div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{job.workOrderNo || "—"}</div></div>}
                {show("orderNo") && <div><div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase" }}>Order No (PO)</div><div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{job.orderNo || "—"}</div></div>}
                {show("assignedStaff") && <div style={{ gridColumn:"span 2" }}><div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase" }}>Assigned Staff</div><div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{assignedStaff.length ? assignedStaff.map(s=>s.name).join(", ") : "Unassigned"}</div></div>}
              </div>
            )}
            {show("notes") && job.notes && (
              <div style={{ marginTop:14 }}>
                <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase" }}>Notes</div>
                <div style={{ fontSize:13, marginTop:3, whiteSpace:"pre-line" }}>{job.notes}</div>
              </div>
            )}
          </div>
        )}

        {/* Custom fields */}
        {show("customFields") && customFields.length > 0 && (
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Additional Details</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {customFields.map(f => (
                <div key={f.id}>
                  <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase" }}>{f.label}</div>
                  <div style={{ fontSize:13, fontWeight:600, marginTop:2, whiteSpace:"pre-line" }}>{job.customFields[f.id]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time logged */}
        {show("timeLogged") && (
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Time Logged</div>
            {jobTimeEntries.length === 0 ? (
              <div style={{ fontSize:12, color:"#9CA3AF" }}>No time logged against this job.</div>
            ) : (
              <>
                <table style={{ borderCollapse:"collapse", width:"100%", fontSize:12, marginBottom:10 }}>
                  <thead>
                    <tr style={{ background:"#F8FAFC" }}>
                      {["Date","Staff","Time","Hours"].map(h=>(
                        <th key={h} style={{ padding:"6px 8px", textAlign:h==="Hours"?"right":"left", fontWeight:700, color:"#5C6B82", borderBottom:"1px solid #E5EAF0", fontSize:10, textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobTimeEntries.map(t => {
                      const st = staff.find(s=>s.id===t.staffId);
                      return (
                        <tr key={t.id} style={{ borderBottom:"1px solid #F1F4F8" }}>
                          <td style={{ padding:"6px 8px", color:"#5C6B82" }}>{formatDate(t.date)}</td>
                          <td style={{ padding:"6px 8px" }}>{st?.name || "—"}</td>
                          <td style={{ padding:"6px 8px", color:"#9CA3AF" }}>{formatTimeRange(t.startTime, t.endTime) || "—"}</td>
                          <td style={{ padding:"6px 8px", textAlign:"right", fontWeight:600 }}>{t.hours}h</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"#F0FDF4" }}>
                      <td colSpan={3} style={{ padding:"7px 8px", fontWeight:800, color:"#065F46", fontSize:10, textTransform:"uppercase" }}>Total Hours</td>
                      <td style={{ padding:"7px 8px", textAlign:"right", fontWeight:800 }}>{totalHours}h</td>
                    </tr>
                  </tfoot>
                </table>
                <div style={{ display:"flex", gap:20 }}>
                  <div style={{ fontSize:12, color:"#5C6B82" }}>Total Cost: <strong style={{ color:"#065F46" }}>${totalCost.toFixed(2)}</strong></div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Purchase orders */}
        {show("costs") && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Costs</div>

            <div style={{ fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", marginBottom:6 }}>Purchase Orders</div>
            {jobPOs.length === 0 ? (
              <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:14 }}>No purchase orders raised for this job.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                {jobPOs.map(po => {
                  const supplier = suppliers.find(s=>s.id===po.supplierId);
                  return (
                    <div key={po.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, borderBottom:"1px solid #F1F4F8", padding:"4px 0" }}>
                      <span><strong style={{  }}>{po.poNumber}</strong> — {supplier?.name || "Unknown supplier"}{po.reference ? ` (${po.reference})` : ""}</span>
                      <span style={{ color: po.status==="billed" ? "#065F46" : "#92400E", fontWeight:700 }}>{po.status==="billed" ? `$${po.billedCost?.toFixed(2)}` : "Unbilled"}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", marginBottom:6 }}>Additional Costs (Materials, Consumables, etc.)</div>
            {jobCosts.length === 0 ? (
              <div style={{ fontSize:12, color:"#9CA3AF" }}>No additional costs recorded for this job.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {jobCosts.map(cost => (
                  <div key={cost.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, borderBottom:"1px solid #F1F4F8", padding:"4px 0" }}>
                    <span>{cost.label}</span>
                    <span style={{ color:"#065F46", fontWeight:700 }}>${cost.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {show("costs") && (totalCost > 0 || billedPOTotal > 0 || additionalCostTotal > 0) && (
          <div style={{ marginBottom:20, background:"#F0FDF4", border:"1px solid #A7F3D0", borderRadius:8, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#065F46", textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Total Cost</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#065F46" }}>
                <span>Costs Total (Purchase Orders + Additional)</span><span>${(billedPOTotal + additionalCostTotal).toFixed(2)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#065F46" }}>
                <span>Labour Total</span><span>${totalCost.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:900, color:"#065F46", marginTop:10, paddingTop:10, borderTop:"1px solid #A7F3D0" }}>
              <span>Total</span><span>${(totalCost + billedPOTotal + additionalCostTotal).toFixed(2)}</span>
            </div>
          </div>
        )}

        <div style={{ marginTop:40, paddingTop:14, borderTop:"1px solid #E5EAF0", fontSize:10, color:"#C4CAD4", textAlign:"center" }}>
          {footerNote}
        </div>
      </div>
    </div>
  );
}

// ─── JOB FORM MODAL ───────────────────────────────────────────────────────────
// ─── JOB NOTES (text + photos, camera or gallery) ────────────────────────────
function PhotoLightbox({ src, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#000000CC", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", padding:24, cursor:"zoom-out" }}>
      <img src={src} alt="" style={{ maxWidth:"90vw", maxHeight:"90vh", borderRadius:8, boxShadow:"0 10px 40px #00000060" }} />
      <button onClick={onClose} style={{ position:"absolute", top:20, right:24, background:"none", border:"none", color:"#fff", fontSize:28, cursor:"pointer", lineHeight:1 }}>×</button>
    </div>
  );
}

function NoteEditorModal({ note, onSave, onDelete, onClose }) {
  const [name, setName] = useState(note?.name || "");
  const [text, setText] = useState(note?.text || "");
  const [photos, setPhotos] = useState(note?.photos || []);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    const urls = await Promise.all(files.map(fileToDataURL));
    setPhotos(prev => [...prev, ...urls]);
  };
  const removePhoto = (i) => setPhotos(prev => prev.filter((_,idx) => idx!==i));

  const save = () => {
    if (!name.trim()) { setError("Give this note a name."); return; }
    onSave({
      id: note?.id || nuid(),
      name: name.trim(),
      text: text.trim(),
      photos,
      createdAt: note?.createdAt || todayISO(),
    });
  };

  return (
    <Modal title={note ? "Edit Note" : "Add Note"} onClose={onClose}>
      {confirmingDelete ? (
        <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>Delete this note?</div>
          <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>"{note.name}" and any attached photos will be permanently deleted.</div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={()=>setConfirmingDelete(false)}>Cancel</Btn>
            <Btn variant="danger" onClick={()=>onDelete(note.id)}>Yes, Delete</Btn>
          </div>
        </div>
      ) : (
        <>
          <Inp label="Note Name" value={name} onChange={e=>{ setName(e.target.value); if(error) setError(""); }} placeholder="e.g. Site inspection, Damage found" style={error?{ borderColor:"#EF4444" }:{}} autoFocus/>
          {error && <div style={{ fontSize:12, color:"#DC2626", marginTop:-10, marginBottom:14 }}>{error}</div>}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Note</label>
            <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} placeholder="Write what happened, what was found, next steps..." style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,background:"var(--bg-subtle)",boxSizing:"border-box",resize:"vertical",outline:"none",color:"var(--text-primary)" }}/>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>Photos</label>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e=>{ addFiles(e.target.files); e.target.value=""; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>{ addFiles(e.target.files); e.target.value=""; }} />
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <Btn variant="secondary" style={{ padding:"7px 14px", fontSize:12 }} onClick={()=>cameraRef.current?.click()}>📷 Take Photo</Btn>
              <Btn variant="secondary" style={{ padding:"7px 14px", fontSize:12 }} onClick={()=>galleryRef.current?.click()}>🖼 Add from Gallery</Btn>
            </div>
            {photos.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {photos.map((src,i) => (
                  <div key={i} style={{ position:"relative", width:76, height:76 }}>
                    <img src={src} alt="" onClick={()=>setLightbox(src)} style={{ width:76, height:76, objectFit:"cover", borderRadius:8, border:"1px solid var(--border)", cursor:"zoom-in" }} />
                    <button onClick={()=>removePhoto(i)} style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#EF4444", color:"#fff", border:"2px solid var(--card-bg)", fontSize:12, lineHeight:1, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"space-between" }}>
            <div>{note && <Btn variant="danger" onClick={()=>setConfirmingDelete(true)}>Delete Note</Btn>}</div>
            <div style={{ display:"flex",gap:10 }}>
              <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
              <Btn onClick={save}>Save Note</Btn>
            </div>
          </div>
        </>
      )}
      {lightbox && <PhotoLightbox src={lightbox} onClose={()=>setLightbox(null)} />}
    </Modal>
  );
}

function JobNotesPage({ job, setJobs, company, onBack }) {
  const [editingNote, setEditingNote] = useState(null); // null | "new" | note object
  const [lightbox, setLightbox] = useState(null);
  const [exporting, setExporting] = useState(false);
  const notes = (job.jobNotes || []).slice().sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));

  const saveNote = (note) => {
    setJobs(prev => prev.map(j => {
      if (j.id !== job.id) return j;
      const existing = (j.jobNotes || []);
      const idx = existing.findIndex(n => n.id === note.id);
      const nextNotes = idx >= 0 ? existing.map((n,i)=>i===idx?note:n) : [...existing, note];
      return { ...j, jobNotes: nextNotes };
    }));
    setEditingNote(null);
  };
  const deleteNote = (noteId) => {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, jobNotes: (j.jobNotes||[]).filter(n=>n.id!==noteId) } : j));
    setEditingNote(null);
  };

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, marginBottom:14, display:"flex", alignItems:"center", gap:5 }}>← Back to Job</button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>Notes & Photos</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:14, margin:0 }}>{job.id} · {notes.length} note{notes.length!==1?"s":""}</p>
        </div>
              <div style={{ display: "flex", gap: 10 }}>
                  <Btn variant="secondary" onClick={() => setExporting(true)} disabled={notes.length === 0}>⬇ Export Notes</Btn>
                  <Btn variant="secondary" onClick={() => exportPhotosZip(job)} disabled={!notes.some(n => (n.photos || []).length > 0)}>⬇ Download Photos</Btn>
                  <Btn onClick={() => setEditingNote("new")}>+ Add Note</Btn>
              </div>
      </div>

      {notes.length === 0 ? (
        <div style={{ background:"var(--card-bg)", borderRadius:14, padding:40, textAlign:"center", color:"var(--text-muted)" }}>No notes yet. Add written notes and photos as you go.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {notes.map(note => (
            <div key={note.id} style={{ background:"var(--card-bg)", borderRadius:12, padding:18, boxShadow:"0 1px 4px #1C233310" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:note.text||note.photos?.length?10:0 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)" }}>{note.name}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{formatDate(note.createdAt)}</div>
                </div>
                <Btn variant="secondary" style={{ padding:"5px 12px", fontSize:12 }} onClick={()=>setEditingNote(note)}>Edit</Btn>
              </div>
              {note.text && <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.5, whiteSpace:"pre-line", marginBottom:note.photos?.length?12:0 }}>{note.text}</div>}
              {note.photos && note.photos.length > 0 && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {note.photos.map((src,i) => (
                    <img key={i} src={src} alt="" onClick={()=>setLightbox(src)} style={{ width:88, height:88, objectFit:"cover", borderRadius:8, border:"1px solid var(--border)", cursor:"zoom-in" }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingNote && (
        <NoteEditorModal note={editingNote==="new"?null:editingNote} onSave={saveNote} onDelete={deleteNote} onClose={()=>setEditingNote(null)} />
      )}
      {lightbox && <PhotoLightbox src={lightbox} onClose={()=>setLightbox(null)} />}
      {exporting && <NotesPrintView job={job} company={company} onClose={()=>setExporting(false)} />}
    </div>
  );
}

// ─── JOB TIME ALLOCATED PAGE ──────────────────────────────────────────────────
function JobTimePage({ job, staff, roles, timeEntries, onBack }) {
  const jobTimeEntries = (timeEntries||[]).filter(t=>t.jobId===job.id).sort((a,b)=> a.date<b.date?1:-1);
  const totalHours = jobTimeEntries.reduce((s,t)=>s+t.hours,0);
  const totalCost = jobTimeEntries.reduce((s,t)=>{ const rate = getRoleRates(staff.find(st=>st.id===t.staffId)?.roleId, roles).costRate; return s + t.hours*rate; },0);

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, marginBottom:14, display:"flex", alignItems:"center", gap:5 }}>← Back to Job</button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>Time Allocated</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:14, margin:0 }}>{job.id} · {job.title}</p>
        </div>
        {jobTimeEntries.length>0 && <div style={{ fontSize:15, fontWeight:800, color:"#065F46" }}>{totalHours}h · ${totalCost.toFixed(2)}</div>}
      </div>
      {jobTimeEntries.length===0 ? (
        <div style={{ background:"var(--card-bg)", borderRadius:14, padding:40, textAlign:"center", color:"var(--text-muted)" }}>No time logged against this job yet. Log time from the Timesheets tab.</div>
      ) : (
        <div style={{ background:"var(--card-bg)", borderRadius:14, boxShadow:"0 1px 4px #1C233310", overflow:"hidden" }}>
          <table style={{ borderCollapse:"collapse", width:"100%", fontSize:13 }}>
            <thead>
              <tr style={{ background:"var(--bg-subtle)" }}>
                {["Date","Staff","Time","Hours","Rate","Cost"].map(h=>(
                  <th key={h} style={{ padding:"10px 14px", textAlign:h==="Hours"||h==="Rate"||h==="Cost"?"right":"left", fontWeight:700, color:"var(--text-secondary)", borderBottom:"1px solid var(--border)", fontSize:11, textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobTimeEntries.map(t=>{
                const st = staff.find(s=>s.id===t.staffId);
                const rate = getRoleRates(st?.roleId, roles).costRate;
                return (
                  <tr key={t.id} style={{ borderBottom:"1px solid #F1F4F8" }}>
                    <td style={{ padding:"10px 14px", color:"var(--text-secondary)" }}>{formatDate(t.date)}</td>
                    <td style={{ padding:"10px 14px" }}>
                      {st ? <span style={{ display:"flex", alignItems:"center", gap:6 }}><Avatar name={st.name} color={st.color} size={20}/>{st.name}</span> : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", color:"var(--text-muted)" }}>{formatTimeRange(t.startTime, t.endTime) || "—"}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"var(--text-primary)", fontWeight:600 }}>{t.hours}h</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"var(--text-muted)" }}>${rate}/hr</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#065F46", fontWeight:700 }}>${(t.hours*rate).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:"#F0FDF4" }}>
                <td colSpan={3} style={{ padding:"10px 14px", fontWeight:800, color:"#065F46", fontSize:11, textTransform:"uppercase" }}>Total</td>
                <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:800, color:"var(--text-primary)" }}>{totalHours}h</td>
                <td></td>
                <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:800, color:"#065F46" }}>${totalCost.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── JOB COSTS (PURCHASE ORDERS) PAGE ─────────────────────────────────────────
function AddCostRow({ onAdd, onCancel }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    const val = parseFloat(amount);
    if (!label.trim()) { setError("Give this cost a label, e.g. Materials."); return; }
    if (isNaN(val) || val < 0) { setError("Enter a valid amount."); return; }
    onAdd({ id: "jc"+Date.now(), label: label.trim(), amount: val, createdAt: todayISO() });
  };

  return (
    <div style={{ background:"var(--bg-subtle)", border:"1px solid var(--border)", borderRadius:10, padding:14, marginBottom:10 }}>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"0 12px" }}>
        <Inp label="Label" value={label} onChange={e=>{ setLabel(e.target.value); if(error) setError(""); }} placeholder="e.g. Materials — steel plate" autoFocus/>
        <Inp label="Amount ($)" type="number" step="0.01" min="0" value={amount} onChange={e=>{ setAmount(e.target.value); if(error) setError(""); }} placeholder="e.g. 450.00"/>
      </div>
      {error && <div style={{ fontSize:12, color:"#DC2626", marginTop:-8, marginBottom:12 }}>{error}</div>}
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <Btn variant="secondary" style={{ padding:"7px 14px", fontSize:12 }} onClick={onCancel}>Cancel</Btn>
        <Btn style={{ padding:"7px 14px", fontSize:12 }} onClick={save}>Add Cost</Btn>
      </div>
    </div>
  );
}

function JobCostsPage({ jobs, bills, setBills, job, suppliers, purchaseOrders, setPurchaseOrders, setJobs, company, settings, onBack }) {
    const [showPOModal, setShowPOModal] = useState(false);
    const [printingPO, setPrintingPO] = useState(null);
    const deletePO = (poId) => { setPurchaseOrders(prev => prev.filter(p => p.id !== poId)); setDeletingPO(null); };
    const [billingPO, setBillingPO] = useState(null);
    const [deletingPO, setDeletingPO] = useState(null);const [editingPO, setEditingPO] = useState(null);
  const [billFormPO, setBillFormPO] = useState(null);
  const [addingCost, setAddingCost] = useState(false);
  const [billFormCost, setBillFormCost] = useState(null);
  const jobPOs = (purchaseOrders||[]).filter(p=>p.jobId===job.id).sort((a,b)=> a.dateCreated<b.dateCreated?1:-1);
  const jobCosts = (job.jobCosts||[]).slice().sort((a,b)=> a.createdAt<b.createdAt?1:-1);
  const addPO = (po) => { setPurchaseOrders(prev=>[...prev, { ...po, poNumber: nextPONumber(prev) }]); setShowPOModal(false); };
  const updatePO = (updated) => { setPurchaseOrders(prev=>prev.map(p=>p.id===updated.id?updated:p)); setBillingPO(null); if (updated.status === "billed") { setBills(prev => prev.map(b => b.poId === updated.id && b.amount !== updated.billedCost ? { ...b, amount: updated.billedCost } : b)); if (!bills.some(b => b.poId === updated.id)) setBillFormPO(updated); } };
    const addCost = (cost) => { setJobs(prev => prev.map(j => j.id === job.id ? { ...j, jobCosts: [...(j.jobCosts || []), cost] } : j)); setAddingCost(false); };
  const removeCost = (costId) => setJobs(prev=>prev.map(j=>j.id===job.id?{...j, jobCosts:(j.jobCosts||[]).filter(c=>c.id!==costId)}:j));

  const billedPOTotal = jobPOs.filter(po=>po.status==="billed").reduce((s,po)=>s+(po.billedCost||0),0);
  const additionalCostTotal = jobCosts.reduce((s,c)=>s+c.amount,0);
  const grandTotal = billedPOTotal + additionalCostTotal;

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, marginBottom:14, display:"flex", alignItems:"center", gap:5 }}>← Back to Job</button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>Costs</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:14, margin:0 }}>{job.id} · {job.title}</p>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0.5 }}>Total Costs</div>
          <div style={{ fontSize:22, fontWeight:900, color:"#065F46" }}>${grandTotal.toFixed(2)}</div>
        </div>
      </div>

      {/* Purchase Orders */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <label style={{ fontSize:12,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:0.5 }}>Purchase Orders</label>
          <Btn variant="secondary" style={{ padding:"6px 14px", fontSize:12 }} onClick={()=>setShowPOModal(true)}>+ Create Purchase Order</Btn>
        </div>
        {jobPOs.length===0 ? (
          <div style={{ background:"var(--card-bg)", borderRadius:14, padding:30, textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>No purchase orders raised for this job yet.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {jobPOs.map(po => {
              const supplier = suppliers.find(s=>s.id===po.supplierId);
              return (
                <div key={po.id} style={{ background:"var(--card-bg)", borderRadius:12, boxShadow:"0 1px 4px #1C233310", display:"flex", alignItems:"center", gap:14, padding:"14px 18px" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>{po.poNumber} <span style={{ fontWeight:500, color:"var(--text-muted)" }}>· {supplier?.name || "Unknown supplier"}</span></div>
                    <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2 }}>{po.reference || po.details.slice(0,70)}</div>
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{formatDate(po.dateCreated)}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <POStatusBadge po={po} onClick={() => setBillingPO(po)} />
                  {po.status === "billed" && <button onClick={() => setBillFormPO(po)} style={{ background:"none", border:"1.5px solid var(--border-strong)", borderRadius:99, padding:"3px 10px", fontSize:11, fontWeight:700, color: bills.some(b => b.poId === po.id) ? "#10B981" : ACCENT_TEXT, cursor:"pointer" }}>{bills.some(b => b.poId === po.id) ? "Bill ✓" : "+ Bill"}</button>}
                </div>
                        <Btn variant="secondary" onClick={() => setPrintingPO(po)}>View / Print</Btn>
                        <Btn variant="secondary" onClick={() => setEditingPO(po)}>Edit</Btn>
                        <Btn variant="danger" onClick={() => setDeletingPO(po)}>Delete</Btn>
                    </div>
                );
            })}
            {billedPOTotal > 0 && (
              <div style={{ display:"flex", justifyContent:"flex-end", fontSize:12, color:"var(--text-secondary)", paddingRight:4 }}>
                Billed PO total: <strong style={{ marginLeft:6, color:"#065F46" }}>${billedPOTotal.toFixed(2)}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Additional costs (materials etc.) */}
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <label style={{ fontSize:12,fontWeight:700,color:"var(--text-secondary)",textTransform:"uppercase",letterSpacing:0.5 }}>Additional Costs</label>
          {!addingCost && <Btn variant="secondary" style={{ padding:"6px 14px", fontSize:12 }} onClick={()=>setAddingCost(true)}>+ Add Cost</Btn>}
        </div>
        {addingCost && <AddCostRow onAdd={addCost} onCancel={()=>setAddingCost(false)} />}
        {jobCosts.length===0 ? (
          <div style={{ background:"var(--card-bg)", borderRadius:14, padding:30, textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>No additional costs (materials, consumables, etc.) added yet.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {jobCosts.map(cost => (
              <div key={cost.id} style={{ background:"var(--card-bg)", borderRadius:10, boxShadow:"0 1px 4px #1C233310", display:"flex", alignItems:"center", gap:14, padding:"12px 16px" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{cost.label}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{formatDate(cost.createdAt)}</div>
                </div>
                <div style={{ fontSize:14, fontWeight:800, color:"#065F46" }}>${cost.amount.toFixed(2)}</div>
                <button onClick={() => setBillFormCost(cost)} style={{ background:"none", border:"1.5px solid var(--border-strong)", borderRadius:99, padding:"3px 10px", fontSize:11, fontWeight:700, color: bills.some(b => b.costId === cost.id) ? "#10B981" : ACCENT_TEXT, cursor:"pointer" }}>{bills.some(b => b.costId === cost.id) ? "Bill ✓" : "+ Bill"}</button>
                <button onClick={()=>removeCost(cost.id)} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:16, cursor:"pointer", lineHeight:1, padding:0 }}>×</button>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"flex-end", fontSize:12, color:"var(--text-secondary)", paddingRight:4 }}>
              Additional costs total: <strong style={{ marginLeft:6, color:"#065F46" }}>${additionalCostTotal.toFixed(2)}</strong>
            </div>
          </div>
        )}
      </div>

      {billingPO && (
        <BillPOModal po={billingPO} onSave={updatePO} onClose={()=>setBillingPO(null)} />
      )}
      {billFormCost && <CostBillModal cost={billFormCost} job={job} bills={bills} setBills={setBills} setJobs={setJobs} suppliers={suppliers} jobs={jobs} purchaseOrders={purchaseOrders} onClose={() => setBillFormCost(null)} />}
      {showPOModal && (
        <PurchaseOrderModal job={job} suppliers={suppliers} purchaseOrders={purchaseOrders} onSave={addPO} onClose={()=>setShowPOModal(false)} />
      )}
            {billFormPO && <POBillModal po={billFormPO} bills={bills} setBills={setBills} setPurchaseOrders={setPurchaseOrders} suppliers={suppliers} jobs={jobs} purchaseOrders={purchaseOrders} onClose={() => setBillFormPO(null)} />}
            {editingPO && <PurchaseOrderModal job={{ id: editingPO.jobId, title: "" }} suppliers={suppliers} purchaseOrders={purchaseOrders} editingPO={editingPO} onSave={(u) => { setPurchaseOrders(prev => prev.map(p => p.id === u.id ? u : p)); setEditingPO(null); }} onClose={() => setEditingPO(null)} />}{printingPO && (
                <POPrintView po={printingPO} job={job} supplier={suppliers.find(s => s.id === printingPO.supplierId)} company={company} settings={settings} onClose={() => setPrintingPO(null)} />
            )}
            {deletingPO && (
                <Modal title={`Delete ${deletingPO.poNumber}?`} onClose={() => setDeletingPO(null)}>
                    <div style={{ background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>This can't be undone.</div>
                        <div style={{ fontSize: 13, color: "#7F1D1D", marginBottom: 16 }}>{deletingPO.poNumber} will be permanently deleted{deletingPO.status === "billed" ? ", including its billed cost record" : ""}.</div>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <Btn variant="secondary" onClick={() => setDeletingPO(null)}>Cancel</Btn>
                            <Btn variant="danger" onClick={() => deletePO(deletingPO.id)}>Yes, Delete</Btn>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
function CustomerPicker({ customers, value, onChange, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const q = query.trim().toLowerCase();
  const allMatches = customers
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const matches = allMatches.slice(0, 50);

  const choose = (name) => { onChange(name); setOpen(false); setQuery(""); };
  const addNew = () => { setOpen(false); onAddNew(query.trim()); setQuery(""); };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, matches.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (!open) return; if (hi < matches.length) choose(matches[hi].name); else addNew(); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  return (
    <div style={{ position:"relative" }}>
      <input
        value={open ? query : value}
        placeholder="Search customers…"
        onFocus={() => { setOpen(true); setQuery(""); setHi(0); }}
        onBlur={() => { setOpen(false); setQuery(""); }}
        onChange={e => { setQuery(e.target.value); setHi(0); setOpen(true); }}
        onKeyDown={onKeyDown}
        style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 32px 9px 12px", fontSize:14, color:"var(--text-primary)", outline:"none", background:"var(--bg-subtle)", boxSizing:"border-box" }}
      />
      {value && !open && (
        <button onMouseDown={e => { e.preventDefault(); onChange(""); }} title="Clear customer"
          style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-muted)", fontSize:16, cursor:"pointer", lineHeight:1, padding:4 }}>×</button>
      )}
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:600, marginTop:4, background:"var(--card-bg)", border:"1.5px solid var(--border-strong)", borderRadius:8, boxShadow:"0 8px 24px #00000030", maxHeight:260, overflowY:"auto" }}>
          {matches.map((c, i) => (
            <div key={c.id}
              onMouseDown={e => { e.preventDefault(); choose(c.name); }}
              onMouseEnter={() => setHi(i)}
              style={{ padding:"9px 12px", fontSize:14, cursor:"pointer", color:"var(--text-primary)", background: hi === i ? "var(--bg-subtle2)" : "transparent", fontWeight: c.name === value ? 700 : 500 }}>
              {c.name}
            </div>
          ))}
          {allMatches.length > 50 && <div style={{ padding:"8px 12px", fontSize:11, color:"var(--text-muted)" }}>Showing first 50 of {allMatches.length} — keep typing to narrow down.</div>}
          {q && matches.length === 0 && <div style={{ padding:"8px 12px", fontSize:12, color:"var(--text-muted)" }}>No customers match "{query.trim()}".</div>}
          <div
            onMouseDown={e => { e.preventDefault(); addNew(); }}
            onMouseEnter={() => setHi(matches.length)}
            style={{ padding:"10px 12px", fontSize:13, fontWeight:700, cursor:"pointer", color:ACCENT_TEXT, borderTop:"1px solid var(--border)", background: hi === matches.length ? "var(--bg-subtle2)" : "transparent" }}>
            {q ? `+ Add "${query.trim()}" as new customer` : "+ Add new customer…"}
          </div>
        </div>
      )}
    </div>
  );
}
function QuickAddCustomerModal({ customers, initialName, onSave, onClose }) {
  const [draft, setDraft] = useState({ name: initialName || "", contactPerson:"", phone:"", email:"", address:"" });  const [error, setError] = useState("");
  const save = () => {
    const name = draft.name.trim();
    if (!name) { setError("Customer name is required."); return; }
    if (customers.some(c => c.name.toLowerCase() === name.toLowerCase())) { setError("A customer with this name already exists. Pick them from the list instead."); return; }
    onSave({ id: cuid(), ...draft, name });
  };
  return (
    <Modal title="Add New Customer" onClose={onClose}>
      <Inp label="Name" value={draft.name} onChange={e=>{ setDraft(p=>({...p,name:e.target.value})); if(error) setError(""); }} placeholder="Company name" autoFocus/>
      {error && <div style={{ fontSize:12, color:"#DC2626", marginTop:-10, marginBottom:14 }}>{error}</div>}
      <Inp label="Contact Person" value={draft.contactPerson} onChange={e=>setDraft(p=>({...p,contactPerson:e.target.value}))} placeholder="e.g. Jane Smith"/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <Inp label="Phone" value={draft.phone} onChange={e=>setDraft(p=>({...p,phone:e.target.value}))} placeholder="e.g. 07 3000 0000"/>
        <Inp label="Email" type="email" value={draft.email} onChange={e=>setDraft(p=>({...p,email:e.target.value}))} placeholder="e.g. contact@company.com"/>
      </div>
      <div style={{ marginBottom:20 }}>
        <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Address</label>
        <textarea value={draft.address} onChange={e=>setDraft(p=>({...p,address:e.target.value}))} rows={2} placeholder="Street, suburb, state, postcode" style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,background:"var(--bg-subtle)",boxSizing:"border-box",resize:"vertical",outline:"none",color:"var(--text-primary)" }}/>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Add Customer</Btn>
      </div>
    </Modal>
  );
}
function JobDetailPage({ job, staff, roles, customers, setCustomers, suppliers, timeEntries, purchaseOrders, setPurchaseOrders, invoices, quotes, company, settings, onSave, onBack, onDelete, onOpenNotes, onOpenTime, onOpenCosts, onOpenInvoices, onOpenQuotes }) {  const isNew = !job;
  const [form, setForm] = useState(job || { id: nextJobNumberFromSettings(settings) || uid(), title:"", client:"", workOrderNo:"", orderNo:"", status:"not-started", assignedTo:[], holdReason:"", holdSince:null, followUpNote:"", followUpSince:null, notes:"", customFields:{}, jobNotes:[], jobCosts:[] });
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [printingJobSheet, setPrintingJobSheet] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setCustomField = (id,v) => setForm(f=>({...f, customFields:{ ...(f.customFields||{}), [id]:v } }));
  const toggleStaff = (id) => set("assignedTo", form.assignedTo.includes(id)?form.assignedTo.filter(x=>x!==id):[...form.assignedTo,id]);
  const handleSave = () => {
    if (!form.title.trim()) { setError("Job description is required."); return; }
    const saved={...form};
    if(saved.status==="on-hold"&&!saved.holdSince) saved.holdSince=d(0);
    if(saved.status!=="on-hold"){saved.holdSince=null;saved.holdReason="";}
    if(saved.status==="follow-up"&&!saved.followUpSince) saved.followUpSince=d(0);
    if(saved.status!=="follow-up"){saved.followUpSince=null;saved.followUpNote="";}
    onSave(saved);
  };

      const jobTimeEntries = isNew ? [] : (timeEntries||[]).filter(t=>t.jobId===job.id);
    const totalHours = jobTimeEntries.reduce((s,t)=>s+t.hours,0);
    const totalCost = jobTimeEntries.reduce((s,t)=>{ const rate = getRoleRates(staff.find(st=>st.id===t.staffId)?.roleId, roles).costRate; return s + t.hours*rate; },0);
    const jobPOs = isNew ? [] : (purchaseOrders||[]).filter(p=>p.jobId===job.id);
    const jobInvoices = isNew ? [] : (invoices||[]).filter(i=>i.jobId===job.id);
    const jobInvoicesTotal = jobInvoices.reduce((s,i)=>s+i.total,0);
    const jobQuotes = isNew ? [] : (quotes||[]).filter(q=>q.jobId===job.id);
    const jobNoteCount = isNew ? 0 : (job.jobNotes||[]).length;
    const billedPOTotal = jobPOs.filter(po=>po.status==="billed").reduce((s,po)=>s+(po.billedCost||0),0);
    const additionalCostTotal = isNew ? 0 : (job.jobCosts||[]).reduce((s,c)=>s+c.amount,0);
    const totalCosts = billedPOTotal + additionalCostTotal;

  return (
    <div style={{ maxWidth: 860 }}>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, marginBottom:14, display:"flex", alignItems:"center", gap:5 }}>← Back to Jobs</button>

      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:28, boxShadow:"0 1px 4px #1C233310" }}>
        {confirmingDelete ? (
          <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>Delete {job.id}?</div>
            <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>"{job.title}" will be permanently deleted. This can't be undone.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={()=>setConfirmingDelete(false)}>Cancel</Btn>
              <Btn variant="danger" onClick={()=>onDelete(job.id)}>Yes, Delete</Btn>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize:22, fontWeight:900, color:"var(--text-primary)", margin:"0 0 20px" }}>{isNew ? "New Job" : `Edit — ${job.id}`}</h1>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
              <Inp label="Job Number" value={form.id} onChange={e=>set("id",e.target.value)} placeholder="e.g. JOB-101"/>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Customer</label>
                <CustomerPicker customers={customers} value={form.client} onChange={v=>set("client", v)} onAddNew={(name)=>setAddingCustomer(name || true)} />
              </div>
              <Inp label="Work Order No" value={form.workOrderNo||""} onChange={e=>set("workOrderNo",e.target.value)} placeholder="e.g. WO-2201"/>
              <Inp label="Order No (PO)" value={form.orderNo||""} onChange={e=>set("orderNo",e.target.value)} placeholder="e.g. PO-4401"/>
              <div style={{ gridColumn:"1/-1" }}>
                <Inp label="Description" value={form.title} onChange={e=>{ set("title",e.target.value); if(error) setError(""); }} placeholder="Job description" style={error?{ borderColor:"#EF4444" }:{}}/>
                {error && <div style={{ fontSize:12, color:"#DC2626", marginTop:-10, marginBottom:14 }}>{error}</div>}
              </div>
              <Sel label="Status" value={form.status} onChange={e=>set("status",e.target.value)} options={[{value:"not-started",label:"Not Started"},{value:"in-progress",label:"In Progress"},{value:"on-hold",label:"On Hold"},{value:"follow-up",label:"Follow Up"},{value:"ready-to-assemble",label:"Ready to Assemble"},{value:"completed",label:"Completed"}, ...Object.entries(STATUS_META).filter(([k])=>k.startsWith("cs_")).map(([k,m])=>({value:k,label:m.label}))]}/>
            </div>
            {!isNew && (
              <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
                <Btn variant="secondary" onClick={()=>setPrintingJobSheet(true)}>🖨 Print Job Sheet</Btn>
              </div>
            )}
            {form.status==="on-hold"&&(
              <div style={{ background:"#FFF8EC",border:"1.5px solid #FDE68A",borderRadius:8,padding:14,marginBottom:14 }}>
                <div style={{ marginBottom:8 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:700,color:"#92400E",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Reason for Hold</label>
                                      <textarea value={form.holdReason} onChange={e => set("holdReason", e.target.value)} rows={2} placeholder="Why is this job on hold?" style={{ width: "100%", border: "1.5px solid #FDE68A", borderRadius: 7, padding: "8px 10px", fontSize: 13, background: "var(--card-bg)", boxSizing: "border-box", resize: "vertical", outline: "none", color: "var(--text-primary)", fontFamily: "'Inter',system-ui,sans-serif" }} />
                </div>
                <Inp label="On Hold Since" type="date" value={form.holdSince||d(0)} onChange={e=>set("holdSince",e.target.value)} style={{ marginBottom:0 }}/>
              </div>
            )}
            {form.status==="follow-up"&&(
              <div style={{ background:"#FDF2F8",border:"1.5px solid #FBCFE8",borderRadius:8,padding:14,marginBottom:14 }}>
                <div style={{ marginBottom:8 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:700,color:"#9D174D",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Follow Up Note</label>
                                      <textarea value={form.followUpNote} onChange={e => set("followUpNote", e.target.value)} rows={2} placeholder="What are you following up on?" style={{ width: "100%", border: "1.5px solid #FBCFE8", borderRadius: 7, padding: "8px 10px", fontSize: 13, background: "var(--card-bg)", boxSizing: "border-box", resize: "vertical", outline: "none", color: "var(--text-primary)", fontFamily: "'Inter',system-ui,sans-serif" }} />
                </div>
                <Inp label="Follow Up Since" type="date" value={form.followUpSince||d(0)} onChange={e=>set("followUpSince",e.target.value)} style={{ marginBottom:0 }}/>
              </div>
            )}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>Assigned Staff</label>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {staff.map(s=>(
                  <button key={s.id} onClick={()=>toggleStaff(s.id)} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:7,border:"1.5px solid",borderColor:form.assignedTo.includes(s.id)?s.color:"var(--border-strong)",background:form.assignedTo.includes(s.id)?s.color+"18":"var(--card-bg)",color:form.assignedTo.includes(s.id)?s.color:"var(--text-secondary)",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .1s" }}>
                    <Avatar name={s.name} color={s.color} size={20}/>{s.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            {settings?.jobCustomFields?.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>Additional Details</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
                  {settings.jobCustomFields.map(f => (
                    <div key={f.id} style={f.type==="textarea" ? { gridColumn:"1/-1", marginBottom:14 } : {}}>
                      {f.type==="textarea" ? (
                        <>
                          <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>{f.label}</label>
                          <textarea value={(form.customFields||{})[f.id]||""} onChange={e=>setCustomField(f.id,e.target.value)} rows={2} style={{ width:"100%",border:"1.5px solid var(--border-strong)",borderRadius:8,padding:"9px 12px",fontSize:14,background:"var(--bg-subtle)",boxSizing:"border-box",resize:"vertical",outline:"none",color:"var(--text-primary)" }}/>
                        </>
                      ) : (
                        <Inp label={f.label} type={f.type==="number"?"number":f.type==="date"?"date":"text"} value={(form.customFields||{})[f.id]||""} onChange={e=>setCustomField(f.id,e.target.value)}/>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-pages: Time Allocated / Notes & Photos / Costs, each opens its own page */}
                        {!isNew && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                <button onClick={onOpenTime} style={{ textAlign: "left", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>⏱ Time Allocated</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{totalHours}h</div>
                  <div style={{ fontSize: 12, color: "#065F46", fontWeight: 600, marginTop: 2 }}>${totalCost.toFixed(2)}</div>
                </button>
                <button onClick={onOpenNotes} style={{ textAlign: "left", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>📝 Notes & Photos</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{jobNoteCount} note{jobNoteCount!==1?"s":""}</div>
                </button>
                <button onClick={onOpenCosts} style={{ textAlign: "left", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>🧾 Costs</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>${totalCosts.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{jobPOs.length} PO{jobPOs.length!==1?"s":""}</div>
                </button>
                <button onClick={onOpenQuotes} style={{ textAlign: "left", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>▧ Quotes</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{jobQuotes.length} quote{jobQuotes.length!==1?"s":""}</div>
                  {jobQuotes.length > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>${jobQuotes.reduce((s,q)=>s+q.total,0).toFixed(2)}</div>}
                </button>
                <button onClick={onOpenInvoices} style={{ textAlign: "left", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>📄 Invoices</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{jobInvoices.length} invoice{jobInvoices.length!==1?"s":""}</div>
                  {jobInvoices.length > 0 && <div style={{ fontSize: 12, color: "#065F46", fontWeight: 600, marginTop: 2 }}>${jobInvoicesTotal.toFixed(2)}</div>}
                </button>
              </div>
            )}

            <div style={{ marginBottom:20 }}>
              <label style={{ display:"block",fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5 }}>Notes</label>
                              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Any additional notes..." style={{ width: "100%", border: "1.5px solid var(--border-strong)", borderRadius: 8, padding: "9px 12px", fontSize: 14, background: "var(--bg-subtle)", boxSizing: "border-box", resize: "vertical", outline: "none", color: "var(--text-primary)" }} />
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"space-between" }}>
              <div>{!isNew&&<Btn variant="danger" onClick={()=>setConfirmingDelete(true)}>Delete Job</Btn>}</div>
              <div style={{ display:"flex",gap:10 }}>
                <Btn variant="secondary" onClick={onBack}>Cancel</Btn>
                <Btn onClick={handleSave}>Save Job</Btn>
              </div>
            </div>
          </>
        )}
      </div>
            {addingCustomer && (
        <QuickAddCustomerModal customers={customers} initialName={typeof addingCustomer === "string" ? addingCustomer : ""} onClose={()=>setAddingCustomer(false)}
          onSave={(c)=>{ setCustomers(p=>[...p, c]); set("client", c.name); setAddingCustomer(false); }} />
      )}
      {printingJobSheet && !isNew && (
        <JobSheetPrintView job={job} staff={staff} roles={roles} customers={customers} suppliers={suppliers} timeEntries={timeEntries||[]} purchaseOrders={purchaseOrders||[]} company={company} settings={settings} onClose={()=>setPrintingJobSheet(false)} />
      )}
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:"dashboard", label:"Dashboard",  icon:"◈" },
  { id:"jobs",      label:"Jobs",       icon:"☰" },
  { id:"schedule",  label:"Scheduler",  icon:"▦" },
  { id:"timesheets",label:"Timesheets", icon:"◷" },
  { id:"purchaseorders", label:"Purchase Orders", icon:"▤" },
  { id:"quotes",    label:"Quotes",     icon:"▧" },
  { id:"invoices",  label:"Invoices",   icon:"▥" },
  { id:"bills",     label:"Costs",      icon:"▨" },
  { id:"offsite",   label:"Offsite",    icon:"⊞" },
  { id:"assets",    label:"Assets",     icon:"▩" },
  { id:"contacts",  label:"Contacts",   icon:"◎" },
];

// Sidebar order is customisable (Dashboard always stays pinned first). settings.tabOrder
// stores the user's chosen order for everything else; anything not yet in that list
// (e.g. a newly added tab) is appended at the end so nothing goes missing.
function getOrderedNavItems(settings) {
  const dashboard = NAV_ITEMS.find(i => i.id === "dashboard");
  const rest = NAV_ITEMS.filter(i => i.id !== "dashboard");
  const order = settings?.tabOrder || [];
  const ordered = order.map(id => rest.find(i => i.id === id)).filter(Boolean);
  const remaining = rest.filter(i => !order.includes(i.id));
  return dashboard ? [dashboard, ...ordered, ...remaining] : [...ordered, ...remaining];
}

// ─── APP ──────────────────────────────────────────────────────────────────────
// ─── MOBILE NAVIGATION (small-screen layout: top bar + slide-out menu + bottom tabs) ──
function MobileTopBar({ onMenuClick }) {
    return (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: SIDEBAR_BG, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 200, borderBottom: `1px solid ${SIDEBAR_BORDER}` }}>
            <img src={logoSidebar} alt="ApexOps" style={{ height: 32, width: "auto" }} />
            <button onClick={onMenuClick} aria-label="Menu" style={{ background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", padding: 6, lineHeight: 1 }}>☰</button>
        </div>
    );
}

function MobileMenuOverlay({ settings, tab, onNavigate, onNewJob, onSignOut, onClose, jobs }) {
    const items = getOrderedNavItems(settings).filter(item => settings.visibleTabs[item.id] !== false);
    return (
        <div style={{ position: "fixed", inset: 0, background: SIDEBAR_BG, zIndex: 300, display: "flex", flexDirection: "column", padding: "16px 20px", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <img src={logoSidebar} alt="ApexOps" style={{ height: 34, width: "auto" }} />
                <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#fff", fontSize: 30, cursor: "pointer", padding: 6, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1 }}>
                {items.map(item => (
                    <button key={item.id} onClick={() => onNavigate(item.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 14px", borderRadius: 9, border: "none", background: tab === item.id ? ACCENT : "transparent", color: tab === item.id ? INK : SIDEBAR_MUTED, fontWeight: tab === item.id ? 700 : 500, fontSize: 16, cursor: "pointer", marginBottom: 4, textAlign: "left" }}>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>{item.label}
                    </button>
                ))}
                <button onClick={() => onNavigate("settings")}
                    style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 14px", borderRadius: 9, border: "none", background: tab === "settings" ? ACCENT : "transparent", color: tab === "settings" ? INK : SIDEBAR_MUTED, fontWeight: tab === "settings" ? 700 : 500, fontSize: 16, cursor: "pointer", marginTop: 10 }}>
                    <span style={{ fontSize: 18 }}>⚙</span>Settings
                </button>
            </div>
            <div style={{ borderTop: `1px solid ${SIDEBAR_BORDER}`, paddingTop: 16 }}>
                <button onClick={onNewJob} style={{ width: "100%", padding: "13px 0", background: ACCENT, color: INK, border: "none", borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 14 }}>+ New Job</button>
                <div style={{ fontSize: 11, color: SIDEBAR_MUTED, marginBottom: 10 }}>{jobs.length} total jobs</div>
                <button onClick={onSignOut} style={{ background: "none", border: "none", color: SIDEBAR_MUTED, fontSize: 13, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Sign Out</button>
            </div>
        </div>
    );
}

function MobileBottomNav({ settings, tab, onNavigate }) {
    const tabIds = (settings.mobileNavTabs && settings.mobileNavTabs.length) ? settings.mobileNavTabs : ["dashboard", "jobs", "assets", "contacts"];
    const items = tabIds.map(id => id === "settings" ? { id: "settings", label: "Settings", icon: "⚙" } : NAV_ITEMS.find(n => n.id === id)).filter(Boolean);
    return (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 62, background: SIDEBAR_BG, display: "flex", borderTop: `1px solid ${SIDEBAR_BORDER}`, zIndex: 200 }}>
            {items.map(item => {
                const active = tab === item.id;
                return (
                    <button key={item.id} onClick={() => onNavigate(item.id)}
                        style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: active ? ACCENT : SIDEBAR_MUTED, cursor: "pointer", padding: "6px 2px" }}>
                        <span style={{ fontSize: 19 }}>{item.icon}</span>
                        <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function SettingsMobileNavPage({ settings, setSettings }) {
    const allItems = [...NAV_ITEMS, { id: "settings", label: "Settings", icon: "⚙" }];
    const selected = settings.mobileNavTabs || [];
    const dragIndex = useRef(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const toggleItem = (id) => {
        setSettings(p => {
            const cur = p.mobileNavTabs || [];
            if (cur.includes(id)) return { ...p, mobileNavTabs: cur.filter(x => x !== id) };
            if (cur.length >= 5) return p;
            return { ...p, mobileNavTabs: [...cur, id] };
        });
    };
    const reorder = (from, to) => {
        if (from == null || from === to) return;
        setSettings(p => {
            const cur = [...(p.mobileNavTabs || [])];
            const [moved] = cur.splice(from, 1);
            cur.splice(to, 0, moved);
            return { ...p, mobileNavTabs: cur };
        });
    };

    return (
        <div>
            <div style={{ background: "var(--card-bg)", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px #1C233310", maxWidth: 560, marginBottom: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px" }}>Bottom Navigation (Mobile)</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>Choose up to 5 pages to show in the bottom bar on phones, and drag to set their order. {selected.length}/5 selected.</p>
                {selected.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                        {selected.map((id, i) => {
                            const item = allItems.find(x => x.id === id);
                            if (!item) return null;
                            return (
                                <div key={id}
                                    draggable
                                    onDragStart={(e) => { dragIndex.current = i; e.dataTransfer.effectAllowed = "move"; }}
                                    onDragOver={(e) => { e.preventDefault(); if (dragOverIndex !== i) setDragOverIndex(i); }}
                                    onDragLeave={() => setDragOverIndex(prev => prev === i ? null : prev)}
                                    onDrop={(e) => { e.preventDefault(); reorder(dragIndex.current, i); dragIndex.current = null; setDragOverIndex(null); }}
                                    onDragEnd={() => { dragIndex.current = null; setDragOverIndex(null); }}
                                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: dragOverIndex === i ? "var(--bg-subtle2)" : "var(--bg-subtle)", borderRadius: 8, border: dragOverIndex === i ? `1.5px dashed ${ACCENT_TEXT}` : "1.5px solid transparent" }}>
                                    <span style={{ fontSize: 15, color: "var(--text-muted)", cursor: "grab", userSelect: "none", lineHeight: 1 }}>⠿</span>
                                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</span>
                                    <button onClick={() => toggleItem(id)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: 0 }}>×</button>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 10px" }}>Add a page</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {allItems.filter(item => !selected.includes(item.id)).map(item => (
                        <button key={item.id} onClick={() => toggleItem(item.id)} disabled={selected.length >= 5}
                            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--border-strong)", background: "var(--card-bg)", color: selected.length >= 5 ? "var(--border-strong)" : "var(--text-secondary)", fontWeight: 600, fontSize: 12, cursor: selected.length >= 5 ? "not-allowed" : "pointer" }}>
                            <span>{item.icon}</span>{item.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
function InvoiceStatusBadge({ invoice, onClick }) {
  const meta = INVOICE_STATUS_META[invoice.status] || INVOICE_STATUS_META.draft;
  return (
    <button onClick={onClick} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:99, border:"1.5px solid "+meta.color, background:meta.color+"18", color:meta.color, fontWeight:800, fontSize:11, textTransform:"uppercase", letterSpacing:0.3, cursor:onClick?"pointer":"default" }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:meta.color }} />
      {meta.label}
    </button>
  );
}

function InvoiceStatusModal({ invoice, onSave, onClose }) {
  return (
    <Modal title={`Update Status — ${invoice.invoiceNumber}`} onClose={onClose}>
      <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>Choose the current status of this invoice.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {Object.entries(INVOICE_STATUS_META).map(([key, meta]) => (
          <button key={key} onClick={()=>onSave({ ...invoice, status:key })}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:9, border: invoice.status===key ? `2px solid ${meta.color}` : "1.5px solid var(--border-strong)", background: invoice.status===key ? meta.color+"18" : "var(--card-bg)", cursor:"pointer", textAlign:"left" }}>
            <span style={{ width:10, height:10, borderRadius:"50%", background:meta.color }} />
            <span style={{ fontWeight:700, color:"var(--text-primary)", fontSize:14 }}>{meta.label}</span>
          </button>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:20 }}>
        <Btn variant="secondary" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}

function InvoiceBuilderModal({ job, staff, roles, customers, timeEntries, purchaseOrders, invoices, settings, editingInvoice, prefill, onSave, onClose }) {
  const customer = customers.find(c => c.name === job.client);
  const [invoiceNumber, setInvoiceNumber] = useState(editingInvoice?.invoiceNumber || nextInvoiceNumber(invoices, settings?.invoiceNumberPrefix));
  const [issueDate, setIssueDate] = useState(editingInvoice?.issueDate || todayISO());
  const [dueDate, setDueDate] = useState(editingInvoice?.dueDate || computeDueDate(todayISO(), settings));
  const [dueTouched, setDueTouched] = useState(false);
  const [lines, setLines] = useState(editingInvoice?.lineItems || prefill?.lineItems || buildInvoiceLinesForJob(job, staff, roles, timeEntries, purchaseOrders));
  const [notes, setNotes] = useState(editingInvoice?.notes ?? prefill?.notes ?? (settings?.invoiceFooterNote || ""));
  const [error, setError] = useState("");
  const taxRate = settings?.invoiceTaxRate ?? 15;

  const updateLine = (id, field, value) => setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  const removeLine = (id) => setLines(prev => prev.filter(l => l.id !== id));
  const addCustomLine = () => setLines(prev => [...prev, { id: liid(), type: "custom", description: "", quantity: 1, unitPrice: 0 }]);

  const { subtotal, taxAmount, total } = calcInvoiceTotals(lines, taxRate);

  const handleSave = () => {
    if (!invoiceNumber.trim()) { setError("Invoice number is required."); return; }
    if (lines.length === 0) { setError("Add at least one line item."); return; }
    onSave({
      id: editingInvoice?.id || invid(),
      invoiceNumber: invoiceNumber.trim(), jobId: job.id, customerName: job.client,
      status: editingInvoice?.status || "draft",
      issueDate, dueDate, lineItems: lines, taxRate, subtotal, taxAmount, total, notes,
      createdAt: editingInvoice?.createdAt || todayISO(),
    });
  };

  const TYPE_LABELS = { labour: "Labour", cost: "Cost", po: "Purchase Order", custom: "Custom" };

  return (
    <Modal title={editingInvoice ? `Edit ${editingInvoice.invoiceNumber}` : `New Invoice — ${job.id || job.client || "from quote"}`} onClose={onClose} wide>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0 16px" }}>
        <Inp label="Invoice Number" value={invoiceNumber} onChange={e=>{ setInvoiceNumber(e.target.value); if(error) setError(""); }} />
        <Inp label="Issue Date" type="date" value={issueDate} onChange={e=>{ setIssueDate(e.target.value); if (!editingInvoice && !dueTouched && e.target.value) setDueDate(computeDueDate(e.target.value, settings)); }} />
        <Inp label="Due Date" type="date" value={dueDate} onChange={e=>{ setDueDate(e.target.value); setDueTouched(true); }} />
      </div>

      <div style={{ background:"var(--bg-subtle)", borderRadius:8, padding:"10px 14px", marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>Bill To</div>
        <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>{job.client || "No customer set"}</div>
        {customer?.address && <div style={{ fontSize:12, color:"var(--text-secondary)", marginTop:2 }}>{customer.address}</div>}
        {customer?.email && <div style={{ fontSize:12, color:"var(--text-secondary)" }}>{customer.email}</div>}
      </div>

      <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>Line Items</label>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12, maxHeight:280, overflowY:"auto" }}>
        {lines.map(l => (
          <div key={l.id} style={{ display:"flex", gap:8, alignItems:"flex-start", background:"var(--bg-subtle)", borderRadius:8, padding:10 }}>
            <div style={{ flex:2 }}>
              <input value={l.description} onChange={e=>updateLine(l.id,"description",e.target.value)} placeholder="Description"
                style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:7, padding:"7px 10px", fontSize:13, background:"var(--card-bg)", color:"var(--text-primary)", outline:"none", boxSizing:"border-box" }} />
              <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:3, textTransform:"uppercase", letterSpacing:0.3 }}>{TYPE_LABELS[l.type] || "Custom"}</div>
            </div>
            <input type="number" value={l.quantity} onChange={e=>updateLine(l.id,"quantity",parseFloat(e.target.value)||0)} placeholder="Qty"
              style={{ width:70, border:"1.5px solid var(--border-strong)", borderRadius:7, padding:"7px 8px", fontSize:13, background:"var(--card-bg)", color:"var(--text-primary)", outline:"none" }} />
            <input type="number" value={l.unitPrice} onChange={e=>updateLine(l.id,"unitPrice",parseFloat(e.target.value)||0)} placeholder="Rate"
              style={{ width:90, border:"1.5px solid var(--border-strong)", borderRadius:7, padding:"7px 8px", fontSize:13, background:"var(--card-bg)", color:"var(--text-primary)", outline:"none" }} />
            <div style={{ width:90, textAlign:"right", fontSize:13, fontWeight:700, color:"var(--text-primary)", paddingTop:8 }}>${((l.quantity||0)*(l.unitPrice||0)).toFixed(2)}</div>
            <button onClick={()=>removeLine(l.id)} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:16, cursor:"pointer", padding:"6px 2px" }}>×</button>
          </div>
        ))}
        {lines.length===0 && <div style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", padding:16 }}>No line items yet.</div>}
      </div>
      <button onClick={addCustomLine} style={{ background:"none", border:"1.5px dashed var(--border-strong)", borderRadius:8, padding:"8px 0", width:"100%", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:20 }}>+ Add Line Item</button>

      {error && <div style={{ fontSize:12, color:"#DC2626", marginBottom:14 }}>{error}</div>}

      <div style={{ background:"var(--bg-subtle)", borderRadius:8, padding:"14px 18px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--text-secondary)", marginBottom:6 }}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--text-secondary)", marginBottom:6 }}><span>Tax ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span></div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:16, fontWeight:900, color:"var(--text-primary)", paddingTop:8, borderTop:"1px solid var(--border-strong)" }}><span>Total</span><span>${total.toFixed(2)}</span></div>
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Notes / Payment Terms</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="e.g. Payment due within 14 days of invoice date."
          style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, background:"var(--bg-subtle)", boxSizing:"border-box", resize:"vertical", outline:"none", color:"var(--text-primary)", fontFamily:"'Inter',system-ui,sans-serif" }}/>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave}>{editingInvoice ? "Save Changes" : "Create Invoice"}</Btn>
      </div>
    </Modal>
  );
}

function InvoicePrintView({ invoice, job, customer, company, settings, onClose }) {
  const footerNote = settings?.invoiceFooterNote || "Thank you for your business.";

  const handleEmailInvoice = async () => {
    await downloadElementAsPDF("invoice-print-area", `${invoice.invoiceNumber}.pdf`);
    const email = customer?.email || "";
    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber} from ${company?.name || ""}`);
    const body = encodeURIComponent(`Hi ${customer?.contactPerson || customer?.name || ""},\n\nPlease find attached invoice ${invoice.invoiceNumber} for $${invoice.total.toFixed(2)}, due ${formatDate(invoice.dueDate)}.\n\nThe PDF has just been downloaded to your computer — please attach it to this email before sending.\n\nThanks,\n${company?.name || ""}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#5C6B82", zIndex:3000, overflowY:"auto" }}>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          html, body { width: 210mm; height: 297mm; }
          body * { visibility: hidden; }
          #invoice-print-area, #invoice-print-area * { visibility: visible; }
          #invoice-print-area {
            position: absolute; top: 0; left: 0;
            width: 210mm; min-height: 297mm; max-width: none;
            margin: 0; box-shadow: none;
            background: #fff !important; color: #1C2333 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print" style={{ position:"sticky", top:0, background:"#1C2333", padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", zIndex:10 }}>
        <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>Invoice {invoice.invoiceNumber}</span>
        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={()=>window.print()}>🖨 Print</Btn>
          <Btn variant="secondary" onClick={()=>downloadElementAsPDF("invoice-print-area", `${invoice.invoiceNumber}.pdf`)}>⬇ Save as PDF</Btn>
          <Btn variant="secondary" onClick={handleEmailInvoice}>✉ Email Invoice</Btn>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </div>
      <div id="invoice-print-area" style={{ background:"#fff", width:"210mm", minHeight:"297mm", margin:"30px auto", padding:"18mm 16mm", boxSizing:"border-box", boxShadow:"0 4px 24px #00000030", fontFamily:"'Inter',system-ui,sans-serif", color:"#1C2333" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:36, paddingBottom:24, borderBottom:"2px solid #1C2333" }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900 }}>{company?.name || "Your Company Name"}</div>
            {company?.address && <div style={{ fontSize:12, color:"#5C6B82", marginTop:6, whiteSpace:"pre-line" }}>{company.address}</div>}
            {company?.phone && <div style={{ fontSize:12, color:"#5C6B82", marginTop:2 }}>{company.phone}</div>}
            {company?.email && <div style={{ fontSize:12, color:"#5C6B82" }}>{company.email}</div>}
            {company?.abn && <div style={{ fontSize:12, color:"#5C6B82", marginTop:2 }}>GST No. {company.abn}</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:26, fontWeight:900, letterSpacing:1 }}>INVOICE</div>
            <div style={{ fontSize:14, fontWeight:700, color:"#7A8A00", marginTop:6 }}>{invoice.invoiceNumber}</div>
            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>Issued: {formatDate(invoice.issueDate)}</div>
            <div style={{ fontSize:12, color:"#9CA3AF" }}>Due: {formatDate(invoice.dueDate)}</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginBottom:32 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Bill To</div>
            <div style={{ fontSize:14, fontWeight:700 }}>{customer?.name || invoice.customerName || "—"}</div>
            {customer?.contactPerson && <div style={{ fontSize:13, color:"#5C6B82", marginTop:3 }}>Attn: {customer.contactPerson}</div>}
            {customer?.address && <div style={{ fontSize:12, color:"#9CA3AF", marginTop:6, whiteSpace:"pre-line" }}>{customer.address}</div>}
            {customer?.email && <div style={{ fontSize:13, color:"#5C6B82", marginTop:3 }}>{customer.email}</div>}
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Job Reference</div>
            <div style={{ fontSize:14, fontWeight:700 }}>{invoice.jobId || "—"}</div>
            {job?.title && <div style={{ fontSize:13, color:"#5C6B82", marginTop:3 }}>{job.title}</div>}
          </div>
        </div>

        <table style={{ borderCollapse:"collapse", width:"100%", fontSize:13, marginBottom:20 }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              <th style={{ padding:"8px 10px", textAlign:"left", fontWeight:700, color:"#5C6B82", borderBottom:"1px solid #E5EAF0", fontSize:11, textTransform:"uppercase" }}>Description</th>
              <th style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:"#5C6B82", borderBottom:"1px solid #E5EAF0", fontSize:11, textTransform:"uppercase" }}>Qty</th>
              <th style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:"#5C6B82", borderBottom:"1px solid #E5EAF0", fontSize:11, textTransform:"uppercase" }}>Rate</th>
              <th style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:"#5C6B82", borderBottom:"1px solid #E5EAF0", fontSize:11, textTransform:"uppercase" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map(l => (
              <tr key={l.id} style={{ borderBottom:"1px solid #F1F4F8" }}>
                <td style={{ padding:"8px 10px" }}>{l.description}</td>
                <td style={{ padding:"8px 10px", textAlign:"right", color:"#5C6B82" }}>{l.quantity}</td>
                <td style={{ padding:"8px 10px", textAlign:"right", color:"#5C6B82" }}>${Number(l.unitPrice).toFixed(2)}</td>
                <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600 }}>${(l.quantity*l.unitPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:32 }}>
          <div style={{ width:240 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#5C6B82", padding:"4px 0" }}><span>Subtotal</span><span>${invoice.subtotal.toFixed(2)}</span></div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#5C6B82", padding:"4px 0" }}><span>Tax ({invoice.taxRate}%)</span><span>${invoice.taxAmount.toFixed(2)}</span></div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:16, fontWeight:900, padding:"10px 0", marginTop:6, borderTop:"2px solid #1C2333" }}><span>Total Due</span><span>${invoice.total.toFixed(2)}</span></div>
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginBottom:32 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Notes</div>
            <div style={{ fontSize:12, color:"#5C6B82", lineHeight:1.6, whiteSpace:"pre-line" }}>{invoice.notes}</div>
          </div>
        )}

        <div style={{ marginTop:40, paddingTop:16, borderTop:"1px solid #E5EAF0", fontSize:11, color:"#C4CAD4", textAlign:"center" }}>
          {footerNote}
        </div>
      </div>
    </div>
  );
}

function InvoicesView({ jobs, customers, invoices, setInvoices, staff, roles, timeEntries, purchaseOrders, company, settings, onOpenJob }) {
  const [search, setSearch] = useState("");
  const [pickingJob, setPickingJob] = useState(false);
  const [buildingForJob, setBuildingForJob] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [printingInvoice, setPrintingInvoice] = useState(null);
  const [statusInvoice, setStatusInvoice] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(null);

  const rows = invoices
    .map(inv => ({ invoice: inv, job: jobs.find(j=>j.id===inv.jobId), customer: customers.find(c=>c.name===inv.customerName) }))
    .filter(({ invoice, job }) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return invoice.invoiceNumber.toLowerCase().includes(q) || (invoice.customerName||"").toLowerCase().includes(q) || (job?.id||"").toLowerCase().includes(q) || (job?.title||"").toLowerCase().includes(q);
    })
    .sort((a,b) => a.invoice.issueDate < b.invoice.issueDate ? 1 : -1);

  const saveInvoice = (inv) => {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === inv.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = inv; return next; }
      return [inv, ...prev];
    });
    setBuildingForJob(null);
    setEditingInvoice(null);
  };
  const updateInvoiceStatus = (inv) => { setInvoices(prev => prev.map(i => i.id===inv.id ? inv : i)); setStatusInvoice(null); };
  const deleteInvoice = (id) => { setInvoices(prev => prev.filter(i => i.id !== id)); setDeletingInvoice(null); };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>Invoices</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:14, margin:0 }}>{invoices.length} invoice{invoices.length!==1?"s":""} created</p>
        </div>
        <Btn onClick={()=>setPickingJob(true)}>+ Create Invoice</Btn>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice number, customer, or job..." style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 14px", fontSize:14, outline:"none", background:"var(--card-bg)", color:"var(--text-primary)", boxSizing:"border-box", marginBottom:18 }} />

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {rows.map(({ invoice, job, customer }) => (
          <div key={invoice.id} style={{ background:"var(--card-bg)", borderRadius:12, padding:"14px 18px", boxShadow:"0 1px 4px #1C233310", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ minWidth:100 }}>
              <div style={{ fontSize:13, fontWeight:800, color:ACCENT_TEXT }}>{invoice.invoiceNumber}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{formatDate(invoice.issueDate)}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{invoice.customerName || "Unknown customer"}</div>
              {job && <button onClick={()=>onOpenJob(job)} style={{ background:"none", border:"none", padding:0, cursor:"pointer", fontSize:11, color:"var(--text-secondary)", textAlign:"left" }}>{job.id} — {job.title.slice(0,40)}</button>}
            </div>
            <div style={{ minWidth:90, textAlign:"right", fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>${invoice.total.toFixed(2)}</div>
            <InvoiceStatusBadge invoice={invoice} onClick={()=>setStatusInvoice(invoice)} />
            <Btn variant="secondary" onClick={()=>setPrintingInvoice(invoice)}>View / Print</Btn>
            <Btn variant="secondary" onClick={()=>setEditingInvoice(invoice)}>Edit</Btn>
            <Btn variant="danger" onClick={()=>setDeletingInvoice(invoice)}>Delete</Btn>
          </div>
        ))}
        {rows.length===0 && <div style={{ textAlign:"center", color:"var(--text-muted)", padding:40, fontSize:14, background:"var(--card-bg)", borderRadius:12 }}>No invoices yet.</div>}
      </div>

      {pickingJob && (
        <JobPickerModal jobs={jobs} onClose={()=>setPickingJob(false)} onSelect={(j)=>{ setPickingJob(false); setBuildingForJob(j); }} />
      )}
      {buildingForJob && (
        <InvoiceBuilderModal job={buildingForJob} staff={staff} roles={roles} customers={customers} timeEntries={timeEntries} purchaseOrders={purchaseOrders} invoices={invoices} settings={settings} onSave={saveInvoice} onClose={()=>setBuildingForJob(null)} />
      )}
      {editingInvoice && (
        <InvoiceBuilderModal job={jobs.find(j=>j.id===editingInvoice.jobId) || { id: editingInvoice.jobId, client: editingInvoice.customerName, jobCosts:[] }} staff={staff} roles={roles} customers={customers} timeEntries={timeEntries} purchaseOrders={purchaseOrders} invoices={invoices} settings={settings} editingInvoice={editingInvoice} onSave={saveInvoice} onClose={()=>setEditingInvoice(null)} />
      )}
      {printingInvoice && (
        <InvoicePrintView invoice={printingInvoice} job={jobs.find(j=>j.id===printingInvoice.jobId)} customer={customers.find(c=>c.name===printingInvoice.customerName)} company={company} settings={settings} onClose={()=>setPrintingInvoice(null)} />
      )}
      {statusInvoice && (
        <InvoiceStatusModal invoice={statusInvoice} onSave={updateInvoiceStatus} onClose={()=>setStatusInvoice(null)} />
      )}
      {deletingInvoice && (
        <Modal title={`Delete ${deletingInvoice.invoiceNumber}?`} onClose={()=>setDeletingInvoice(null)}>
          <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>This can't be undone.</div>
            <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>{deletingInvoice.invoiceNumber} will be permanently deleted.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={()=>setDeletingInvoice(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={()=>deleteInvoice(deletingInvoice.id)}>Yes, Delete</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SettingsInvoicesPage({ settings, setSettings }) {
  const [draft, setDraft] = useState({ invoiceFooterNote: settings.invoiceFooterNote, invoiceTerms: settings.invoiceTerms, invoiceTaxRate: settings.invoiceTaxRate ?? 15, invoiceNumberPrefix: settings.invoiceNumberPrefix || "INV", invoiceDueMode: settings.invoiceDueMode || "days", invoiceDueValue: settings.invoiceDueValue ?? 14 });
  const [saved, setSaved] = useState(false);
  const set = (k,v) => { setDraft(p=>({...p,[k]:v})); setSaved(false); };
  const handleSave = () => { setSettings(p=>({ ...p, ...draft })); setSaved(true); setTimeout(()=>setSaved(false), 2500); };

  return (
    <div>
      <div style={{ background:"var(--card-bg)", borderRadius:14, padding:24, boxShadow:"0 1px 4px #1C233310", maxWidth:560 }}>
        <h2 style={{ fontSize:15, fontWeight:800, color:"var(--text-primary)", margin:"0 0 4px" }}>Invoice Template</h2>
        <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 16px" }}>These defaults apply to every new invoice — you can still adjust anything per-invoice.</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          <Inp label="Invoice Number Prefix" value={draft.invoiceNumberPrefix} onChange={e=>set("invoiceNumberPrefix",e.target.value)} placeholder="e.g. INV" />
          <Inp label="Tax Rate (%)" type="number" step="0.1" min="0" value={draft.invoiceTaxRate} onChange={e=>set("invoiceTaxRate",parseFloat(e.target.value)||0)} placeholder="e.g. 15" />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
          <Sel label="Invoice Due Date Rule" value={draft.invoiceDueMode} onChange={e=>set("invoiceDueMode",e.target.value)} options={[{ value:"days", label:"Days after issue date" }, { value:"monthday", label:"Day of the following month" }]} />
          <Inp label={draft.invoiceDueMode === "monthday" ? "Day of month (1–31)" : "Number of days"} type="number" min="1" max={draft.invoiceDueMode === "monthday" ? 31 : 365} value={draft.invoiceDueValue} onChange={e=>set("invoiceDueValue",parseInt(e.target.value,10)||0)} placeholder={draft.invoiceDueMode === "monthday" ? "e.g. 20" : "e.g. 14"} />
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Default Notes / Payment Terms</label>
          <textarea value={draft.invoiceTerms} onChange={e=>set("invoiceTerms",e.target.value)} rows={3} placeholder="e.g. Payment due within 14 days of invoice date." style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, background:"var(--bg-subtle)", boxSizing:"border-box", resize:"vertical", outline:"none", color:"var(--text-primary)", fontFamily:"'Inter',system-ui,sans-serif" }}/>
        </div>
        <div style={{ marginBottom:6 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:"var(--text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>Footer Note</label>
          <input value={draft.invoiceFooterNote} onChange={e=>set("invoiceFooterNote",e.target.value)} placeholder="e.g. Thank you for your business." style={{ width:"100%", border:"1.5px solid var(--border-strong)", borderRadius:8, padding:"9px 12px", fontSize:14, background:"var(--bg-subtle)", boxSizing:"border-box", outline:"none", color:"var(--text-primary)" }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:14 }}>
          <Btn onClick={handleSave}>Save Invoice Settings</Btn>
          {saved && <span style={{ fontSize:12, fontWeight:700, color:"#10B981" }}>✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}
function JobInvoicesPage({ job, staff, roles, customers, timeEntries, purchaseOrders, invoices, setInvoices, company, settings, onBack }) {
  const [building, setBuilding] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [printingInvoice, setPrintingInvoice] = useState(null);
  const [statusInvoice, setStatusInvoice] = useState(null);
  const [deletingInvoice, setDeletingInvoice] = useState(null);

  const jobInvoices = (invoices||[]).filter(i=>i.jobId===job.id).sort((a,b)=> a.issueDate<b.issueDate?1:-1);

  const saveInvoice = (inv) => {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === inv.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = inv; return next; }
      return [inv, ...prev];
    });
    setBuilding(false);
    setEditingInvoice(null);
  };
  const updateInvoiceStatus = (inv) => { setInvoices(prev => prev.map(i => i.id===inv.id ? inv : i)); setStatusInvoice(null); };
  const deleteInvoice = (id) => { setInvoices(prev => prev.filter(i => i.id !== id)); setDeletingInvoice(null); };

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--text-secondary)", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, marginBottom:14, display:"flex", alignItems:"center", gap:5 }}>← Back to Job</button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px" }}>Invoices</h1>
          <p style={{ color:"var(--text-secondary)", fontSize:14, margin:0 }}>{job.id} · {job.title}</p>
        </div>
        <Btn onClick={()=>setBuilding(true)}>+ Create Invoice</Btn>
      </div>

      {jobInvoices.length===0 ? (
        <div style={{ background:"var(--card-bg)", borderRadius:14, padding:40, textAlign:"center", color:"var(--text-muted)" }}>No invoices created for this job yet.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {jobInvoices.map(inv => (
            <div key={inv.id} style={{ background:"var(--card-bg)", borderRadius:12, padding:"14px 18px", boxShadow:"0 1px 4px #1C233310", display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ minWidth:100 }}>
                <div style={{ fontSize:13, fontWeight:800, color:ACCENT_TEXT }}>{inv.invoiceNumber}</div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{formatDate(inv.issueDate)}</div>
              </div>
              <div style={{ flex:1, fontSize:13, color:"var(--text-secondary)" }}>Due {formatDate(inv.dueDate)}</div>
              <div style={{ fontSize:14, fontWeight:800, color:"var(--text-primary)" }}>${inv.total.toFixed(2)}</div>
              <InvoiceStatusBadge invoice={inv} onClick={()=>setStatusInvoice(inv)} />
              <Btn variant="secondary" onClick={()=>setPrintingInvoice(inv)}>View / Print</Btn>
              <Btn variant="secondary" onClick={()=>setEditingInvoice(inv)}>Edit</Btn>
              <Btn variant="danger" onClick={()=>setDeletingInvoice(inv)}>Delete</Btn>
            </div>
          ))}
        </div>
      )}

      {building && (
        <InvoiceBuilderModal job={job} staff={staff} roles={roles} customers={customers} timeEntries={timeEntries} purchaseOrders={purchaseOrders} invoices={invoices} settings={settings} onSave={saveInvoice} onClose={()=>setBuilding(false)} />
      )}
      {editingInvoice && (
        <InvoiceBuilderModal job={job} staff={staff} roles={roles} customers={customers} timeEntries={timeEntries} purchaseOrders={purchaseOrders} invoices={invoices} settings={settings} editingInvoice={editingInvoice} onSave={saveInvoice} onClose={()=>setEditingInvoice(null)} />
      )}
      {printingInvoice && (
        <InvoicePrintView invoice={printingInvoice} job={job} customer={customers.find(c=>c.name===printingInvoice.customerName)} company={company} settings={settings} onClose={()=>setPrintingInvoice(null)} />
      )}
      {statusInvoice && (
        <InvoiceStatusModal invoice={statusInvoice} onSave={updateInvoiceStatus} onClose={()=>setStatusInvoice(null)} />
      )}
      {deletingInvoice && (
        <Modal title={`Delete ${deletingInvoice.invoiceNumber}?`} onClose={()=>setDeletingInvoice(null)}>
          <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:8, padding:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#991B1B", marginBottom:6 }}>This can't be undone.</div>
            <div style={{ fontSize:13, color:"#7F1D1D", marginBottom:16 }}>{deletingInvoice.invoiceNumber} will be permanently deleted.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={()=>setDeletingInvoice(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={()=>deleteInvoice(deletingInvoice.id)}>Yes, Delete</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function App() {
    const [tab, setTab] = useState("dashboard");

    // ─── Auth state ──────────────────────────────────────────────────────────
    const [session, setSession] = useState(undefined); // undefined = checking, null = logged out
    const [dataLoading, setDataLoading] = useState(false);
    const [dataError, setDataError] = useState(null);
    const showSyncError = (msg) => setDataError(msg);

    // ─── Data — each of these now mirrors to Supabase automatically ───────────
    const [jobs, setJobs, setJobsSilently] = useSyncedJobs(showSyncError);
    const [staffRaw, setStaff, setStaffSilently] = useSyncedTable("staff", staffMap, showSyncError);
    const staff = useMemo(() => [...staffRaw].sort((a, b) => a.name.localeCompare(b.name)), [staffRaw]);
    const [roles, setRoles, setRolesSilently] = useSyncedTable("roles", rolesMap, showSyncError);
    const [assets, setAssets, setAssetsSilently] = useSyncedTable("assets", assetMap, showSyncError);
    const [assetGroups, setAssetGroups, setAssetGroupsSilently] = useSyncedTable("asset_groups", assetGroupMap, showSyncError);
    const [customers, setCustomers, setCustomersSilently] = useSyncedTable("customers", contactMap, showSyncError);
    const [suppliers, setSuppliers, setSuppliersSilently] = useSyncedTable("suppliers", contactMap, showSyncError);
    const [timeEntries, setTimeEntries, setTimeEntriesSilently] = useSyncedTable("time_entries", timeEntryMap, showSyncError);
    const [purchaseOrders, setPurchaseOrders, setPurchaseOrdersSilently] = useSyncedTable("purchase_orders", poMap, showSyncError);
            const [invoices, setInvoices, setInvoicesSilently] = useSyncedTable("invoices", invoiceMap, showSyncError);
      const [quotes, setQuotes, setQuotesSilently] = useSyncedTable("quotes", quoteMap, showSyncError);
    const [bills, setBills, setBillsSilently] = useSyncedTable("bills", billMap, showSyncError);
    const [company, setCompany, setCompanySilently] = useSyncedSingleton("company", companyMap, INITIAL_COMPANY, showSyncError);
    const [settings, setSettings, setSettingsSilently] = useSyncedSingleton("settings", settingsMap, INITIAL_SETTINGS, showSyncError);
    const [schedulerDataObj, setSchedulerDataObj, setSchedulerDataObjSilently] = useSyncedSingleton("scheduler_data", schedulerDataMap, { scheduleData: {} }, showSyncError);
    const [offsiteTracker, setOffsiteTracker, setOffsiteTrackerSilently] = useSyncedSingleton("offsite_tracker", offsiteTrackerMap, { cols: DEFAULT_OFFSITE_COLS, data: {}, allocated: {} }, showSyncError);

    const setScheduleData = (updater) => {
        setSchedulerDataObj(prev => ({ ...prev, scheduleData: typeof updater === "function" ? updater(prev.scheduleData) : updater }));
    };
    const setOffsiteCols = (updater) => setOffsiteTracker(prev => ({ ...prev, cols: typeof updater === "function" ? updater(prev.cols) : updater }));
    const setOffsiteData = (updater) => setOffsiteTracker(prev => ({ ...prev, data: typeof updater === "function" ? updater(prev.data) : updater }));
    const setOffsiteAllocated = (updater) => setOffsiteTracker(prev => ({ ...prev, allocated: typeof updater === "function" ? updater(prev.allocated) : updater }));
    const [toast, setToast] = useState(null);
    const [jobsPresetFilter, setJobsPresetFilter] = useState("all");
    const [jobsViewKey, setJobsViewKey] = useState(0);
    const [showCompletedJobs, setShowCompletedJobs] = useState(false);
    const [jobsSortKey, setJobsSortKey] = useState("id");
    const [jobsSortDir, setJobsSortDir] = useState("desc");
    const [jobsSearch, setJobsSearch] = useState("");
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // ─── Auth lifecycle ─────────────────────────────────────────────────────
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: listener } = supabase.auth.onAuthStateChange((_e, newSession) => setSession(newSession));
        return () => listener.subscription.unsubscribe();
    }, []);

    // ─── Load all data once signed in ──────────────────────────────────────
    useEffect(() => {
        if (!session) return;
        let cancelled = false;
        setDataLoading(true);
        setDataError(null);
        (async () => {
            try {
                await ensureSingletonsExist(INITIAL_COMPANY, INITIAL_SETTINGS, { scheduleData: {} }, { cols: DEFAULT_OFFSITE_COLS, data: {}, allocated: {} });
                const data = await fetchAllData();
                if (cancelled) return;
                setStaffSilently(data.staff);
                setRolesSilently(data.roles);
                setCustomersSilently(data.customers);
                setSuppliersSilently(data.suppliers);
                setAssetsSilently(data.assets);
                setAssetGroupsSilently(data.assetGroups);
                setTimeEntriesSilently(data.timeEntries);
                setPurchaseOrdersSilently(data.purchaseOrders);
                setJobsSilently(data.jobs);
                if (data.company) setCompanySilently(data.company);
                if (data.settings) setSettingsSilently(data.settings);
                if (data.schedulerData) setSchedulerDataObjSilently(data.schedulerData);
                if (data.offsiteTracker) setOffsiteTrackerSilently(data.offsiteTracker);
                        setInvoicesSilently(data.invoices);
                        setQuotesSilently(data.quotes);
                setBillsSilently(data.bills);
            } catch (err) {
                if (!cancelled) setDataError(err.message || "Something went wrong loading your data.");
            } finally {
                if (!cancelled) setDataLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [session]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setStaffSilently([]); setRolesSilently([]); setCustomersSilently([]); setSuppliersSilently([]);
        setAssetsSilently([]); setAssetGroupsSilently([]); setTimeEntriesSilently([]); setPurchaseOrdersSilently([]);
        setJobsSilently([]);
        setTab("dashboard");
    };

  // Job pages: a small navigation stack so every page (Job → Time / Notes / Costs)
  // can have its own "back" button that returns to wherever you came from.
  // [] = not viewing a job; otherwise the last entry is the page currently shown.
    const [jobPageStack, setJobPageStack] = useState([]);
    const scrollPosRef = useRef(0);
    const openJob = (jobId) => { scrollPosRef.current = window.scrollY; setJobPageStack([{ view: "detail", jobId }]); };
    const openNewJob = () => { scrollPosRef.current = window.scrollY; setJobPageStack([{ view: "detail", jobId: null }]); };
  const pushJobSubpage = (view) => setJobPageStack(s => s.length ? [...s, { view, jobId: s[s.length-1].jobId }] : s);
  const popJobPage = () => setJobPageStack(s => s.slice(0, -1));
    const closeJobArea = () => setJobPageStack([]);
        useLayoutEffect(() => {
        if (jobPageStack.length === 0) {
            const y = scrollPosRef.current;
            if (y) {
                window.scrollTo(0, y);
                // re-apply briefly in case the list re-renders after the save syncs
                const t1 = setTimeout(() => window.scrollTo(0, y), 50);
                const t2 = setTimeout(() => window.scrollTo(0, y), 250);
                return () => { clearTimeout(t1); clearTimeout(t2); };
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, [jobPageStack]);
  const currentJobPage = jobPageStack[jobPageStack.length - 1] || null;
  const currentJob = currentJobPage?.jobId ? jobs.find(j => j.id === currentJobPage.jobId) : null;

  const saveJob = (job) => {
    if (!jobs.some(j => j.id === job.id)) {
      const adv = advanceJobCounter(settings, job.id);
      if (adv) setSettings(p => ({ ...p, jobNextNumber: adv }));
    }    setJobs(prev=>{const idx=prev.findIndex(j=>j.id===job.id);if(idx>=0){const n=[...prev];n[idx]=job;return n;}return[{...job, createdAt: job.createdAt || todayISO()},...prev];});
    closeJobArea();
  };
  const deleteJob = (jobId) => {
    setJobs(prev=>prev.filter(j=>j.id!==jobId));
    closeJobArea();
  };
  const importJobs = (incoming) => {
    setJobs(prev=>{
      const map=new Map(prev.map(j=>[j.id,j]));
      let added=0,updated=0;
      incoming.forEach(j=>{if(map.has(j.id)){map.set(j.id,{...map.get(j.id),...j});updated++;}else{map.set(j.id,{...j, createdAt: j.createdAt || todayISO()});added++;}});
      setToast(`Imported ${added} new job${added!==1?"s":""}${updated>0?`, updated ${updated}`:""}.`);
      setTimeout(()=>setToast(null),4000);
      return Array.from(map.values());
    });
  };
  // Dashboard stat cards jump straight to the filtered job list for that status —
  // On Hold and Follow Up keep their own dedicated detail pages (hold reason / follow-up
  // note); everything else, including Completed, goes to the Jobs table pre-filtered.
    const navigateToStatus = (status) => {
        if (status === "on-hold") { setTab("onhold"); return; }
        if (status === "follow-up") { setTab("followup"); return; }
        if (status === "completed") setShowCompletedJobs(true);
        setJobsPresetFilter(status);
        setJobsSortKey("id");
        setJobsSortDir("desc");
        setJobsSearch("");
        setJobsViewKey(k => k + 1);
        setTab("jobs");
    };
syncCustomStatuses(settings.customStatuses);
    if (session === undefined) return <FullScreenStatus message="Loading ApexOps…" />;    if (!session) return <LoginScreen />;
    if (dataLoading) return <FullScreenStatus message="Loading your data…" />;
    if (dataError) return <FullScreenStatus message={`Couldn't load your data: ${dataError}`} isError />;
  return (
    <div data-theme={settings.theme} style={{ display:"flex",minHeight:"100vh",background:"var(--bg-page)",fontFamily:"'Inter',system-ui,sans-serif" }}>
      <ThemeStyle />
          {!isMobile && (
              <div style={{ width: 230, background: SIDEBAR_BG, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100 }}>
                  <div style={{ padding: "28px 24px 20px", display: "flex", justifyContent: "center" }}>
                      <img src={logoSidebar} alt="ApexOps" style={{ height: 90, width: "auto", display: "block" }} />
                  </div>
                  <nav style={{ flex: 1, padding: "8px 12px", overflowY: "auto" }}>
                      {getOrderedNavItems(settings).filter(item => settings.visibleTabs[item.id] !== false).map(item => (
                          <button key={item.id} onClick={() => { closeJobArea(); if (item.id === "jobs") { setJobsPresetFilter("all"); setJobsSortKey("id"); setJobsSortDir("desc"); setJobsSearch(""); setJobsViewKey(k => k + 1); } setTab(item.id); }}
                              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", borderRadius: 9, border: "none", background: tab === item.id ? ACCENT : "transparent", color: tab === item.id ? INK : SIDEBAR_MUTED, fontWeight: tab === item.id ? 700 : 500, fontSize: 14, cursor: "pointer", marginBottom: 2, textAlign: "left" }}>
                              <span style={{ fontSize: 15 }}>{item.icon}</span>
                              {item.label}
                          </button>
                      ))}
                  </nav>
                  <div style={{ padding: "8px 12px", borderTop: `1px solid ${SIDEBAR_BORDER}` }}>
                      <button onClick={() => { closeJobArea(); setTab("settings"); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", borderRadius: 9, border: "none", background: tab === "settings" ? ACCENT : "transparent", color: tab === "settings" ? INK : SIDEBAR_MUTED, fontWeight: tab === "settings" ? 700 : 500, fontSize: 14, cursor: "pointer" }}>
                          <span style={{ fontSize: 15 }}>⚙</span>Settings
                      </button>
                  </div>
                  <div style={{ padding: "12px 24px 20px", borderTop: `1px solid ${SIDEBAR_BORDER}` }}>
                      <button onClick={openNewJob} style={{ width: "100%", padding: "11px 0", background: ACCENT, color: INK, border: "none", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>+ New Job</button>
                      <div style={{ fontSize: 11, color: SIDEBAR_MUTED, marginTop: 10 }}>{jobs.length} total jobs</div>
                      <button onClick={handleSignOut} style={{ background: "none", border: "none", color: SIDEBAR_MUTED, fontSize: 11, marginTop: 10, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Sign Out</button>
                  </div>
              </div>)}
              

          {isMobile && <MobileTopBar onMenuClick={() => setMobileMenuOpen(true)} />}
          {isMobile && mobileMenuOpen && (
              <MobileMenuOverlay
                  settings={settings} tab={tab} jobs={jobs}
                  onNavigate={(id) => { closeJobArea(); if (id === "jobs") { setJobsPresetFilter("all"); setJobsViewKey(k => k + 1); } setTab(id); setMobileMenuOpen(false); }}
                  onNewJob={() => { openNewJob(); setMobileMenuOpen(false); }}
                  onSignOut={handleSignOut}
                  onClose={() => setMobileMenuOpen(false)}
              />
          )}
          {isMobile && (
              <MobileBottomNav settings={settings} tab={tab}
                  onNavigate={(id) => { closeJobArea(); if (id === "jobs") { setJobsPresetFilter("all"); setJobsViewKey(k => k + 1); } setTab(id); }} />
          )}

          <div style={{ marginLeft: isMobile ? 0 : 230, marginTop: isMobile ? 56 : 0, marginBottom: isMobile ? 62 : 0, flex: 1, padding: isMobile ? 16 : 32, maxWidth: isMobile ? "100vw" : "calc(100vw - 230px)", boxSizing: "border-box" }}>
        {jobPageStack.length > 0 ? (
          <>
                        {currentJobPage.view === "detail" && (
              <JobDetailPage quotes={quotes} onOpenQuotes={()=>pushJobSubpage("quotes")} job={currentJob} staff={staff} roles={roles} customers={customers} setCustomers={setCustomers} suppliers={suppliers} timeEntries={timeEntries} purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} invoices={invoices} company={company} settings={settings}
                onSave={saveJob} onDelete={deleteJob} onBack={closeJobArea}
                onOpenTime={()=>pushJobSubpage("time")} onOpenNotes={()=>pushJobSubpage("notes")} onOpenCosts={()=>pushJobSubpage("costs")} onOpenInvoices={()=>pushJobSubpage("invoices")}/>
            )}
            {currentJobPage.view === "time" && (
              <JobTimePage job={currentJob} staff={staff} roles={roles} timeEntries={timeEntries} onBack={popJobPage}/>
            )}
            {currentJobPage.view === "notes" && (
              <JobNotesPage job={currentJob} setJobs={setJobs} company={company} onBack={popJobPage}/>
            )}
            {currentJobPage.view === "costs" && (
              <JobCostsPage jobs={jobs} bills={bills} setBills={setBills} job={currentJob} suppliers={suppliers} purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} setJobs={setJobs} company={company} settings={settings} onBack={popJobPage}/>
            )}
            {currentJobPage.view === "quotes" && (
              <JobQuotesPage job={currentJob} jobs={jobs} customers={customers} setCustomers={setCustomers} roles={roles} quotes={quotes} setQuotes={setQuotes} invoices={invoices} setInvoices={setInvoices} company={company} settings={settings} setSettings={setSettings} onBack={popJobPage}/>
            )}
            {currentJobPage.view === "invoices" && (
              <JobInvoicesPage job={currentJob} staff={staff} roles={roles} customers={customers} timeEntries={timeEntries} purchaseOrders={purchaseOrders} invoices={invoices} setInvoices={setInvoices} company={company} settings={settings} onBack={popJobPage}/>
            )}
          </>
        ) : (
          <>
                          {tab === "dashboard" && <Dashboard jobs={jobs} staff={staff} roles={roles} settings={settings} onNavigateStatus={navigateToStatus} />}
                          {tab === "jobs" && <JobsView key={jobsViewKey} jobs={jobs} staff={staff} customers={customers} settings={settings} setSettings={setSettings} initialFilter={jobsPresetFilter} showCompleted={showCompletedJobs} setShowCompleted={setShowCompletedJobs} sortKey={jobsSortKey} setSortKey={setJobsSortKey} sortDir={jobsSortDir} setSortDir={setJobsSortDir} search={jobsSearch} setSearch={setJobsSearch} onAdd={openNewJob} onEdit={j => openJob(j.id)} onBack={() => setTab("dashboard")} />}
            {tab==="onhold"    && <OnHoldView jobs={jobs} staff={staff} onEdit={j=>openJob(j.id)} onBack={()=>setTab("dashboard")}/>}
                          {tab === "schedule" && <SchedulerView jobs={jobs} staff={staff} roles={roles} settings={settings} scheduleData={schedulerDataObj.scheduleData} setScheduleData={setScheduleData} />}
                          {tab === "followup" && <FollowUpView jobs={jobs} staff={staff} onEdit={j => openJob(j.id)} onBack={() => setTab("dashboard")} />}
            {tab==="timesheets"&& <TimesheetsView jobs={jobs} staff={staff} roles={roles} timeEntries={timeEntries} setTimeEntries={setTimeEntries} settings={settings}/>}
            {tab==="purchaseorders" && <PurchaseOrdersView bills={bills} setBills={setBills} jobs={jobs} staff={staff} customers={customers} suppliers={suppliers} purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} company={company} settings={settings} onOpenJob={j=>openJob(j.id)}/>}
            {tab==="quotes"    &&<QuotesView invoices={invoices} setInvoices={setInvoices} jobs={jobs} customers={customers} setCustomers={setCustomers} roles={roles} quotes={quotes} setQuotes={setQuotes} company={company} settings={settings} setSettings={setSettings} onOpenJob={j=>openJob(j.id)}/>}
            {tab==="invoices"  && <InvoicesView jobs={jobs} customers={customers} invoices={invoices} setInvoices={setInvoices} staff={staff} roles={roles} timeEntries={timeEntries} purchaseOrders={purchaseOrders} company={company} settings={settings} onOpenJob={j=>openJob(j.id)}/>}            {tab==="bills"     && <BillsView bills={bills} setBills={setBills} setPurchaseOrders={setPurchaseOrders} setJobs={setJobs} suppliers={suppliers} jobs={jobs} purchaseOrders={purchaseOrders} settings={settings}/>}
                          {tab === "offsite" && <OffsiteView cols={offsiteTracker.cols} setCols={setOffsiteCols} data={offsiteTracker.data} setData={setOffsiteData} allocated={offsiteTracker.allocated} setAllocated={setOffsiteAllocated} />}
            {tab==="assets"    && <AssetsView assets={assets} setAssets={setAssets} groups={assetGroups} setGroups={setAssetGroups} staff={staff} settings={settings} setSettings={setSettings}/>}
            {tab==="contacts"  && <ContactsView customers={customers} setCustomers={setCustomers} suppliers={suppliers} setSuppliers={setSuppliers} company={company} setCompany={setCompany}/>}
            {tab==="settings"  && <SettingsView settings={settings} setSettings={setSettings} jobs={jobs} staff={staff} setStaff={setStaff} roles={roles} setRoles={setRoles} onImport={importJobs} customers={customers} setCustomers={setCustomers} suppliers={suppliers} setSuppliers={setSuppliers} company={company} setCompany={setCompany}/>}          </>
        )}
      </div>

      {toast && (
        <div style={{ position:"fixed",bottom:28,right:28,background:SIDEBAR_BG,color:"#fff",borderRadius:10,padding:"12px 20px",fontSize:13,fontWeight:700,boxShadow:"0 8px 24px #00000030",zIndex:2000,display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ color:ACCENT,fontSize:16 }}>✓</span>{toast}
        </div>
      )}
    </div>
  );
}
