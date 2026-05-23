# ============================================================================
# ARHIAX Nauta · Habeas Data · v0.2 (Colombia)
# ============================================================================
# Package:    arhiax.nauta.co.habeas_data
# Bundle:     policy-bundle-nauta-colombia v0.2.0
#
# Fuente normativa:
#   - Ley 1581 de 2012 (Régimen general protección de datos personales)
#   - Decreto 1377 de 2013 (Reglamentario · datos sensibles)
#   - Ley 2015 de 2020 (Custodia HCE interoperable)
#   - Resolución 1888 de 2025 Art. 4 (Protección de datos sensibles)
#
# Doctrina:   Soberanía del paciente mediada por consentimiento ejecutable.
#             TR-2026-032 · CT-06 + CF-02 · Política P-04
#
# Disclaimer: Este Rego NO sustituye el aviso de privacidad ni la
#             autorización escrita exigida por Ley 1581. Es control técnico
#             que asiste al cumplimiento.
# ============================================================================

package arhiax.nauta.co.habeas_data

import future.keywords.contains
import future.keywords.if
import future.keywords.in

default allow := false

# ----------------------------------------------------------------------------
# CATEGORÍAS SENSIBLES (Ley 1581/2012 Art. 5 · Decreto 1377 Art. 3)
#
# La Ley 1581 define datos sensibles como aquellos que afectan la
# intimidad del titular o cuyo uso indebido puede generar discriminación.
# Específicamente menciona: origen racial o étnico, orientación política,
# convicciones religiosas o filosóficas, pertenencia a sindicatos, datos de
# salud, datos de vida sexual, datos biométricos, datos de niños y
# adolescentes.
#
# Para Nauta, las subcategorías clínicas de datos de salud que recibimos
# tratamiento especial son las siguientes. Cada institución puede ampliar
# esta lista vía overlay (monotonicidad: solo agregar).
# ----------------------------------------------------------------------------

sensitive_clinical_categories := {
	"mental_health",
	"psychiatric_history",
	"reproductive_health",
	"sexual_health",
	"hiv_status",
	"std_status",
	"genetic_data",
	"substance_use_disorder",
	"gender_identity",
	"sexual_orientation",
	"intellectual_disability",
	"child_adolescent_data",
}

# ----------------------------------------------------------------------------
# Regla HD-01 · Acceso a dato sensible requiere consentimiento granular activo
#
# La autorización debe ser:
#   - Previa (signed_timestamp anterior al access)
#   - Específica (matching de requester_role, data_category, purpose)
#   - Informada (consent_type == "granular_explicit")
#   - No revocada
#
# FMEA · seronegatividad de acceso: si el sistema no encuentra match exacto
# en consent.policies, NIEGA por defecto. Esto es seguro pero puede generar
# falsos negativos operativos. La mitigación es que UI de paciente sugiera
# habilitar categorías comúnmente requeridas al onboarding.
# ----------------------------------------------------------------------------

allow if {
	matching_consent_exists
	not consent_revoked_at(input.access_timestamp)
	not purpose_explicitly_excluded
	actor_role_authorized
}

matching_consent_exists if {
	some policy in data.consent.policies[input.patient_id]
	policy.requester_role == input.requester.role
	policy.data_category == input.data_category
	policy.purpose == input.access_purpose
	policy.status == "active"
	policy.signed_timestamp != ""
	time.parse_rfc3339_ns(policy.signed_timestamp) < time.parse_rfc3339_ns(input.access_timestamp)
}

actor_role_authorized if {
	input.requester.role in data.runtime.authorized_roles
}

# ----------------------------------------------------------------------------
# Regla HD-02 · Datos sensibles requieren consent_type "granular_explicit"
#
# Para las categorías sensible_clinical_categories, NO se acepta
# autorización por bloque ("blanket"); debe ser explícita por categoría.
# Esto materializa Ley 1581 Art. 6 (autorización previa, expresa e
# informada).
# ----------------------------------------------------------------------------

deny[msg] if {
	input.data_category in sensitive_clinical_categories
	not has_granular_explicit_consent
	msg := sprintf("DENY · HD-02 · Ley 1581 Art. 6: Categoría sensible '%s' requiere autorización granular explícita. Bloque (blanket consent) NO aceptado.", [input.data_category])
}

has_granular_explicit_consent if {
	some policy in data.consent.policies[input.patient_id]
	policy.data_category == input.data_category
	policy.consent_type == "granular_explicit"
	policy.signed_timestamp != ""
	policy.status == "active"
}

# ----------------------------------------------------------------------------
# Regla HD-03 · Exclusiones explícitas del paciente
#
# Origen: TR-2026-032 · CF-02 (Separación por condición)
# Ejemplo doctrinal: "Mis datos de salud mental NO son visibles a la EPS
# de medicina laboral en evaluaciones de incapacidad".
#
# FMEA: si las exclusiones no se aplican antes de las políticas afirmativas,
# se pueden filtrar datos sensibles a contextos excluidos. Por eso esta
# regla se evalúa ANTES de allow.
# ----------------------------------------------------------------------------

