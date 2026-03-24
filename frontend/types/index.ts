export type CompanyStatus = "active" | "suspended" | "cancellation_scheduled" | "cancelled";
export type WorkerStatus = "pending" | "active" | "suspended" | "cancelled";
export type LicenseStatus = "active" | "suspended" | "cancellation_scheduled" | "cancelled";
export type NewLicenseStatus = "unassigned" | "in_use" | "suspended" | "cancellation_scheduled" | "cancelled";
export type PaymentStatus = "uninvoiced" | "invoiced" | "payment_confirmed" | "unpaid";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface Company {
  id: number;
  company_code: string;
  company_name: string;
  company_name_kana: string | null;
  level: number;
  parent_company_id: number | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  postal_code: string | null;
  address: string | null;
  notes: string | null;
  license_limit: number | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: number;
  company_id: number;
  branch_id: number | null;
  name: string;
  line_user_id: string | null;
  status: WorkerStatus;
  created_at: string;
}

export interface WorkerLicense {
  license_id: number;
  license_code: string | null;
  worker_id: number;
  worker_name: string;
  company_id: number;
  company_name: string;
  branch_id: number | null;
  branch_name: string | null;
  start_date: string;
  end_date: string | null;
  status: LicenseStatus;
}

export interface LicenseRequest {
  id: number;
  worker_id: number;
  worker_name: string;
  company_id: number;
  branch_id: number | null;
  requested_at: string;
  status: RequestStatus;
}

export interface BillingRecord {
  id: number;
  company_id: number;
  company_name: string;
  target_month: string;
  license_count: number;
  invoice_date: string | null;
  payment_date: string | null;
  payment_status: PaymentStatus;
  notes: string | null;
  updated_at: string;
}

export interface LicenseSummary {
  company_id: number;
  active_count: number;
  branch_counts: {
    branch_id: number;
    branch_code: string;
    name: string;
    active: number;
    limit: number | null;
  }[];
}

export interface License {
  id: number;
  license_id: string;
  company_id: number;
  company_name: string;
  company_code: string;
  branch_id: number | null;
  branch_name: string | null;
  worker_id: number | null;
  worker_name: string | null;
  applied_by_company_id: number | null;
  applied_by_company_name: string | null;
  status: NewLicenseStatus;
  applied_at: string;
  valid_from: string;
  valid_until: string;
  cancellation_requested_at: string | null;
  end_date: string | null;
}
