"use client";

import { useEffect, useMemo, useState } from "react";
import { billing as billingApi, companies as companiesApi, licenses as licensesApi, auth, type CurrentUser } from "@/lib/api";
import type { BillingRecord, Company, License } from "@/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function cellBg(record: BillingRecord | null): string {
  if (!record)             return "bg-gray-50";
  if (record.payment_date) return "bg-green-50";
  if (record.invoice_date) return "bg-blue-50";
  return "bg-white";
}

// 日付→ステータス自動計算
function computeStatus(invoiceDate: string | null, paymentDate: string | null): string {
  if (paymentDate) return "payment_confirmed";
  if (invoiceDate) return "invoiced";
  return "uninvoiced";
}

const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

export default function BillingPage() {
  const [allRecords, setAllRecords] = useState<BillingRecord[]>([]);
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [me, setMe]                 = useState<CurrentUser | null>(null);
  const [year, setYear]             = useState(() => String(new Date().getFullYear()));
  const [allLicenses, setAllLicenses] = useState<License[]>([]);
  const [editTarget, setEditTarget]     = useState<BillingRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<{ record: BillingRecord; company: Company } | null>(null);

  useEffect(() => {
    auth.me().then(setMe).catch(() => {});
    companiesApi.list().then(setCompanies).catch(() => {});
    billingApi.list().then(setAllRecords).catch(console.error);
    licensesApi.list().then(setAllLicenses).catch(() => {});
  }, []);

  // 直下の会社のみ（支店除く）
  const directChildren = companies
    .filter((c) => c.parent_company_id === me?.company_id && c.level !== 6)
    .sort((a, b) => a.company_code.localeCompare(b.company_code));
  const directChildIds = new Set(directChildren.map((c) => c.id));

  // 指定company以下の全company_idセットを返す（frontendで再帰展開）
  const subtreeIds = useMemo(() => {
    const cache = new Map<number, Set<number>>();
    function build(rootId: number): Set<number> {
      if (cache.has(rootId)) return cache.get(rootId)!;
      const ids = new Set<number>([rootId]);
      for (const c of companies) {
        if (c.parent_company_id === rootId) {
          for (const id of build(c.id)) ids.add(id);
        }
      }
      cache.set(rootId, ids);
      return ids;
    }
    const result = new Map<number, Set<number>>();
    for (const child of directChildren) result.set(child.id, build(child.id));
    return result;
  }, [companies, directChildren]);

  // allLicensesからライブカウントを計算（バックエンド不要）
  const liveCounts = useMemo(() => {
    const billingStatuses = ["in_use", "suspended", "cancellation_scheduled"];
    const map = new Map<number, number>();
    for (const [childId, ids] of subtreeIds) {
      const count = allLicenses.filter(
        (l) => ids.has(l.company_id) && billingStatuses.includes(l.status)
      ).length;
      map.set(childId, count);
    }
    return map;
  }, [allLicenses, subtreeIds]);

  async function handleUpdate(
    record: BillingRecord,
    patch: { invoice_date?: string | null; payment_date?: string | null }
  ) {
    const newInvoiceDate = "invoice_date" in patch ? patch.invoice_date : record.invoice_date;
    const newPaymentDate = "payment_date" in patch ? patch.payment_date : record.payment_date;
    const updated = await billingApi.update(record.id, {
      payment_status: computeStatus(newInvoiceDate ?? null, newPaymentDate ?? null),
      invoice_date:   newInvoiceDate ?? null,
      payment_date:   newPaymentDate ?? null,
    });
    setAllRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    setEditTarget(updated);
    setDetailTarget((prev) => prev?.record.id === updated.id ? { ...prev, record: updated } : prev);
  }

  async function ensureAndOpen(company: Company, month: string, mode: "detail" | "edit") {
    const [rec, licenses] = await Promise.all([
      billingApi.ensure(company.id, month),
      licensesApi.list(),
    ]);
    setAllLicenses(licenses);
    setAllRecords((prev) =>
      prev.some((r) => r.id === rec.id) ? prev.map((r) => r.id === rec.id ? rec : r) : [...prev, rec]
    );
    if (mode === "detail") setDetailTarget({ record: rec, company });
    else setEditTarget(rec);
  }

  // 月次ピボット
  const months = Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`
  );
  const yearRecords = allRecords.filter(
    (r) => r.target_month.startsWith(year) && directChildIds.has(r.company_id)
  );
  // pivot[company_id][month] = record
  const pivot = new Map<number, Map<string, BillingRecord>>();
  for (const c of directChildren) pivot.set(c.id, new Map());
  for (const r of yearRecords) pivot.get(r.company_id)?.set(r.target_month, r);

  const yearOptions = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - 1 + i));

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">請求管理</h1>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-green-100" />入金済
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-100" />請求済
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-white border" />未請求
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-gray-100" />記録なし
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-yellow-100" />仮（当月リアルタイム）
        </span>
      </div>

      {/* 月次ピボットビュー */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs text-gray-500">
              <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 border-r whitespace-nowrap">企業名</th>
              <th className="px-3 py-3 text-left bg-gray-50 border-r whitespace-nowrap font-mono text-[11px]">企業コード</th>
              {months.map((m) => (
                <th key={m} className="px-3 py-3 text-center font-medium whitespace-nowrap min-w-[64px]">
                  {m.slice(5)}月
                </th>
              ))}
              <th className="px-3 py-3 text-center font-semibold whitespace-nowrap border-l-2 border-gray-300 bg-gray-100 text-gray-700">
                年間合計
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {directChildren.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-6 text-center text-gray-400">
                  データがありません
                </td>
              </tr>
            )}
            {directChildren.map((company) => {
              const cpivot = pivot.get(company.id) ?? new Map<string, BillingRecord>();
              const liveCount = liveCounts.get(company.id) ?? 0;
              const yearTotal = months.reduce((sum, m) => {
                if (m === currentMonth) return sum + liveCount;
                const rec = cpivot.get(m);
                if (rec) return sum + rec.license_count;
                return sum;
              }, 0);
              return (
                <tr key={company.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap sticky left-0 bg-white border-r">
                    {company.company_name}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-700 whitespace-nowrap border-r">
                    {company.company_code}
                  </td>
                  {months.map((m) => {
                    const rec = cpivot.get(m) ?? null;
                    const isCurrentMonth = m === currentMonth;
                    // 当月はライブカウントで表示（スナップショットが古い場合も正確に）
                    const showLive = !rec && isCurrentMonth;
                    const displayCount = isCurrentMonth ? liveCount : rec?.license_count ?? 0;
                    return (
                      <td
                        key={m}
                        className={`px-2 py-2 text-center text-xs border-l ${
                          isCurrentMonth && liveCount > 0 && !rec ? "bg-yellow-50" : cellBg(rec)
                        }`}
                      >
                        {rec ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => {
                                licensesApi.list().then(setAllLicenses).catch(() => {});
                                setDetailTarget({ record: rec, company });
                              }}
                              className="font-mono font-semibold hover:text-brand hover:underline px-1 leading-tight"
                            >
                              {displayCount}
                            </button>
                            <button
                              onClick={() => setEditTarget(rec)}
                              className={`text-xs px-1.5 py-0.5 rounded-full leading-none ${
                                rec.payment_date
                                  ? "text-green-700 bg-green-100 hover:bg-green-200"
                                  : rec.invoice_date
                                    ? "text-blue-600 bg-blue-100 hover:bg-blue-200"
                                    : "text-gray-400 hover:bg-gray-100"
                              }`}
                            >
                              {rec.payment_date ? "入金" : rec.invoice_date ? "請求" : "━"}
                            </button>
                          </div>
                        ) : showLive && liveCount > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => ensureAndOpen(company, m, "detail")}
                              className="font-mono font-semibold text-yellow-700 hover:text-yellow-900 hover:underline px-1 leading-tight"
                            >
                              {liveCount}
                            </button>
                            <button
                              onClick={() => ensureAndOpen(company, m, "edit")}
                              className="text-[10px] px-1.5 py-0.5 rounded-full leading-none text-yellow-600 bg-yellow-100 hover:bg-yellow-200"
                            >
                              ━
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center border-l-2 border-gray-300 bg-gray-50 font-mono font-bold text-gray-700 text-sm">
                    {yearTotal > 0 ? yearTotal : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-300 bg-gray-50">
            <tr className="text-xs font-semibold text-gray-700">
              <td className="px-4 py-2.5 sticky left-0 bg-gray-50 border-r">合計</td>
              <td className="px-3 py-2.5 border-r" />
              {months.map((m) => {
                const isCurrentMonth = m === currentMonth;
                const colTotal = directChildren.reduce((sum, company) => {
                  const cpivot = pivot.get(company.id) ?? new Map<string, BillingRecord>();
                  if (isCurrentMonth) return sum + (liveCounts.get(company.id) ?? 0);
                  const rec = cpivot.get(m);
                  return sum + (rec?.license_count ?? 0);
                }, 0);
                return (
                  <td key={m} className="px-2 py-2.5 text-center border-l font-mono">
                    {colTotal > 0 ? colTotal : "—"}
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-center border-l-2 border-gray-300 bg-gray-100 font-mono font-bold text-gray-800">
                {directChildren.reduce((sum, company) => {
                  const cpivot = pivot.get(company.id) ?? new Map<string, BillingRecord>();
                  return sum + months.reduce((s, m) => {
                    if (m === currentMonth) return s + (liveCounts.get(company.id) ?? 0);
                    const rec = cpivot.get(m);
                    return s + (rec?.license_count ?? 0);
                  }, 0);
                }, 0) || "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 詳細モーダル */}
      {detailTarget && (
        <DetailModal
          record={detailTarget.record}
          company={detailTarget.company}
          allCompanies={companies}
          allRecords={allRecords}
          allLicenses={allLicenses}
          onClose={() => setDetailTarget(null)}
          onOpenEdit={(rec) => { setDetailTarget(null); setEditTarget(rec); }}
        />
      )}

      {/* 編集モーダル */}
      {editTarget && (
        <EditModal
          record={editTarget}
          onUpdate={(patch) => handleUpdate(editTarget, patch)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

// ---- 詳細モーダル ----
const BILLING_STATUSES = ["in_use", "suspended", "cancellation_scheduled"];

function DetailModal({
  record,
  company,
  allCompanies,
  allRecords,
  allLicenses,
  onClose,
  onOpenEdit,
}: {
  record: BillingRecord;
  company: Company;
  allCompanies: Company[];
  allRecords: BillingRecord[];
  allLicenses: License[];
  onClose: () => void;
  onOpenEdit: (rec: BillingRecord) => void;
}) {
  const month = record.target_month;

  // 配下の会社（支店除く）
  const subCompanies = allCompanies
    .filter((c) => c.parent_company_id === company.id && c.level !== 6)
    .sort((a, b) => a.company_code.localeCompare(b.company_code));

  // ライセンスをcompany_idで直接カウント（請求対象ステータスのみ）
  const billingLicenses = (cid: number) =>
    allLicenses.filter((l) => l.company_id === cid && BILLING_STATUSES.includes(l.status));

  const subRows = subCompanies.map((sub) => ({
    company:  sub,
    record:   allRecords.find((r) => r.company_id === sub.id && r.target_month === month) ?? null,
    licenses: billingLicenses(sub.id),
  }));

  // 直轄 = 直接このcompanyに紐づくライセンス（サブツリーは含まない）
  const directLicenses = billingLicenses(company.id);
  const directCount    = directLicenses.length;

  const totalLiveCount = directCount + subRows.reduce((s, { record: subRec, licenses: subLicenses }) => {
    return s + (subRec?.license_count ?? subLicenses.length);
  }, 0);

  const { statusLabel, statusCls } = (() => {
    if (record.payment_date) return { statusLabel: "入金確認済", statusCls: "text-green-700 bg-green-50 border-green-200" };
    if (record.invoice_date) return { statusLabel: "請求済",     statusCls: "text-blue-700 bg-blue-50 border-blue-200" };
    return                          { statusLabel: "未請求",      statusCls: "text-gray-500 bg-gray-50 border-gray-200" };
  })();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-base">{company.company_name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-gray-400 mb-4">{month} · 合計 {totalLiveCount}件</p>

        {/* ステータス */}
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border mb-4 text-xs ${statusCls}`}>
          <span className="font-semibold">{statusLabel}</span>
          {record.invoice_date && <span>請求日: {record.invoice_date}</span>}
          {record.payment_date && <span>入金日: {record.payment_date}</span>}
        </div>

        {/* ライセンス内訳 */}
        <div className="space-y-1 mb-4">
          {/* 直轄分 */}
          <div className="py-2 px-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{company.company_name}（直轄）</p>
                <p className="text-xs text-gray-700 font-mono">{company.company_code}</p>
              </div>
              <span className="font-mono font-bold text-sm">
                {directCount}<span className="text-xs font-normal text-gray-500 ml-0.5">件</span>
              </span>
            </div>
            {directLicenses.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {directLicenses.map((l) => (
                  <span key={l.id} className="text-xs font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    {l.license_id}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 配下会社 */}
          {subRows.map(({ company: sub, record: subRec, licenses: subLicenses }) => {
            const displayCount = subRec?.license_count ?? subLicenses.length;
            return (
              <div key={sub.id} className="py-2 px-3 hover:bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">{sub.company_name}</p>
                    <p className="text-xs text-gray-700 font-mono">{sub.company_code}</p>
                  </div>
                  <span className="font-mono text-sm">
                    {displayCount > 0
                      ? <>{displayCount}<span className="text-xs text-gray-500 ml-0.5">件</span></>
                      : <span className="text-gray-300">—</span>}
                  </span>
                </div>
                {subLicenses.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {subLicenses.map((l) => (
                      <span key={l.id} className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {l.license_id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button onClick={onClose} className="text-sm px-4 py-2 border rounded hover:bg-gray-50">
            閉じる
          </button>
          <button
            onClick={() => onOpenEdit(record)}
            className="text-sm px-4 py-2 bg-brand text-white rounded hover:bg-brand-dark"
          >
            請求・入金設定
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- 編集モーダル（トップレベルコンポーネント）----
function EditModal({
  record,
  onUpdate,
  onClose,
}: {
  record: BillingRecord;
  onUpdate: (patch: { invoice_date?: string | null; payment_date?: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [invoiceDate, setInvoiceDate] = useState(record.invoice_date ?? "");
  const [paymentDate, setPaymentDate] = useState(record.payment_date ?? "");
  const [saving, setSaving] = useState(false);

  const isComplete = !!paymentDate;

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate({
        invoice_date: invoiceDate || null,
        payment_date: paymentDate || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className={`bg-white rounded-xl shadow-xl w-full max-w-sm p-6 border-t-4 transition-colors ${isComplete ? "border-green-400" : "border-gray-200"}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-base">{record.company_name}</h2>
            <p className="text-xs text-gray-400">{record.target_month} · ライセンス {record.license_count}件</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        {isComplete && (
          <div className="mb-4 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 font-medium">
            入金確認済
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">請求日</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              {!invoiceDate && (
                <button
                  onClick={() => setInvoiceDate(todayStr())}
                  className="text-xs border px-2 py-1 rounded text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                >
                  今日
                </button>
              )}
              {invoiceDate && (
                <button
                  onClick={() => setInvoiceDate("")}
                  className="text-xs border px-2 py-1 rounded text-red-400 hover:bg-red-50"
                >
                  クリア
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">入金日</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              {!paymentDate && (
                <button
                  onClick={() => setPaymentDate(todayStr())}
                  className="text-xs border px-2 py-1 rounded text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                >
                  今日
                </button>
              )}
              {paymentDate && (
                <button
                  onClick={() => setPaymentDate("")}
                  className="text-xs border px-2 py-1 rounded text-red-400 hover:bg-red-50"
                >
                  クリア
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`text-sm px-5 py-2 rounded text-white disabled:opacity-50 ${isComplete ? "bg-green-600 hover:bg-green-700" : "bg-brand hover:bg-brand-dark"}`}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
