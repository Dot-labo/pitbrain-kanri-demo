"use client";

import { useEffect, useState } from "react";
import { companies as companiesApi, licenses as licensesApi, auth } from "@/lib/api";
import type { Company, License } from "@/types";

const BILLING_STATUSES = ["in_use", "suspended", "cancellation_scheduled"];

const LEVEL_LABELS: Record<number, string> = {
  1: "オーナー",
  2: "一次代理店",
  3: "二次代理店",
  4: "三次代理店",
  5: "整備会社",
  6: "支店",
};

const STATUS_LABELS: Record<string, string> = {
  active: "有効",
  suspended: "停止",
  cancellation_scheduled: "解約予定",
  cancelled: "解約済",
};

const ALL_LEVELS = [2, 3, 4, 5, 6];

function Modal({ onClose, onCreated, parentList, myLevel }: {
  onClose: () => void;
  onCreated: () => void;
  parentList: Company[];
  myLevel: number;
}) {
  const [parentId, setParentId] = useState("");
  const initLevel = Math.min(myLevel + 1, 6);
  const [level, setLevel] = useState(initLevel);
  const [form, setForm] = useState({
    company_name: "",
    company_name_kana: "",
    contact_person: "",
    phone: "",
    email: "",
    postal_code: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedParent = parentList.find((c) => c.id === Number(parentId));

  // 親企業を選んだとき: 階層の最小値は max(myLevel+1, parent.level+1)
  const minLevel = selectedParent
    ? Math.max(myLevel + 1, selectedParent.level + 1)
    : myLevel + 1;
  const availableLevels = ALL_LEVELS.filter((l) => l >= minLevel);

  // 階層を選んだとき: 親企業の候補は level < 選択階層 かつ myLevel以上
  const availableParents = parentList.filter((c) => c.level < level);

  function handleParentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setParentId(id);
    const parent = parentList.find((c) => c.id === Number(id));
    if (parent) {
      const newMin = Math.max(myLevel + 1, parent.level + 1);
      if (level < newMin) setLevel(newMin);
    }
  }

  function handleLevelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLevel = Number(e.target.value);
    setLevel(newLevel);
    // 親企業が新しい階層より上でなければリセット
    if (selectedParent && selectedParent.level >= newLevel) {
      setParentId("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.email) {
      setError("メールアドレスを入力してください");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("メールアドレスを正しく入力してください");
      return;
    }
    setSaving(true);
    try {
      await companiesApi.create({
        ...form,
        email: form.email || null,
        level,
        parent_company_id: parentId ? Number(parentId) : null,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登録失敗");
    } finally {
      setSaving(false);
    }
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  if (availableLevels.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
          <h2 className="text-lg font-bold mb-2">新規企業登録</h2>
          <p className="text-sm text-gray-500">この階層ではそれ以下の企業を登録できません。</p>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50">閉じる</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6">
        <h2 className="text-lg font-bold mb-4">新規企業登録</h2>
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* 親企業 → 先に選ぶ */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">親企業 *</label>
            <select value={parentId} onChange={handleParentChange}
              className="w-full border rounded px-2 py-1.5 text-sm" required>
              <option value="">選択してください</option>
              {[...availableParents]
                .sort((a, b) => a.company_code.localeCompare(b.company_code))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    [{LEVEL_LABELS[c.level]}]　{c.company_code}　{c.company_name}
                  </option>
                ))}
            </select>
          </div>

          {/* 階層: 親企業の選択に応じてフィルタ */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">階層 *</label>
            <select value={level} onChange={handleLevelChange}
              className="w-full border rounded px-2 py-1.5 text-sm">
              {availableLevels.map((l) => (
                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
              ))}
            </select>
            {selectedParent && (
              <p className="text-xs text-gray-400 mt-1">
                「{selectedParent.company_name}」({LEVEL_LABELS[selectedParent.level]}) の配下に登録されます
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">企業名 <span className="text-red-500">※</span></label>
            <input value={form.company_name} onChange={f("company_name")} required
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">企業名カナ</label>
            <input value={form.company_name_kana} onChange={f("company_name_kana")}
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
              <input value={form.contact_person} onChange={f("contact_person")}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">電話番号</label>
              <input value={form.phone} onChange={f("phone")}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">メールアドレス <span className="text-red-500">※</span></label>
            <input type="text" value={form.email} onChange={f("email")}
              placeholder="example@domain.com"
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">郵便番号</label>
              <input value={form.postal_code} onChange={f("postal_code")}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">住所</label>
              <input value={form.address} onChange={f("address")}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
              キャンセル
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-brand text-white rounded hover:bg-brand-dark disabled:opacity-50">
              {saving ? "登録中..." : "登録"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- 編集モーダル ----
function EditModal({ company, allCompanies, myCompanyId, onClose, onSaved, onDeleted }: {
  company: Company;
  allCompanies: Company[];
  myCompanyId: number | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const parentCompany = allCompanies.find((c) => c.id === company.parent_company_id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    company_name:      company.company_name,
    company_name_kana: company.company_name_kana ?? "",
    contact_person:    company.contact_person ?? "",
    phone:             company.phone ?? "",
    email:             company.email ?? "",
    postal_code:       company.postal_code ?? "",
    address:           company.address ?? "",
    notes:             company.notes ?? "",
    license_limit:     company.license_limit?.toString() ?? "",
    status:            company.status,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.email) {
      setError("メールアドレスを入力してください");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("メールアドレスを正しく入力してください");
      return;
    }
    setSaving(true);
    try {
      await companiesApi.update(company.id, {
        ...form,
        email: form.email || null,
        license_limit: form.license_limit ? Number(form.license_limit) : null,
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await companiesApi.delete(company.id);
      onDeleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "抹消失敗");
      setConfirmDelete(false);
      setDeleting(false);
    }
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-lg font-bold">企業情報編集</h2>
          <p className="text-xs text-gray-700 font-mono mt-1">{company.company_code}　{LEVEL_LABELS[company.level]}</p>
          {parentCompany && (
            <p className="text-xs text-gray-500 mt-0.5">
              親企業：{parentCompany.company_code}　{parentCompany.company_name}
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">企業名 <span className="text-red-500">※</span></label>
            <input value={form.company_name} onChange={f("company_name")} required
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">企業名カナ</label>
            <input value={form.company_name_kana} onChange={f("company_name_kana")}
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
              <input value={form.contact_person} onChange={f("contact_person")}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">電話番号</label>
              <input value={form.phone} onChange={f("phone")}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">メールアドレス <span className="text-red-500">※</span></label>
            <input type="text" value={form.email} onChange={f("email")}
              placeholder="example@domain.com"
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">郵便番号</label>
              <input value={form.postal_code} onChange={f("postal_code")}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">住所</label>
              <input value={form.address} onChange={f("address")}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          {/* 支店のみ: ライセンス上限 */}
          {company.level === 6 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ライセンス上限（支店）</label>
              <input type="number" min="0" value={form.license_limit} onChange={f("license_limit")}
                placeholder="未設定 = 上限なし"
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
            <select value={form.status} onChange={f("status")}
              className="w-full border rounded px-2 py-1.5 text-sm">
              {Object.entries({ active: "有効", suspended: "停止", cancellation_scheduled: "解約予定", cancelled: "解約済" }).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
            <textarea value={form.notes} onChange={f("notes")} rows={2}
              className="w-full border rounded px-2 py-1.5 text-sm resize-none" />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex justify-between gap-2 pt-2">
            {company.id !== myCompanyId && (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving}
                className="px-4 py-2 text-sm border border-red-300 text-red-500 rounded hover:bg-red-50 disabled:opacity-50">
                抹消
              </button>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                キャンセル
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 text-sm bg-brand text-white rounded hover:bg-brand-dark disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-base">企業の抹消</h3>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{company.company_name}</span> を本当に抹消しますか？<br />
              この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">
                キャンセル
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                {deleting ? "処理中..." : "抹消する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const LEVEL_BG: Record<number, string> = {
  1: "bg-white",
  2: "bg-blue-50",
  3: "bg-indigo-50",
  4: "bg-purple-50",
  5: "bg-gray-50",
  6: "bg-white",
};
const LEVEL_BADGE: Record<number, string> = {
  2: "bg-blue-100 text-blue-700",
  3: "bg-indigo-100 text-indigo-700",
  4: "bg-purple-100 text-purple-700",
  5: "bg-orange-100 text-orange-700",
  6: "bg-gray-100 text-gray-600",
};

// ---- メインページ ----
export default function CompaniesPage() {
  const [list, setList] = useState<Company[]>([]);
  const [allLicenses, setAllLicenses] = useState<License[]>([]);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [myLevel, setMyLevel] = useState<number>(1);
  const [myCompanyId, setMyCompanyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // company_id → 有効ライセンス数（直接）
  const licenseCountByCompany = new Map<number, number>();
  for (const l of allLicenses) {
    if (BILLING_STATUSES.includes(l.status)) {
      licenseCountByCompany.set(l.company_id, (licenseCountByCompany.get(l.company_id) ?? 0) + 1);
    }
  }

  function load() {
    companiesApi.list()
      .then((data) => {
        setList(data);
        // ルート企業だけ初期展開（直下の子まで表示）
        const inList = new Set(data.map((c) => c.id));
        const roots = data.filter((c) => !c.parent_company_id || !inList.has(c.parent_company_id));
        setExpandedIds(new Set(roots.map((c) => c.id)));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "取得失敗"));
  }

  useEffect(() => {
    load();
    auth.me().then((me) => { setMyLevel(me.level); setMyCompanyId(me.company_id); }).catch(() => {});
    licensesApi.list().then(setAllLicenses).catch(() => {});
  }, []);

  function toggleExpand(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // 子→親マップ
  const inList = new Set(list.map((c) => c.id));
  const childrenMap = new Map<number, Company[]>();
  for (const c of list) {
    const pid = c.parent_company_id;
    if (pid && inList.has(pid)) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(c);
    }
  }
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.company_code.localeCompare(b.company_code));
  }

  // 配下企業の総数（再帰）
  const descendantCount = (id: number): number => {
    const children = childrenMap.get(id) ?? [];
    return children.reduce((sum, c) => sum + 1 + descendantCount(c.id), 0);
  };

  // フィルタ適用後のリスト
  const filtered = list.filter((c) => {
    if (filterLevel && c.level !== Number(filterLevel)) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.company_name.toLowerCase().includes(q) || c.company_code.toLowerCase().includes(q);
    }
    return true;
  });

  const isFiltering = !!(search || filterLevel || filterStatus);

  // フィルタ時: フラット一覧、非フィルタ時: ツリー
  type Row = { company: Company; depth: number; isContext?: boolean };
  let rows: Row[];
  if (isFiltering) {
    const matchSet = new Set(filtered.map((c) => c.id));
    const idMap = new Map(list.map((c) => [c.id, c]));
    const ancestorIds = new Set<number>();
    for (const c of filtered) {
      let cur: Company = c;
      while (cur.parent_company_id) {
        const parent = idMap.get(cur.parent_company_id);
        if (!parent) break;
        ancestorIds.add(parent.id);
        cur = parent;
      }
    }
    rows = list
      .filter((c) => matchSet.has(c.id) || ancestorIds.has(c.id))
      .sort((a, b) => a.company_code.localeCompare(b.company_code))
      .map((c) => ({
        company: c,
        depth: c.company_code.split("-").length - 1,
        isContext: !matchSet.has(c.id),
      }));
  } else {
    const roots = list
      .filter((c) => !c.parent_company_id || !inList.has(c.parent_company_id))
      .sort((a, b) => a.company_code.localeCompare(b.company_code));
    rows = [];
    const visit = (c: Company, depth: number) => {
      rows.push({ company: c, depth });
      if (expandedIds.has(c.id)) {
        for (const child of childrenMap.get(c.id) ?? []) visit(child, depth + 1);
      }
    };
    for (const root of roots) visit(root, 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">企業管理</h1>
        <button onClick={() => setShowCreateModal(true)}
          className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-dark">
          新規登録
        </button>
      </div>
      {/* 絞込み */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="企業名・企業コードで絞り込み..."
          className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="">階層：全部</option>
          {[2, 3, 4, 5, 6].map((l) => (
            <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="">ステータス：全部</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {(search || filterLevel || filterStatus) && (
          <button
            onClick={() => { setSearch(""); setFilterLevel(""); setFilterStatus(""); }}
            className="border rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            リセット
          </button>
        )}
        {!isFiltering && (() => {
          const allExpandable = list.filter(c => (childrenMap.get(c.id)?.length ?? 0) > 0);
          const isAllExpanded = allExpandable.length > 0 && allExpandable.every(c => expandedIds.has(c.id));
          return (
            <button
              onClick={() => {
                if (isAllExpanded) {
                  const inListNow = new Set(list.map(c => c.id));
                  const roots = list.filter(c => !c.parent_company_id || !inListNow.has(c.parent_company_id));
                  setExpandedIds(new Set(roots.map(c => c.id)));
                } else {
                  setExpandedIds(new Set(allExpandable.map(c => c.id)));
                }
              }}
              className="border rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 ml-auto"
            >
              {isAllExpanded ? "すべて閉じる" : "すべて展開"}
            </button>
          );
        })()}
      </div>
      {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded">{error}</p>}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3">企業コード</th>
              <th className="px-4 py-3">企業名</th>
              <th className="px-4 py-3">階層</th>
              <th className="px-4 py-3 text-center">配下</th>
              <th className="px-4 py-3">ステータス</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && !error && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                {isFiltering ? "該当する企業がありません" : "データがありません"}
              </td></tr>
            )}
            {rows.map(({ company: c, depth, isContext }) => {
              const hasChildren = (childrenMap.get(c.id)?.length ?? 0) > 0;
              const isExpanded = expandedIds.has(c.id);
              const indent = depth * 20;
              return (
                <tr key={c.id}
                  className={`${isContext ? "opacity-40" : `hover:bg-blue-100 cursor-pointer ${LEVEL_BG[c.level] ?? ""}`}`}
                  onClick={() => !isContext && setEditTarget(c)}>
                  <td className="px-4 py-2.5 font-mono text-sm text-gray-700">{c.company_code}</td>
                  <td className="py-2.5 text-sm" style={{ paddingLeft: `${12 + indent}px` }}>
                    <span className="inline-flex items-center gap-1">
                      {hasChildren && !isFiltering ? (
                        <button
                          onClick={(e) => toggleExpand(c.id, e)}
                          className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 shrink-0"
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      {depth > 0 && <span className="text-gray-300">└</span>}
                      {c.company_name}
                      {(licenseCountByCompany.get(c.id) ?? 0) > 0 && (
                        <span className="ml-1 text-xs font-mono font-normal bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                          {licenseCountByCompany.get(c.id)}件
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-sm font-medium ${LEVEL_BADGE[c.level] ?? "bg-gray-100 text-gray-600"}`}>
                      {LEVEL_LABELS[c.level] ?? c.level}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {(() => {
                      const cnt = descendantCount(c.id);
                      return cnt > 0 ? (
                        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{cnt}</span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-sm ${
                        c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <Modal
          onClose={() => setShowCreateModal(false)}
          onCreated={load}
          parentList={list}
          myLevel={myLevel}
        />
      )}
      {editTarget && (
        <EditModal
          company={editTarget}
          allCompanies={list}
          myCompanyId={myCompanyId}
          onClose={() => setEditTarget(null)}
          onSaved={() => { load(); setEditTarget(null); }}
          onDeleted={() => { load(); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
