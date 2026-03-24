"use client";

import { useEffect, useState } from "react";
import { workers as workersApi, companies as companiesApi, auth, type CurrentUser } from "@/lib/api";
import type { Worker, Company } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  active: "有効",
  cancelled: "無効",
};

export default function WorkersPage() {
  const [workerList, setWorkerList] = useState<Worker[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Worker | null>(null);

  async function load() {
    const ws = await workersApi.list().catch(() => []);
    setWorkerList(ws);
  }

  useEffect(() => {
    load();
    companiesApi.list().then(setAllCompanies).catch(() => {});
    auth.me().then(setMe).catch(() => {});
  }, []);

  async function handleDeactivate(workerId: number) {
    if (!confirm("この作業員を無効化しますか？")) return;
    setLoading(true);
    await workersApi.deactivate(workerId).catch(console.error);
    await load();
    setLoading(false);
  }

  const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">従業員管理</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-dark"
        >
          + 新規登録
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">氏名</th>
              <th className="px-4 py-3">所属会社</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3">登録日</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {workerList.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  従業員がいません
                </td>
              </tr>
            )}
            {workerList.map((w) => (
              <tr
                key={w.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setEditTarget(w)}
              >
                <td className="px-4 py-3 font-medium">{w.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {companyMap.get(w.company_id)?.company_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    w.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {STATUS_LABELS[w.status] ?? w.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(w.created_at).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {w.status === "active" && (
                    <button
                      onClick={() => handleDeactivate(w.id)}
                      disabled={loading}
                      className="text-sm border px-2 py-1 rounded text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      無効化
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <WorkerFormModal
          allCompanies={allCompanies}
          myCompanyId={me?.company_id ?? null}
          onSaved={() => { load(); setCreateOpen(false); }}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editTarget && (
        <WorkerFormModal
          worker={editTarget}
          allCompanies={allCompanies}
          myCompanyId={me?.company_id ?? null}
          onSaved={() => { load(); setEditTarget(null); }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

function WorkerFormModal({
  worker,
  allCompanies,
  myCompanyId,
  onSaved,
  onClose,
}: {
  worker?: Worker;
  allCompanies: Company[];
  myCompanyId: number | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const isEdit = !!worker;

  const subCompanies = allCompanies.filter(
    (c) => c.level !== 6 && c.status === "active"
  ).sort((a, b) => a.company_code.localeCompare(b.company_code));

  const [name, setName] = useState(worker?.name ?? "");
  const [companyId, setCompanyId] = useState(
    worker?.company_id ? String(worker.company_id) : (myCompanyId ? String(myCompanyId) : "")
  );
  const selectedCompany = allCompanies.find((c) => c.id === Number(companyId)) ?? null;
  const branches = allCompanies.filter(
    (c) => c.level === 6 && c.parent_company_id === Number(companyId)
  );
  const [branchId, setBranchId] = useState(worker?.branch_id ? String(worker.branch_id) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("氏名を入力してください"); return; }
    if (!companyId) { setError("所属会社を選択してください"); return; }
    setError("");
    setSaving(true);
    try {
      if (isEdit) {
        await workersApi.update(worker!.id, {
          name: name.trim(),
          branch_id: branchId ? Number(branchId) : null,
        });
      } else {
        await workersApi.create({
          name: name.trim(),
          company_id: Number(companyId),
          branch_id: branchId ? Number(branchId) : undefined,
        });
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">{isEdit ? "従業員編集" : "従業員新規登録"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">氏名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="山田 太郎"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">所属会社</label>
              <select
                value={companyId}
                onChange={(e) => { setCompanyId(e.target.value); setBranchId(""); }}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">会社を選択</option>
                {subCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {branches.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">支店（任意）</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">支店なし</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.company_name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-sm px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm px-5 py-2 bg-brand text-white rounded hover:bg-brand-dark disabled:opacity-50"
            >
              {saving ? "保存中..." : isEdit ? "更新" : "登録"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
