"use client";

import { useEffect, useState } from "react";
import { licenses as licensesApi, workers as workersApi, companies as companiesApi, auth, type CurrentUser } from "@/lib/api";
import type { License, Worker, Company } from "@/types";

type NewLicenseStatus = License["status"];

const STATUS_LABELS: Record<NewLicenseStatus, string> = {
  unassigned: "未割当",
  in_use: "利用中",
  suspended: "停止予約",
  cancellation_scheduled: "解約予定",
  cancelled: "解約済",
};

const STATUS_BADGE: Record<NewLicenseStatus, string> = {
  unassigned: "bg-gray-100 text-gray-600",
  in_use: "bg-green-100 text-green-700",
  suspended: "bg-yellow-100 text-yellow-700",
  cancellation_scheduled: "bg-orange-100 text-orange-700",
  cancelled: "bg-red-100 text-red-600",
};

// ステータス表示：日付を考慮して「予約」→「実施済」に切り替え
function licenseStatusLabel(lic: License): string {
  const today = new Date().toISOString().slice(0, 10);
  if (lic.status === "suspended") {
    return lic.valid_until < today ? "停止中" : "停止予約";
  }
  if (lic.status === "cancellation_scheduled") {
    return (lic.end_date ?? lic.valid_until) < today ? "解約済" : "解約予定";
  }
  return STATUS_LABELS[lic.status];
}

function licenseStatusBadge(lic: License): string {
  const today = new Date().toISOString().slice(0, 10);
  if (lic.status === "suspended") {
    return lic.valid_until < today
      ? "bg-gray-200 text-gray-600"        // 停止中
      : "bg-yellow-100 text-yellow-700";   // 停止予約
  }
  if (lic.status === "cancellation_scheduled") {
    return (lic.end_date ?? lic.valid_until) < today
      ? "bg-red-100 text-red-600"          // 解約済
      : "bg-orange-100 text-orange-700";   // 解約予定
  }
  return STATUS_BADGE[lic.status];
}

// 利用可能かどうか（有効期間を濃く表示するか）
function isLicenseActive(lic: License): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (lic.status === "in_use") return true;
  if (lic.status === "suspended") return lic.valid_until >= today; // 停止予約中はまだ有効
  if (lic.status === "cancellation_scheduled") return (lic.end_date ?? lic.valid_until) >= today; // 解約予定中はまだ有効
  return false; // unassigned / cancelled
}

