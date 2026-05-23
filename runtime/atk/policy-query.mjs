export const POLICY_QUERY = `{
  "outcome": data.arhiax.nauta.base.outcome
}`;

export const POLICY_DIRS = [
  "policy-bundle-nauta-colombia/base",
  "policy-bundle-nauta-colombia/res-1888-2025",
  "policy-bundle-nauta-colombia/habeas-data",
  "policy-bundle-nauta-colombia/decreto-4725-2005",
  "policy-bundle-nauta-colombia/clinical-graus-2016",
];

export function extractOpaValue(opaEvalJson) {
  return opaEvalJson?.result?.[0]?.expressions?.[0]?.value ?? {};
}
