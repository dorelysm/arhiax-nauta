# ============================================================================
# ARHIAX Nauta · Human-in-Command Checkpoints · v0.2 (Colombia)
# ============================================================================
# Package:    arhiax.nauta.base.hic
# Source:     ARHIAX HIC framework + TR-2026-032 Decisión 2
# Doctrine:   Toda acción crítica del agente requiere checkpoint humano.
#             Esto materializa "Nauta media, no decide" a nivel operativo.
# ============================================================================

package arhiax.nauta.base.hic

import future.keywords.if
import future.keywords.in

# ----------------------------------------------------------------------------
# HIC-1 · Enrollment del paciente bajo navegación Nauta
# Requiere autorización institucional + consentimiento explícito del paciente
# (Ley 1581/2012 Art. 9 · autorización previa)
# FMEA: Enrolar paciente sin consentimiento es violación Habeas Data directa.
# ----------------------------------------------------------------------------
escalate[msg] if {
	input.action_category == "enroll_patient"
	input.consent.granted != true
	msg := "ESCALATE · HIC-1: Enrollment requiere consentimiento explícito documentado del paciente. (Ley 1581/2012 Art. 9)"
}

escalate[msg] if {
	input.action_category == "enroll_patient"
	input.institution.authorization_status != "active"
	msg := "ESCALATE · HIC-1: Enrollment requiere autorización institucional activa (REPS habilitación)."
}

# ----------------------------------------------------------------------------
# HIC-2 · Deployment de overlay institucional
# Requiere firma del director médico Y oficial de protección de datos
# FMEA: Si solo firma sysadmin, overlay puede modificar umbrales clínicos sin
# supervisión clínica → riesgo de calibración inadecuada.
# ----------------------------------------------------------------------------
escalate[msg] if {
	input.action_category == "deploy_overlay"
	not input.approvals.medical_director
	msg := "ESCALATE · HIC-2: Despliegue de overlay requiere firma del director médico de la IPS."
}

escalate[msg] if {
	input.action_category == "deploy_overlay"
	not input.approvals.data_protection_officer
	msg := "ESCALATE · HIC-2: Despliegue de overlay requiere firma del oficial de protección de datos. (Ley 1581/2012)"
}

# ----------------------------------------------------------------------------
# HIC-3 · Routing de notificación clínica
# Toda notificación con contenido clínico debe ir a clinical-navigator humano
# Origen: TR-032/CT-02 · Decreto 4725/2005
# FMEA: routing autónomo a treating-physician convierte Nauta en SaMD.
# ----------------------------------------------------------------------------
escalate[msg] if {
	input.action_category == "divergence_notification"
	input.divergence_severity in {"high", "critical"}
	input.target_role != "clinical-navigator"
	msg := sprintf("ESCALATE · HIC-3: Divergencia %s debe ruta a clinical-navigator, NUNCA autónoma a profesional médico.", [input.divergence_severity])
}

# ----------------------------------------------------------------------------
# HIC-4 · Modificación de política de consentimiento
# Solo el paciente puede modificar su propio consentimiento (soberanía)
# FMEA: si admin de IPS modifica consent, viola Habeas Data Art. 6 (titular)
# ----------------------------------------------------------------------------
escalate[msg] if {
	input.action_category == "modify_consent"
	input.actor_role != "patient"
	input.actor_role != "patient_authorized_representative"
	msg := "ESCALATE · HIC-4: Modificación de consentimiento solo por el titular o representante autorizado. (Ley 1581/2012 Art. 6)"
}

# ----------------------------------------------------------------------------
# HIC-5 · Transferencia inter-institucional de grafo longitudinal
# Requiere consentimiento del paciente + acknowledgment de IPS receptora +
# autorización específica del propósito de la transferencia
# FMEA: transferencia sin acknowledgment crea estado huérfano que viola
# trazabilidad bajo Ley 2015/2020.
# ----------------------------------------------------------------------------
escalate[msg] if {
	input.action_category == "transfer_graph"
	not input.receiving_institution.acknowledged
	msg := "ESCALATE · HIC-5: Transferencia inter-institucional requiere acknowledgment de IPS receptora. (Ley 2015/2020)"
}

escalate[msg] if {
	input.action_category == "transfer_graph"
	not input.transfer.patient_explicit_authorization
	msg := "ESCALATE · HIC-5: Transferencia requiere autorización explícita del paciente con propósito específico."
}
