"use client";

import { useEffect, useMemo, useState } from "react";
import { billing as billingApi, auth, type CurrentUser } from "@/lib/api";
import type { BillingRecord } from "@/types";

function cellBg(record: BillingRecord | null): string {
  if (!record)                return "bg-gray-50";
  if (record.payment_date)    return "bg-green-50";
  if (record.invoice_date)    return "bg-blue-50";
  return "bg-white";
}

const STATUS_LABEL: Record<string, string> = {
  uninvoiced:        "未請求",
  invoiced:          "請求済",
  payment_confirmed: "支払済",
  unpaid:            "未払い",
};

export default function PaymentsPage() {
  const [records, setRecords]   = useState<BillingRecord[]>([]);
  const [me, setMe]             = useState<CurrentUser | null>(null);
  const [year, setYear]         = useState(() => String(new Date().getFullYear()));
  const [detail, setDetail]     = useState<BillingRecord | null>(null);

  useEffect(() => {
    auth.me().then(setMe).catch(() => {});
    billingApi.my().then(setRecords).catch(() => {});
  }, []);

  const months = Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`
  );

  const yearOptions = Array.from({ length: 4 }, (_, i) =>
    String(new Date().getFullYear() - 1 + i)
  );

  const recordMap = useMemo(() => {
    const m = new Map<string, BillingRecord>();
    records.forEach((r) => m.set(r.target_month, r));
    return m;
  }, [records]);

  const yearTotal = months.reduce((s, m) => s + (recordMap.get(m)?.license_count ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">支払</h1>
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


      {/* ピボットテーブル */}
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
          <tbody>
            <tr className="border-b hover:brightness-95">
              <td className="px-4 py-3 sticky left-0 bg-white border-r font-medium whitespace-nowrap">
                {me?.company_name ?? "—"}
              </td>
              <td className="px-3 py-3 border-r font-mono text-[11px] text-gray-700 whitespace-nowrap">
                {me?.company_code ?? ""}
              </td>
              {months.map((m) => {
                const rec = recordMap.get(m) ?? null;
                return (
                  <td
                    key={m}
                    className={`px-3 py-3 text-center tabular-nums cursor-pointer ${cellBg(rec)}`}
                    onClick={() => rec && setDetail(rec)}
                  >
                    {rec ? (
                      <span className="font-medium">{rec.license_count}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-3 text-center font-bold border-l-2 border-gray-300 bg-gray-50 tabular-nums">
                {yearTotal}
              </td>
            </tr>
          </tbody>
          <tfoot className="border-t bg-gray-50">
            <tr>
              <td colSpan={2} className="px-4 py-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 border-r">
                合計
              </td>
              {months.map((m) => {
                const rec = recordMap.get(m) ?? null;
                return (
                  <td key={m} className="px-3 py-3 text-center font-semibold tabular-nums">
                    {rec ? rec.license_count : <span className="text-gray-300">—</span>}
                  </td>
                );
              })}
              <td className="px-3 py-3 text-center font-bold border-l-2 border-gray-300 bg-gray-100 tabular-nums">
                {yearTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 詳細モーダル */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">{detail.target_month.replace("-", "年")}月　支払詳細</h2>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">ライセンス数</dt>
                <dd className="font-semibold tabular-nums">{detail.license_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">ステータス</dt>
                <dd className="font-semibold">{STATUS_LABEL[detail.payment_status] ?? detail.payment_status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">請求日</dt>
                <dd className="tabular-nums">{detail.invoice_date ? new Date(detail.invoice_date).toLocaleDateString("ja-JP") : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">支払日</dt>
                <dd className="tabular-nums">{detail.payment_date ? new Date(detail.payment_date).toLocaleDateString("ja-JP") : "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
