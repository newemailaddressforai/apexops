import { useState, useRef } from "react";
import { supabase } from "./supabaseClient";

// ─── FIELD MAPPERS (JS camelCase <-> SQL snake_case) ──────────────────────────
// Each entity has toRow (JS object -> DB row) and fromRow (DB row -> JS object).

const staffMap = {
  toRow: (s) => ({ id: s.id, name: s.name, role_id: s.roleId || null, color: s.color }),
  fromRow: (r) => ({ id: r.id, name: r.name, roleId: r.role_id, color: r.color }),
};

const rolesMap = {
  toRow: (r) => ({ id: r.id, name: r.name, cost_rate: r.costRate || 0, charge_out_rate: r.chargeOutRate || 0 }),
  fromRow: (r) => ({ id: r.id, name: r.name, costRate: r.cost_rate, chargeOutRate: r.charge_out_rate }),
};

const contactMap = {
  toRow: (c) => ({ id: c.id, name: c.name, contact_person: c.contactPerson || "", phone: c.phone || "", email: c.email || "", address: c.address || "" }),
  fromRow: (r) => ({ id: r.id, name: r.name, contactPerson: r.contact_person, phone: r.phone, email: r.email, address: r.address }),
};

const companyMap = {
  toRow: (c) => ({ id: "main", name: c.name || "", address: c.address || "", phone: c.phone || "", email: c.email || "", abn: c.abn || "" }),
  fromRow: (r) => ({ name: r.name, address: r.address, phone: r.phone, email: r.email, abn: r.abn }),
};

const settingsMap = {
  toRow: (s) => ({
    id: "main",
    theme: s.theme,
    week_start_day: s.weekStartDay,
    visible_tabs: s.visibleTabs,
    tab_order: s.tabOrder || [],
    po_footer_note: s.poFooterNote || "",
    po_terms: s.poTerms || "",
    job_custom_fields: s.jobCustomFields || [],
    job_sheet_footer_note: s.jobSheetFooterNote || "",
    job_sheet_fields: s.jobSheetFields,
    job_summary_fields: s.jobSummaryFields || [],
    asset_summary_fields: s.assetSummaryFields || [],
  }),
  fromRow: (r) => ({
    theme: r.theme,
    weekStartDay: r.week_start_day,
    visibleTabs: r.visible_tabs,
    tabOrder: r.tab_order || [],
    poFooterNote: r.po_footer_note || "",
    poTerms: r.po_terms || "",
    jobCustomFields: r.job_custom_fields || [],
    jobSheetFooterNote: r.job_sheet_footer_note || "",
    jobSheetFields: r.job_sheet_fields,
    jobSummaryFields: r.job_summary_fields || [],
    assetSummaryFields: r.asset_summary_fields || [],
  }),
};

const timeEntryMap = {
  toRow: (t) => ({ id: t.id, staff_id: t.staffId, job_id: t.jobId || null, date: t.date, start_time: t.startTime, end_time: t.endTime, hours: t.hours }),
  fromRow: (r) => ({ id: r.id, staffId: r.staff_id, jobId: r.job_id, date: r.date, startTime: r.start_time?.slice(0,5), endTime: r.end_time?.slice(0,5), hours: Number(r.hours) }),
};

const poMap = {
  toRow: (p) => ({ id: p.id, po_number: p.poNumber, job_id: p.jobId || null, supplier_id: p.supplierId || null, reference: p.reference || "", details: p.details || "", date_created: p.dateCreated, status: p.status, billed_cost: p.billedCost }),
  fromRow: (r) => ({ id: r.id, poNumber: r.po_number, jobId: r.job_id, supplierId: r.supplier_id, reference: r.reference, details: r.details, dateCreated: r.date_created, status: r.status, billedCost: r.billed_cost != null ? Number(r.billed_cost) : null }),
};

const assetMap = {
  toRow: (a) => ({ id: a.id, name: a.name, group_id: a.groupId || null, make: a.make || "", model: a.model || "", identifier: a.identifier || "", purchase_date: a.purchaseDate || null, purchase_price: a.purchasePrice || 0, status: a.status, location: a.location || "", assigned_to: a.assignedTo || null, next_service_date: a.nextServiceDate || null, notes: a.notes || "" }),
  fromRow: (r) => ({ id: r.id, name: r.name, groupId: r.group_id, make: r.make, model: r.model, identifier: r.identifier, purchaseDate: r.purchase_date, purchasePrice: Number(r.purchase_price)||0, status: r.status, location: r.location, assignedTo: r.assigned_to, nextServiceDate: r.next_service_date, notes: r.notes, createdAt: r.created_at?.split("T")[0] }),
};

const assetGroupMap = {
  toRow: (g) => ({ id: g.id, name: g.name, color: g.color }),
  fromRow: (r) => ({ id: r.id, name: r.name, color: r.color }),
};

