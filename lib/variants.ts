import type { Fields } from "./model";
export type Variant = {
  name: string;
  description: string;
  traffic: number;
  exposed: number;
  conversions: number;
  result: string;
  success: string;
};
export const defaultVariants: Variant[] = [
  {
    name: "A · Control",
    description: "",
    traffic: 50,
    exposed: 0,
    conversions: 0,
    result: "",
    success: "",
  },
  {
    name: "B",
    description: "",
    traffic: 50,
    exposed: 0,
    conversions: 0,
    result: "",
    success: "",
  },
];
export function getVariants(f: Fields): Variant[] {
  try {
    return f.variants ? JSON.parse(String(f.variants)) : [];
  } catch {
    return [];
  }
}
export function variantError(f: Fields): string | null {
  const variants = getVariants(f);
  if (!variants.length)
    return ["En curso", "En análisis", "Finalizado"].includes(
      String(f.status),
    ) && ["A/B aleatorizado", "Test multivariante"].includes(String(f.method))
      ? "Define las variantes antes de lanzar."
      : null;
  let total = 0;
  for (const v of variants) {
    if (!v.name.trim()) return "Nombra todas las variantes.";
    if (v.traffic < 0 || v.traffic > 100)
      return "El tráfico de cada variante debe estar entre 0 y 100%.";
    if (
      v.exposed < 0 ||
      v.conversions < 0 ||
      v.conversions > v.exposed ||
      !Number.isInteger(v.exposed) ||
      !Number.isInteger(v.conversions)
    )
      return "Las muestras y conversiones deben ser enteros válidos.";
    total += v.traffic;
  }
  if (
    ["A/B aleatorizado", "Test multivariante"].includes(String(f.method)) &&
    Math.abs(total - 100) > 0.001
  )
    return "El reparto de tráfico debe sumar 100%.";
  if (
    ["En curso", "En análisis", "Finalizado"].includes(String(f.status)) &&
    f.method === "A/B aleatorizado" &&
    variants.length !== 2
  )
    return "Un A/B requiere dos variantes.";
  return null;
}