export default function LicensesPage() {
  const [licenseList, setLicenseList] = useState<License[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [assignTarget, setAssignTarget] = useState<License | null>(null);
  const [detailTarget, setDetailTarget] = useState<License | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  async function loadLicenses() {
    const data = await licensesApi.list().catch(() => []);
    setLicenseList(data);
  }

  useEffect(() => {
    loadLicenses();
    companiesApi.list().then(setAllCompanies).catch(() => {});
    workersApi.list({ status: "active" }).then(setAllWorkers).catch(() => {});
    auth.me().then(setMe).catch(() => {});
  }, []);

  async function handleSuspend(licenseId: string) {
    if (!confirm("このライセンスを停止しますか？")) return;
    setLoading(true);
    await licensesApi.suspend(licenseId).catch(console.error);
    await loadLicenses();
    setLoading(false);
  }

  async function handleCancel(licenseId: string) {
    if (!confirm("このライセンスの解約を申請しますか？当月末で終了します。")) return;
    setLoading(true);
    await licensesApi.cancel(licenseId).catch(console.error);
    await loadLicenses();
    setLoading(false);
  }

  async function refreshAfterAssign() {
    await loadLicenses();
    setAssignTarget(null);
  }

  const BILLING_STATUSES = ["in_use", "suspended", "cancellation_scheduled"];
  const payCount = licenseList.filter((l) => BILLING_STATUSES.includes(l.status)).length;
  const billCount = licenseList.filter((l) => BILLING_STATUSES.includes(l.status) && l.company_id !== me?.company_id).length;

  const filtered = filterStatus
    ? licenseList.filter((l) => l.status === filterStatus)
    : licenseList;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ライセンス管理</h1>
        <button
          onClick={() => setApplyOpen(true)}
          className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-dark"
        >
          + ライセンス申請
        </button>
      </div>

      <div className="flex gap-4">
        <div className="bg-white border rounded-xl px-5 py-3 flex items-center gap-3">
          <span className="text-xs text-gray-500">支払対象ライセンス</span>
          <span className="text-2xl font-bold tabular-nums text-gray-800">{payCount}</span>
          <span className="text-xs text-gray-400">件</span>
        </div>
        {me && me.level <= 4 && (
          <div className="bg-white border rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-xs text-gray-500">請求対象ライセンス</span>
            <span className="text-2xl font-bold tabular-nums text-gray-800">{billCount}</span>
            <span className="text-xs text-gray-400">件</span>
          </div>
        )}
      </div>

      <LicenseListTab
        licenses={filtered}
        myCompanyId={me?.company_id ?? null}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        loading={loading}
        onSuspend={handleSuspend}
        onCancel={handleCancel}
        onAssign={(lic) => setAssignTarget(lic)}
        onDetail={(lic) => setDetailTarget(lic)}
      />

      {applyOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <h2 className="font-semibold text-lg">ライセンス申請</h2>
              <button onClick={() => setApplyOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="p-6">
              <ApplyTab
                allCompanies={allCompanies}
                myCompanyId={me?.company_id ?? null}
                onApplied={() => {
                  loadLicenses();
                  setApplyOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {detailTarget && (
        <LicenseDetailModal
          license={detailTarget}
          onClose={() => setDetailTarget(null)}
          onAssign={() => { setAssignTarget(detailTarget); setDetailTarget(null); }}
        />
      )}

      {assignTarget && (
        <AssignModal
          license={assignTarget}
          allWorkers={allWorkers}
          allCompanies={allCompanies}
          onSaved={refreshAfterAssign}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  );
}

type SortKey = "id" | "status" | "applied_at";

// ---- ライセンス行（トップレベルコンポーネント）----
function LicenseTableHead({
  showAppliedBy,
  sortKey,
  sortDir,
  onSort,
}: {
  showAppliedBy: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1 hover:text-gray-700"
      >
        {label}
        <span className={`text-[10px] leading-none ${active ? "text-brand" : "text-gray-300"}`}>
          {active && sortDir === "desc" ? "▼" : "▲"}
        </span>
      </button>
    );
  }
  return (
    <thead className="bg-gray-50 border-b">
      <tr className="text-left text-gray-500 text-xs">
        <th className="px-4 py-3"><SortBtn col="id" label="ライセンスID" /></th>
        <th className="px-4 py-3"><SortBtn col="status" label="ステータス" /></th>
        <th className="px-4 py-3">利用会社</th>
        <th className="px-4 py-3">支店</th>
        <th className="px-4 py-3">作業員</th>
        {showAppliedBy && <th className="px-4 py-3">申請元</th>}
        <th className="px-4 py-3"><SortBtn col="applied_at" label="発行日" /></th>
        <th className="px-4 py-3">有効期間</th>
        <th className="px-4 py-3">操作</th>
      </tr>
    </thead>
  );
}

function LicenseRows({
  rows,
  showAppliedBy,
  loading,
  onAssign,
  onSuspend,
  onCancel,
  onDetail,
}: {
  rows: License[];
  showAppliedBy: boolean;
  loading: boolean;
  onAssign: (lic: License) => void;
  onSuspend: (id: string) => void;
  onCancel: (id: string) => void;
  onDetail: (lic: License) => void;
}) {
  const colSpan = showAppliedBy ? 8 : 7;
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-5 text-center text-gray-400 text-[10px]">
          ライセンスがありません
        </td>
      </tr>
    );
  }
  return (
    <>
      {rows.map((lic) => (
        <tr key={lic.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDetail(lic)}>
          <td className="px-4 py-3 font-mono text-xs font-semibold text-brand">
            {lic.license_id}
          </td>
          <td className="px-4 py-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${licenseStatusBadge(lic)}`}>
              {licenseStatusLabel(lic)}
            </span>
          </td>
          <td className="px-4 py-3 text-xs text-gray-600">
            <div>{lic.company_name}</div>
            <div className="font-mono text-xs text-gray-700">{lic.company_code}</div>
          </td>
          <td className="px-4 py-3 text-xs text-gray-500">{lic.branch_name ?? "—"}</td>
          <td className="px-4 py-3 text-xs text-gray-500">{lic.worker_name ?? "—"}</td>
          {showAppliedBy && (
            <td className="px-4 py-3 text-xs text-gray-500">
              {lic.applied_by_company_name ?? "—"}
            </td>
          )}
          <td className="px-4 py-3 text-xs text-gray-500">
            {lic.applied_at.slice(0, 10)}
          </td>
          <td className={`px-4 py-3 text-xs ${isLicenseActive(lic) ? "text-gray-700" : "text-gray-300"}`}>
            {lic.valid_from} 〜{" "}
            {(lic.status === "unassigned" || lic.status === "in_use")
              ? <span className="text-gray-300">（自動更新）</span>
              : (lic.end_date ?? lic.valid_until)}
          </td>
          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1">
              {(lic.status === "unassigned" || lic.status === "in_use" || lic.status === "suspended") && (
                <button
                  onClick={() => onAssign(lic)}
                  disabled={loading}
                  className="text-xs border px-2 py-1 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                >
                  {lic.worker_id ? "割当変更" : "割当"}
                </button>
              )}
              {lic.status !== "cancelled" && lic.status !== "cancellation_scheduled" && (
                <button
                  onClick={() => onSuspend(lic.license_id)}
                  disabled={loading || lic.status === "suspended" || lic.status === "unassigned"}
                  className="text-xs border px-2 py-1 rounded text-yellow-600 hover:bg-yellow-50 disabled:opacity-40"
                >
                  停止
                </button>
              )}
              {lic.status !== "cancelled" && lic.status !== "cancellation_scheduled" && (
                <button
                  onClick={() => onCancel(lic.license_id)}
                  disabled={loading}
                  className="text-xs border px-2 py-1 rounded text-red-500 hover:bg-red-50 disabled:opacity-40"
                >
                  解約
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ---- ライセンス一覧タブ ----
function LicenseListTab({
  licenses,
  myCompanyId,
  filterStatus,
  onFilterChange,
  loading,
  onSuspend,
  onCancel,
  onAssign,
  onDetail,
}: {
  licenses: License[];
  myCompanyId: number | null;
  filterStatus: string;
  onFilterChange: (v: string) => void;
  loading: boolean;
  onSuspend: (id: string) => void;
  onCancel: (id: string) => void;
  onAssign: (lic: License) => void;
  onDetail: (lic: License) => void;
}) {
  const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "", label: "すべて" },
    { value: "unassigned", label: "未割当" },
    { value: "in_use", label: "利用中" },
    { value: "suspended", label: "停止予約" },
    { value: "cancellation_scheduled", label: "解約予定" },
    { value: "cancelled", label: "解約済" },
  ];

  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortLicenses(list: License[]): License[] {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "id") cmp = a.id - b.id;
      else if (sortKey === "status") cmp = licenseStatusLabel(a).localeCompare(licenseStatusLabel(b), "ja");
      else if (sortKey === "applied_at") cmp = a.applied_at.localeCompare(b.applied_at);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const ownLicenses = sortLicenses(licenses.filter((l) => l.company_id === myCompanyId));
  const subLicenses = sortLicenses(licenses.filter((l) => l.company_id !== myCompanyId));

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">ステータス:</span>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange(opt.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterStatus === opt.value
                  ? "bg-brand text-white border-brand"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 統合テーブル */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs">
          <LicenseTableHead showAppliedBy={true} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <tbody className="divide-y">
            {/* 自社ライセンス セクション */}
            <tr className="bg-gray-50">
              <td colSpan={9} className="px-4 py-1.5 text-xs font-semibold text-gray-600">
                自社のライセンス
              </td>
            </tr>
            <LicenseRows rows={ownLicenses} showAppliedBy={true} loading={loading} onAssign={onAssign} onSuspend={onSuspend} onCancel={onCancel} onDetail={onDetail} />

            {/* 配下会社ライセンス セクション */}
            {subLicenses.length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td colSpan={9} className="px-4 py-1.5 text-xs font-semibold text-gray-500">
                    配下会社のライセンス
                    <span className="ml-2 font-normal text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{subLicenses.length}</span>
                  </td>
                </tr>
                <LicenseRows rows={subLicenses} showAppliedBy={true} loading={loading} onAssign={onAssign} onSuspend={onSuspend} onCancel={onCancel} onDetail={onDetail} />
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- 詳細モーダル ----
function LicenseDetailModal({
  license: lic,
  onClose,
  onAssign,
}: {
  license: License;
  onClose: () => void;
  onAssign: () => void;
}) {
  const canAssign = lic.status === "unassigned" || lic.status === "in_use" || lic.status === "suspended";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono font-bold text-brand text-base">{lic.license_id}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${licenseStatusBadge(lic)}`}>
              {licenseStatusLabel(lic)}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <dl className="space-y-2 text-sm divide-y">
          <div className="flex justify-between pt-2">
            <dt className="text-gray-500">利用会社</dt>
            <dd className="text-right">
              <div className="font-medium">{lic.company_name}</div>
              <div className="font-mono text-[10px] text-gray-500">{lic.company_code}</div>
            </dd>
          </div>
          <div className="flex justify-between pt-2">
            <dt className="text-gray-500">支店</dt>
            <dd className="font-medium">{lic.branch_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between pt-2">
            <dt className="text-gray-500">作業員</dt>
            <dd className="font-medium">{lic.worker_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between pt-2">
            <dt className="text-gray-500">申請元</dt>
            <dd className="font-medium">{lic.applied_by_company_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between pt-2">
            <dt className="text-gray-500">発行日</dt>
            <dd className="tabular-nums">{lic.applied_at.slice(0, 10)}</dd>
          </div>
          <div className="flex justify-between pt-2">
            <dt className="text-gray-500">有効期間</dt>
            <dd className="tabular-nums">
              {lic.valid_from} 〜{" "}
              {(lic.status === "unassigned" || lic.status === "in_use")
                ? "（自動更新）"
                : (lic.end_date ?? lic.valid_until)}
            </dd>
          </div>
        </dl>

        {canAssign && (
          <div className="pt-2">
            <button
              onClick={onAssign}
              className="w-full text-xs border px-3 py-2 rounded text-blue-600 hover:bg-blue-50"
            >
              {lic.worker_id ? "割当変更" : "割当"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- 割当モーダル ----
function AssignModal({
  license,
  allWorkers,
  allCompanies,
  onSaved,
  onClose,
}: {
  license: License;
  allWorkers: Worker[];
  allCompanies: Company[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const licenseCompany = allCompanies.find((c) => c.id === license.company_id);
  const subCompanyIds = licenseCompany
    ? allCompanies
        .filter((c) => c.company_code.startsWith(licenseCompany.company_code))
        .map((c) => c.id)
    : [license.company_id];
  const availableWorkers = allWorkers.filter((w) => subCompanyIds.includes(w.company_id));
  const branches = allCompanies.filter(
    (c) => c.level === 6 && c.parent_company_id === license.company_id
  );

  const [selectedWorkerId, setSelectedWorkerId] = useState(
    license.worker_id ? String(license.worker_id) : ""
  );
  const [selectedBranchId, setSelectedBranchId] = useState(
    license.branch_id ? String(license.branch_id) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await licensesApi.assign(license.license_id, {
        worker_id: selectedWorkerId ? Number(selectedWorkerId) : null,
        branch_id: selectedBranchId ? Number(selectedBranchId) : null,
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">ライセンス割当</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <p className="text-[10px] text-gray-500 mb-4 font-mono bg-gray-50 px-3 py-2 rounded">
          {license.license_id}　<span className="text-gray-400">{license.company_name}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">支店（任意）</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-xs"
            >
              <option value="">支店なし</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">
              作業員（任意）
              {availableWorkers.length === 0 && (
                <span className="ml-2 text-gray-400 font-normal">— 作業員がいません</span>
              )}
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-xs"
            >
              <option value="">割当なし</option>
              {availableWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-500 text-[10px]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-xs px-5 py-2 bg-brand text-white rounded hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? "保存中..." : "割当保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const LEVEL_LABELS: Record<number, string> = {
  1: "オーナー",
  2: "一次代理店",
  3: "二次代理店",
  4: "三次代理店",
  5: "整備会社",
  6: "支店",
};

// ---- ライセンス申請タブ ----
function ApplyTab({
  allCompanies,
  myCompanyId,
  onApplied,
}: {
  allCompanies: Company[];
  myCompanyId: number | null;
  onApplied: () => void;
}) {
  const myCompany = allCompanies.find((c) => c.id === myCompanyId) ?? null;
  // 自社以外の配下会社（支店 level 6 は除外）
  const subCompanies = allCompanies
    .filter((c) => c.id !== myCompanyId && c.level !== 6 && c.status === "active")
    .sort((a, b) => a.company_code.localeCompare(b.company_code));

  const [selectedSubId, setSelectedSubId] = useState("");
  const selectedSub = subCompanies.find((c) => c.id === Number(selectedSubId)) ?? null;

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-[10px] text-gray-500">
        ライセンスは申請時点から課金が始まります。当月末まで有効で自動更新されます。
      </p>

      {/* 自社申請カード */}
      {myCompany && (
        <ApplyCard
          company={myCompany}
          allCompanies={allCompanies}
          onApplied={onApplied}
          variant="own"
        />
      )}

      {/* 配下会社への代行申請 */}
      {subCompanies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mt-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] text-gray-400 whitespace-nowrap">配下会社への代行申請</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* 注意喚起バナー */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-orange-500 mt-0.5 shrink-0">⚠</span>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-orange-800">通常運用外の操作です</p>
                <p className="text-[10px] text-orange-700">
                  ライセンスは本来、各会社が自社で申請するものです。
                  ここでの申請は、緊急時やむを得ない場合の代行操作としてご利用ください。
                </p>
              </div>
            </div>
          </div>

          {/* 会社選択 */}
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-1">申請対象の会社</label>
            <select
              value={selectedSubId}
              onChange={(e) => { setSelectedSubId(e.target.value); }}
              className="w-full border rounded px-3 py-2 text-xs"
            >
              <option value="">会社を選択してください</option>
              {subCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  [{LEVEL_LABELS[c.level]}] {c.company_name}
                </option>
              ))}
            </select>
          </div>

          {/* 選択された会社の申請フォーム */}
          {selectedSub && (
            <ApplyCard
              key={selectedSub.id}
              company={selectedSub}
              allCompanies={allCompanies}
              onApplied={() => {
                setSelectedSubId("");
                onApplied();
              }}
              variant="sub"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ApplyCard({
  company,
  allCompanies,
  onApplied,
  variant,
}: {
  company: Company;
  allCompanies: Company[];
  onApplied: () => void;
  variant: "own" | "sub";
}) {
  const branches = allCompanies.filter(
    (c) => c.level === 6 && c.parent_company_id === company.id
  );
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await licensesApi.apply({
        company_id: company.id,
        branch_id: selectedBranchId ? Number(selectedBranchId) : undefined,
      });
      setSuccess(`ライセンス ${res.license_id} を発行しました`);
      setSelectedBranchId("");
      onApplied();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "申請失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* ヘッダー */}
      <div className={`px-4 py-3 ${variant === "own" ? "bg-blue-50" : "bg-gray-50"}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">
            {LEVEL_LABELS[company.level]}
          </span>
          {variant === "own" && (
            <span className="text-[10px] bg-brand text-white px-1.5 py-0.5 rounded">自社</span>
          )}
          <span className="text-xs font-medium">{company.company_name}</span>
        </div>
        <p className="text-[10px] text-gray-700 mt-0.5">{company.company_code}</p>
      </div>

      {/* フォーム */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          {company.level === 5 && (
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-1">支店（任意）</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-xs"
                disabled={branches.length === 0}
              >
                <option value="">支店なし（整備会社直属）</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-red-500 text-[10px]">{error}</p>}
          {success && (
            <p className="text-green-700 text-[10px] bg-green-50 border border-green-200 rounded px-3 py-2 font-mono">
              {success}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-brand text-white text-xs px-5 py-2 rounded hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? "申請中..." : "ライセンス申請"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