purpose_explicitly_excluded if {
	some exclusion in data.consent.exclusions[input.patient_id]
	exclusion.data_category == input.data_category
	exclusion.excluded_requester_type == input.requester.institution_type
	exclusion.status == "active"
}

purpose_explicitly_excluded if {
	some exclusion in data.consent.exclusions[input.patient_id]
	exclusion.data_category == input.data_category
	exclusion.excluded_purpose == input.access_purpose
	exclusion.status == "active"
}

deny[msg] if {
	purpose_explicitly_excluded
	msg := sprintf("DENY · HD-03: Exclusión activa del paciente bloquea acceso. Categoría: %s · Receptor: %s · Propósito: %s", [input.data_category, input.requester.institution_type, input.access_purpose])
}

# ----------------------------------------------------------------------------
# Regla HD-04 · Revocación inmediata y global del consentimiento
#
# Ley 1581/2012 Art. 8 literal e: el titular puede revocar la autorización
# en cualquier momento. La revocación es inmediata.
#
# FMEA · race condition: si access_timestamp y revocation_timestamp están
# cerca (< 1 segundo, posible clock drift), se debe preferir el sentido
# protectivo (suspender). Esta regla implementa esa preferencia.
# ----------------------------------------------------------------------------

consent_revoked_at(access_ts) if {
	rev := data.consent.revocations[input.patient_id]
	rev.timestamp != ""

	# Si la revocación ocurrió antes o cerca del access (margen 1 segundo)
	# se considera revocado por protección
	revocation_ns := time.parse_rfc3339_ns(rev.timestamp)
	access_ns := time.parse_rfc3339_ns(access_ts)
	revocation_ns <= access_ns + 1000000000 # 1 segundo en nanosegundos
}

suspend[msg] if {
	input.action_category == "data_access"
	consent_revoked_at(input.access_timestamp)
	msg := sprintf("SUSPEND · HD-04 · Ley 1581 Art. 8(e): Consentimiento revocado por paciente %s en %s. Suspender hasta nueva autorización.", [input.patient_id, data.consent.revocations[input.patient_id].timestamp])
}

# ----------------------------------------------------------------------------
# Regla HD-05 · Transferencia inter-institucional bajo Ley 2015/2020
#
# La transferencia de información clínica entre IPS / EAPB requiere:
#   - Autorización específica del paciente para esta transferencia
#   - Institución receptora habilitada en REPS
#   - Propósito declarado y registrado
# ----------------------------------------------------------------------------

escalate[msg] if {
	input.action_category == "cross_institution_transfer"
	not input.transfer.patient_explicit_authorization
	msg := "ESCALATE · HD-05 · Ley 2015/2020: Transferencia entre instituciones requiere autorización específica del paciente con propósito declarado."
}

escalate[msg] if {
	input.action_category == "cross_institution_transfer"
	not input.transfer.receiving_institution_reps_active
	msg := "ESCALATE · HD-05: IPS receptora no habilitada en REPS. Validar antes de transferir."
}

# ----------------------------------------------------------------------------
# Regla HD-06 · Derechos ARCO del titular (Art. 8 Ley 1581)
#
# El paciente tiene derecho a:
#   - Conocer (qué datos hay, qué uso, quién accedió)
#   - Actualizar (corregir información inexacta)
#   - Rectificar (modificar contenido erróneo)
#   - Suprimir (solicitar eliminación)
#   - Oponerse (objetar tratamientos específicos)
#
# Nauta debe poder responder a cada uno de estos derechos. La regla aquí
# verifica que la solicitud tenga forma válida.
# ----------------------------------------------------------------------------

arco_request_valid if {
	input.action_category == "arco_request"
	input.arco.right in {"access", "update", "rectify", "delete", "object"}
	input.arco.requester_identity_verified == true
	input.arco.requester_is_titular_or_authorized == true
}

allow if {
	arco_request_valid
}

deny[msg] if {
	input.action_category == "arco_request"
	not arco_request_valid
	msg := "DENY · HD-06 · Ley 1581 Art. 8: Solicitud ARCO inválida. Verificar identidad del titular y tipo de derecho."
}

# ----------------------------------------------------------------------------
# Regla HD-07 · AUDIT obligatorio de todo acceso a dato sensible
#
# Para SuperIntendencia de Industria y Comercio (SIC) - autoridad de
# protección de datos en Colombia - todo acceso a dato sensible debe quedar
# en bitácora auditable.
# ----------------------------------------------------------------------------

audit[record] if {
	input.data_category in sensitive_clinical_categories
	allow
	record := {
		"action": "sensitive_data_access",
		"regulatory_basis": "Ley 1581/2012 Art. 5 · Decreto 1377/2013",
		"patient_id_hash": input.patient_id_hash,
		"data_category": input.data_category,
		"requester_role": input.requester.role,
		"requester_institution": input.requester.institution_id,
		"purpose": input.access_purpose,
		"consent_policy_id": input.consent_policy_id,
		"access_timestamp": input.access_timestamp,
		"ledger_action_id": input.action_id,
	}
}