const jobCoreMap = {
  toRow: (j) => ({
    id: j.id, title: j.title, client: j.client || "", work_order_no: j.workOrderNo || "", order_no: j.orderNo || "",
    status: j.status, assigned_to: j.assignedTo || [], hold_reason: j.holdReason || null, hold_since: j.holdSince || null,
    follow_up_note: j.followUpNote || null, follow_up_since: j.followUpSince || null, notes: j.notes || "",
    custom_fields: j.customFields || {},
  }),
  fromRow: (r) => ({
    id: r.id, title: r.title, client: r.client, workOrderNo: r.work_order_no, orderNo: r.order_no,
    status: r.status, assignedTo: r.assigned_to || [], holdReason: r.hold_reason, holdSince: r.hold_since,
    followUpNote: r.follow_up_note, followUpSince: r.follow_up_since, notes: r.notes,
    customFields: r.custom_fields || {}, createdAt: r.created_at?.split("T")[0],
  }),
};

const jobNoteMap = {
  toRow: (jobId, n) => ({ id: n.id, job_id: jobId, name: n.name, text: n.text || "", photos: n.photos || [] }),
  fromRow: (r) => ({ id: r.id, name: r.name, text: r.text, photos: r.photos || [], createdAt: r.created_at?.split("T")[0] }),
};

const jobCostMap = {
  toRow: (jobId, c) => ({ id: c.id, job_id: jobId, label: c.label, amount: c.amount }),
  fromRow: (r) => ({ id: r.id, label: r.label, amount: Number(r.amount), createdAt: r.created_at?.split("T")[0] }),
};

// ─── GENERIC ARRAY SYNC HOOK ────────────────────────────────────────────────────
// Behaves exactly like useState for arrays keyed by `id` (same functional-update
// signature every component already uses), but silently diffs each change against
// Supabase in the background: new ids -> insert, changed ids -> update, missing -> delete.
export function useSyncedTable(tableName, mapper, onError) {
  const [state, setState] = useState([]);

  const syncDiff = async (prev, next) => {
    const prevMap = new Map(prev.map(x => [x.id, x]));
    const nextMap = new Map(next.map(x => [x.id, x]));
    try {
      const toDelete = [...prevMap.keys()].filter(id => !nextMap.has(id));
      if (toDelete.length) await supabase.from(tableName).delete().in("id", toDelete);
      const toUpsert = [];
      for (const [id, item] of nextMap) {
        const prevItem = prevMap.get(id);
        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(item)) toUpsert.push(mapper.toRow(item));
      }
      if (toUpsert.length) {
        const { error } = await supabase.from(tableName).upsert(toUpsert);
        if (error) throw error;
      }
    } catch (err) {
      onError?.(`Failed to save changes to ${tableName}: ${err.message}`);
    }
  };

  const setSynced = (updater) => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      syncDiff(prev, next);
      return next;
    });
  };

  const setSilently = (value) => setState(value);

  return [state, setSynced, setSilently];
}

// ─── SINGLETON SYNC HOOK (company, settings — always exactly one row) ─────────
export function useSyncedSingleton(tableName, mapper, defaultValue, onError) {
  const [state, setState] = useState(defaultValue);

  const setSynced = (updater) => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      supabase.from(tableName).upsert(mapper.toRow(next)).then(({ error }) => {
        if (error) onError?.(`Failed to save ${tableName}: ${error.message}`);
      });
      return next;
    });
  };

  const setSilently = (value) => setState(value);

  return [state, setSynced, setSilently];
}

// ─── JOBS SYNC HOOK (special: core fields + two nested child tables) ──────────
export function useSyncedJobs(onError) {
  const [jobs, setJobsState] = useState([]);

  const coreFieldsEqual = (a, b) => {
    const { jobNotes: an, jobCosts: ac, ...aCore } = a;
    const { jobNotes: bn, jobCosts: bc, ...bCore } = b;
    return JSON.stringify(aCore) === JSON.stringify(bCore);
  };

  const syncNotes = async (jobId, prevNotes = [], nextNotes = []) => {
    const prevMap = new Map(prevNotes.map(n => [n.id, n]));
    const nextMap = new Map(nextNotes.map(n => [n.id, n]));
    const toDelete = [...prevMap.keys()].filter(id => !nextMap.has(id));
    if (toDelete.length) await supabase.from("job_notes").delete().in("id", toDelete);
    const toUpsert = [];
    for (const [id, note] of nextMap) {
      const prevNote = prevMap.get(id);
      if (!prevNote || JSON.stringify(prevNote) !== JSON.stringify(note)) toUpsert.push(jobNoteMap.toRow(jobId, note));
    }
    if (toUpsert.length) await supabase.from("job_notes").upsert(toUpsert);
  };

  const syncCosts = async (jobId, prevCosts = [], nextCosts = []) => {
    const prevMap = new Map(prevCosts.map(c => [c.id, c]));
    const nextMap = new Map(nextCosts.map(c => [c.id, c]));
    const toDelete = [...prevMap.keys()].filter(id => !nextMap.has(id));
    if (toDelete.length) await supabase.from("job_costs").delete().in("id", toDelete);
    const toUpsert = [];
    for (const [id, cost] of nextMap) {
      const prevCost = prevMap.get(id);
      if (!prevCost || JSON.stringify(prevCost) !== JSON.stringify(cost)) toUpsert.push(jobCostMap.toRow(jobId, cost));
    }
    if (toUpsert.length) await supabase.from("job_costs").upsert(toUpsert);
  };

  const syncDiff = async (prev, next) => {
    try {
      const prevMap = new Map(prev.map(j => [j.id, j]));
      const nextMap = new Map(next.map(j => [j.id, j]));
      const toDelete = [...prevMap.keys()].filter(id => !nextMap.has(id));
      if (toDelete.length) await supabase.from("jobs").delete().in("id", toDelete); // cascades notes/costs

      for (const [id, job] of nextMap) {
        const prevJob = prevMap.get(id);
        if (!prevJob || !coreFieldsEqual(prevJob, job)) {
          const { error } = await supabase.from("jobs").upsert(jobCoreMap.toRow(job));
          if (error) throw error;
        }
        await syncNotes(id, prevJob?.jobNotes, job.jobNotes);
        await syncCosts(id, prevJob?.jobCosts, job.jobCosts);
      }
    } catch (err) {
      onError?.(`Failed to save job changes: ${err.message}`);
    }
  };

  const setJobs = (updater) => {
    setJobsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      syncDiff(prev, next);
      return next;
    });
  };

  const setJobsSilently = (value) => setJobsState(value);

  return [jobs, setJobs, setJobsSilently];
}

