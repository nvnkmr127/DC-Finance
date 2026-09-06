import { getSupabase } from "@/lib/supabase/client";

export type Service = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ServiceInput = {
  name: string;
  price: number;
  description?: string | null;
};

// Fallback seed services if database table is not migrated yet
const DEFAULT_SERVICES: Service[] = [
  { id: "srv-1", name: "Cloud Hosting & Infrastructure", price: 15000, description: "Managed cloud servers & monitoring" },
  { id: "srv-2", name: "Web Application Development", price: 45000, description: "Custom full-stack web development" },
  { id: "srv-3", name: "SEO & Performance Optimization", price: 20000, description: "Monthly SEO audits and speed optimization" },
  { id: "srv-4", name: "DevOps & CI/CD Pipelines", price: 35000, description: "Automated deployment pipelines and Docker setup" },
  { id: "srv-5", name: "IT Support & Maintenance", price: 25000, description: "Ongoing technical support and bug fixes" },
  { id: "srv-6", name: "Mobile App Maintenance", price: 30000, description: "iOS and Android updates & maintenance" },
];

const LOCAL_STORAGE_KEY = "dc_services_cache";

function getLocalServices(): Service[] {
  if (typeof window === "undefined") return DEFAULT_SERVICES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_SERVICES));
    return DEFAULT_SERVICES;
  } catch {
    return DEFAULT_SERVICES;
  }
}

function saveLocalServices(services: Service[]) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(services));
    } catch {}
  }
}

export async function listServices(): Promise<Service[]> {
  try {
    const { data, error } = await getSupabase()
      .from("services")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      // Table does not exist yet (PGRST205 or 404)
      return getLocalServices();
    }
    return data && data.length > 0 ? data : getLocalServices();
  } catch {
    return getLocalServices();
  }
}

export async function searchServices(query: string): Promise<Service[]> {
  const trimmed = query.trim().toLowerCase();
  try {
    const { data, error } = await getSupabase()
      .from("services")
      .select("*")
      .ilike("name", `%${trimmed}%`)
      .order("name", { ascending: true })
      .limit(10);

    if (error || !data) {
      const local = getLocalServices();
      if (!trimmed) return local;
      return local.filter((s) => s.name.toLowerCase().includes(trimmed));
    }
    return data;
  } catch {
    const local = getLocalServices();
    if (!trimmed) return local;
    return local.filter((s) => s.name.toLowerCase().includes(trimmed));
  }
}

export async function createService(input: ServiceInput): Promise<Service> {
  const newService: Service = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `srv-${Date.now()}`,
    name: input.name.trim(),
    price: Number(input.price) || 0,
    description: input.description?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await getSupabase()
      .from("services")
      .insert({
        name: newService.name,
        price: newService.price,
        description: newService.description,
      })
      .select()
      .single();

    if (error) {
      const current = getLocalServices();
      const updated = [...current.filter(s => s.name.toLowerCase() !== newService.name.toLowerCase()), newService];
      saveLocalServices(updated);
      return newService;
    }
    return data;
  } catch {
    const current = getLocalServices();
    const updated = [...current.filter(s => s.name.toLowerCase() !== newService.name.toLowerCase()), newService];
    saveLocalServices(updated);
    return newService;
  }
}

export async function deleteService(id: string): Promise<void> {
  try {
    const { error } = await getSupabase().from("services").delete().eq("id", id);
    if (error) {
      const current = getLocalServices();
      saveLocalServices(current.filter((s) => s.id !== id));
    }
  } catch {
    const current = getLocalServices();
    saveLocalServices(current.filter((s) => s.id !== id));
  }
}
