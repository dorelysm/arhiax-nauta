# ============================================================================
# ARHIAX Nauta · Base Autonomy Policy · v0.2 (Colombia)
# ============================================================================
# Package:    arhiax.nauta.base.autonomy
# Bundle:     policy-bundle-nauta-colombia v0.2.0
# Source:     ARHIAX Agent Trust Kernel (ATK) + TR-2026-032 (TRIZ Extraction)
# Scope:      Define los niveles de autonomía (A0-A4) del agente longitudinal
#             Nauta y los precondicionales para cada nivel.
# Doctrine:   Nauta media; Nauta no decide clínicamente.
# Disclaimer: Este archivo NO sustituye obligaciones legales del PSS. Es un
#             control técnico que asiste al cumplimiento.
# ============================================================================

package arhiax.nauta.base.autonomy

import future.keywords.if
import future.keywords.in

default allow := false
default escalate := false
default suspend := false

# ----------------------------------------------------------------------------
# NIVELES DE AUTONOMÍA NAUTA (derivados del ATK ARHIAX)
# ----------------------------------------------------------------------------
# A0 · Observación pasiva       — lectura sin escritura ni notificación
# A1 · Captura estructurada     — agente populates Questionnaire FHIR R4
# A2 · Composición Bundle       — producción de CompositionPatientStatementRDA
# A3 · Notificación divergencia — emisión de CDS Hook a clinical-navigator
# A4 · Trazado transversal      — persistencia de grafo longitudinal atestado
# ----------------------------------------------------------------------------

valid_autonomy_levels := {"A0", "A1", "A2", "A3", "A4"}

# Nivel de operación por defecto en producción de Nauta
default_autonomy_level := "A3"

# ----------------------------------------------------------------------------
# Regla AUT-01 · Acción permitida si nivel válido + ledger registrado
# ----------------------------------------------------------------------------
allow if {
    input.autonomy_level in valid_autonomy_levels
    input.autonomy_level != "A4"
    ledger_recorded(input.action_id)
}

# A4 requiere opt-in explícito de la IPS porque persiste grafo longitudinal
# FMEA: si IPS opt-in se otorga sin auditoría, se pierde control de retención.
# Mitigación: opt-in A4 se firma por director médico Y oficial de protección
# de datos, no por sysadmin (validado en pipeline de deploy).
allow if {
    input.autonomy_level == "A4"
    input.institution.a4_enabled == true
    input.institution.a4_signed_by_dpo == true
    ledger_recorded(input.action_id)
}

# ----------------------------------------------------------------------------
# Regla AUT-02 · Cardinal · Nauta NUNCA notifica a treating-physician directo
# Origen: TR-2026-032 · CT-02 · Política P-01 + doctrina mediación
# FMEA: Si esta regla se viola, Nauta se convierte estructuralmente en SaMD
# y queda fuera del régimen sanitario sin habilitación INVIMA → riesgo
# regulatorio severo.
# ----------------------------------------------------------------------------
deny[msg] if {
    input.target_role == "treating-physician"
    msg := "DENY · TR-032/P-01: Nauta NO puede dirigirse directamente a treating-physician. Routing obligatorio vía clinical-navigator. (Régimen sanitario Decreto 4725/2005)"
}

# ----------------------------------------------------------------------------
# Regla AUT-03 · Precondicional universal de atestación
# Origen: TR-2026-032 · CT-07 · Política P-05 + Bifurcación epistémica
# FMEA: Si una acción se ejecuta sin pre-registro, la bifurcación
# constructor-auditor se rompe. Esta es la propiedad estructural del sistema.
# ----------------------------------------------------------------------------
deny[msg] if {
    not ledger_recorded(input.action_id)
    msg := sprintf("DENY · TR-032/P-05: Acción %s no pre-registrada en ledger HMAC. La atestación debe preceder a la acción. (Bifurcación epistémica)", [input.action_id])
}

# ----------------------------------------------------------------------------
# Regla AUT-04 · Suspensión por divergencia crítica con overlay no calibrado
# FMEA: Detectar divergencia crítica sin overlay calibrado puede generar
# falsos positivos que erosionen confianza institucional → alert fatigue.
# ----------------------------------------------------------------------------
suspend[msg] if {
    input.institution.overlay_status == "uncalibrated"
    input.divergence_severity == "critical"
    msg := "SUSPEND · Divergencia crítica con overlay no calibrado. Revisión humana obligatoria antes de continuar emisión de notificaciones."
}

# ----------------------------------------------------------------------------
# Regla AUT-05 · Suspensión por superación de cuota de errores en ventana
# Si un overlay genera >N falsos positivos consecutivos (rechazados por
# clinical-navigator), el agente se suspende para esa IPS específica.
# Esto implementa el feedback loop de calibración local (TR-032/CT-03).
# ----------------------------------------------------------------------------
suspend[msg] if {
    rejected_count := data.runtime.feedback[input.institution.id].rejected_30d
    rejected_count > data.thresholds.institutional[input.institution.id].max_consecutive_rejections
    msg := sprintf("SUSPEND · IPS %s superó cuota de rechazos (%d > umbral). Suspender notificaciones hasta recalibración.", [input.institution.id, rejected_count])
}

# ----------------------------------------------------------------------------
# Helper: verificar presencia de registro HMAC en el ledger
# El ledger es responsabilidad del runtime ARHIAX, no del bundle.
# Contract documentado en docs/runtime-contract.md
# ----------------------------------------------------------------------------
ledger_recorded(action_id) if {
    rec := data.runtime.ledger.records[action_id]
    rec.verified == true
    rec.hmac_signature_valid == true
    rec.timestamp != ""
}