// ─── INITIAL LOAD: fetch everything from Supabase in one go ───────────────────
export async function fetchAllData() {
  const [
    staffRes, rolesRes, customersRes, suppliersRes, companyRes, settingsRes,
    jobsRes, jobNotesRes, jobCostsRes, timeEntriesRes, poRes, assetsRes, assetGroupsRes,
  ] = await Promise.all([
    supabase.from("staff").select("*"),
    supabase.from("roles").select("*"),
    supabase.from("customers").select("*"),
    supabase.from("suppliers").select("*"),
    supabase.from("company").select("*").eq("id", "main").maybeSingle(),
    supabase.from("settings").select("*").eq("id", "main").maybeSingle(),
    supabase.from("jobs").select("*"),
    supabase.from("job_notes").select("*"),
    supabase.from("job_costs").select("*"),
    supabase.from("time_entries").select("*"),
    supabase.from("purchase_orders").select("*"),
    supabase.from("assets").select("*"),
    supabase.from("asset_groups").select("*"),
  ]);

  const firstError = [staffRes, rolesRes, customersRes, suppliersRes, jobsRes, jobNotesRes, jobCostsRes, timeEntriesRes, poRes, assetsRes, assetGroupsRes].find(r => r.error);
  if (firstError?.error) throw firstError.error;

  // Attach notes/costs onto their parent job
  const notesByJob = {};
  (jobNotesRes.data || []).forEach(r => { (notesByJob[r.job_id] ||= []).push(jobNoteMap.fromRow(r)); });
  const costsByJob = {};
  (jobCostsRes.data || []).forEach(r => { (costsByJob[r.job_id] ||= []).push(jobCostMap.fromRow(r)); });

  const jobs = (jobsRes.data || []).map(r => ({
    ...jobCoreMap.fromRow(r),
    jobNotes: notesByJob[r.id] || [],
    jobCosts: costsByJob[r.id] || [],
  }));

  return {
    staff: (staffRes.data || []).map(staffMap.fromRow),
    roles: (rolesRes.data || []).map(rolesMap.fromRow),
    customers: (customersRes.data || []).map(contactMap.fromRow),
    suppliers: (suppliersRes.data || []).map(contactMap.fromRow),
    company: companyRes.data ? companyMap.fromRow(companyRes.data) : null,
    settings: settingsRes.data ? settingsMap.fromRow(settingsRes.data) : null,
    jobs,
    timeEntries: (timeEntriesRes.data || []).map(timeEntryMap.fromRow),
    purchaseOrders: (poRes.data || []).map(poMap.fromRow),
    assets: (assetsRes.data || []).map(assetMap.fromRow),
    assetGroups: (assetGroupsRes.data || []).map(assetGroupMap.fromRow),
  };
}

// Seeds the company/settings singleton rows on first-ever run (fresh database).
export async function ensureSingletonsExist(defaultCompany, defaultSettings) {
  const { data: existingCompany } = await supabase.from("company").select("id").eq("id", "main").maybeSingle();
  if (!existingCompany) await supabase.from("company").insert(companyMap.toRow(defaultCompany));

  const { data: existingSettings } = await supabase.from("settings").select("id").eq("id", "main").maybeSingle();
  if (!existingSettings) await supabase.from("settings").insert(settingsMap.toRow(defaultSettings));
}

export { staffMap, rolesMap, contactMap, companyMap, settingsMap, timeEntryMap, poMap, assetMap, assetGroupMap, jobCoreMap, jobNoteMap, jobCostMap };
