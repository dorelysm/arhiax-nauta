export const POLICY_QUERY = `{
  "autonomy_allow": data.arhiax.nauta.base.autonomy.allow,
  "autonomy_deny": data.arhiax.nauta.base.autonomy.deny,
  "autonomy_suspend": data.arhiax.nauta.base.autonomy.suspend,
  "hic_escalate": data.arhiax.nauta.base.hic.escalate,
  "res_deny": data.arhiax.nauta.co.res_1888_2025.deny,
  "habeas_allow": data.arhiax.nauta.co.habeas_data.allow,
  "habeas_deny": data.arhiax.nauta.co.habeas_data.deny,
  "habeas_suspend": data.arhiax.nauta.co.habeas_data.suspend,
  "samd_allow": data.arhiax.nauta.co.decreto_4725_2005.allow,
  "samd_deny": data.arhiax.nauta.co.decreto_4725_2005.deny,
  "samd_escalate": data.arhiax.nauta.co.decreto_4725_2005.escalate,
  "samd_audit": data.arhiax.nauta.co.decreto_4725_2005.audit,
  "res_audit": data.arhiax.nauta.co.res_1888_2025.audit,
  "habeas_audit": data.arhiax.nauta.co.habeas_data.audit,
  "graus_audit": data.arhiax.nauta.clinical.graus_2016.audit
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
