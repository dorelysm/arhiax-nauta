# ============================================================================
# ARHIAX Nauta · Decreto 4725/2005 · SaMD Guardrails · v0.2 (Colombia)
# ============================================================================
# Package:    arhiax.nauta.co.decreto_4725_2005
# Bundle:     policy-bundle-nauta-colombia v0.2.0
#
# Fuente normativa:
#   - Decreto 4725 de 2005 (Régimen sanitario · Dispositivos médicos)
#   - INVIMA · Clasificación SaMD (Software as a Medical Device)
#   - Decreto 1011/2006 (SOGC · Habilitación de servicios)
#
# Posicionamiento estructural:
#   Nauta opera FUERA del perímetro SaMD por diseño. Esto se logra
#   manteniendo a Nauta como:
#     - Capa de coordinación (no diagnóstica)
#     - Productor exclusivo de RDA Paciente (autor = paciente)
#     - Mediador hacia clinical-navigator (humano)
#     - Detector de patrón sin emisión de juicio clínico
#
# Cualquier acción que cruce este perímetro debe ser bloqueada por este
# bundle, no por convención organizativa.
# ============================================================================

package arhiax.nauta.co.decreto_4725_2005

import future.keywords.if
import future.keywords.in

# ----------------------------------------------------------------------------
# CATEGORÍAS DE OUTPUT PROHIBIDAS (configurarían SaMD)
#
# Producir cualquier output con estas etiquetas constituiría función
# diagnóstica o terapéutica → SaMD Clase IIa o superior → exige habilitación
# INVIMA previa.
# ----------------------------------------------------------------------------

forbidden_output_labels := {
	"diagnosis",
	"differential_diagnosis",
	"clinical_recommendation",
	"treatment_recommendation",
	"prescription",
	"prescription_suggestion",
	"therapeutic_suggestion",
	"medical_decision",
	"patient_specific_treatment_plan",
	"drug_dosage_calculation",
	"clinical_risk_score", # los CRS son SaMD bajo el Decreto 4725
}

# ----------------------------------------------------------------------------
# CATEGORÍAS DE OUTPUT PERMITIDAS (mantienen Nauta fuera de SaMD)
# ----------------------------------------------------------------------------

permitted_output_labels := {
	"narrative_organization",
	"chronological_summary",
	"longitudinal_trajectory_visualization",
	"criteria_pattern_match", # referenciado a criterio publicado, sin interpretación
	"divergence_detection", # respecto a umbrales institucionales
	"structured_questionnaire_response",
	"patient_self_reported_observation", # paciente como autor
	"consent_evaluation",
	"atestation_record",
	"coordination_alert", # alerta al clinical-navigator, no juicio
}

# ----------------------------------------------------------------------------
# Regla SAMD-01 · Output con label prohibida → DENY
#
# FMEA: si un developer agrega una feature con label prohibida en
# producción, Nauta se convierte estructuralmente en SaMD sin habilitación.
# Esta regla es la última línea de defensa antes del despliegue.
# ----------------------------------------------------------------------------

default allow := false

deny[msg] if {
	input.output.label in forbidden_output_labels
	msg := sprintf("DENY · SAMD-01 · Decreto 4725/2005: Label '%s' constituye SaMD. Nauta opera como capa de coordinación. Etiquetas permitidas: ver permitted_output_labels.", [input.output.label])
}

allow if {
	input.output.label in permitted_output_labels
	count(deny) == 0
}

# ----------------------------------------------------------------------------
# Regla SAMD-02 · Contenido clínico SOLO a clinical-navigator
#
# Ningún output con contains_clinical_content puede dirigirse directamente
# a treating-physician. Toda ruta debe transitar clinical-navigator humano.
# ----------------------------------------------------------------------------

deny[msg] if {
	input.output.contains_clinical_content == true
	input.output.target_role == "treating-physician"
	not input.output.routed_via_navigator
	msg := "DENY · SAMD-02 · TR-032/P-01: Contenido clínico no puede dirigirse directamente al treating-physician. Routing obligatorio vía clinical-navigator (preserva checkpoint humano)."
}

# ----------------------------------------------------------------------------
# Regla SAMD-03 · Detección de patrón debe citar criterio publicado
#
# Para mantenerse fuera de SaMD, toda "detección de patrón" debe explicitar
# el criterio publicado contra el que se compara. Esto es la diferencia
# entre "Nauta dice X" (SaMD) y "el cuadro coincide con criterios Y de
# la literatura, evalúe usted" (no-SaMD).
#
# FMEA: si la cita del criterio falta, la afirmación se vuelve original de
# Nauta → juicio clínico → SaMD.
# ----------------------------------------------------------------------------

escalate[msg] if {
	input.output.label == "criteria_pattern_match"
	not input.output.referenced_criteria
	msg := "ESCALATE · SAMD-03: Detección de patrón requiere cita del criterio publicado (e.g., Graus 2016 Lancet Neurol). Sin cita, la afirmación constituye juicio clínico original."
}

escalate[msg] if {
	input.output.label == "criteria_pattern_match"
	input.output.referenced_criteria
	not input.output.referenced_criteria.publication_doi
	msg := "ESCALATE · SAMD-03: Criterio referenciado debe incluir DOI o cita verificable."
}

# ----------------------------------------------------------------------------
# Regla SAMD-04 · Disclaimer obligatorio en outputs hacia paciente
#
# Outputs con audience="patient" deben incluir disclaimer explícito de
# no-asesoramiento-médico. Esto es coherente con el régimen INVIMA y con
# la doctrina ARHIAX de mediación.
# ----------------------------------------------------------------------------

deny[msg] if {
	input.output.audience == "patient"
	not input.output.contains_medical_disclaimer
	msg := "DENY · SAMD-04: Output dirigido al paciente debe incluir disclaimer de no-asesoramiento-médico. (Régimen sanitario)"
}

required_disclaimer_text := "Esta información organiza su trayectoria de salud según lo que usted ha reportado. NO constituye diagnóstico ni recomendación médica. Consulte siempre a su médico tratante."

# ----------------------------------------------------------------------------
# Regla SAMD-05 · Composition.author no puede ser Nauta
#
# Esta regla complementa R1888-01: el autor formal de cualquier Composition
# producida por Nauta debe ser Patient (en RDA Paciente) o un Practitioner
# humano (en cualquier otro contexto, donde Nauta no debería estar
# operando).
#
# FMEA: si Nauta se declara como Composition.author, asume rol clínico →
# SaMD inmediato.
# ----------------------------------------------------------------------------

deny[msg] if {
	input.action_category == "produce_composition"
	some author in input.composition.author
	author.identifier.value == "urn:sinergia:arhiax:nauta"
	msg := "DENY · SAMD-05: Nauta NO puede figurar como Composition.author. Para RDA Paciente, author = Patient. Nauta figura solo como Provenance.agent con rol contributor."
}

# ----------------------------------------------------------------------------
# Regla SAMD-06 · AUDIT de toda detección cerca del perímetro SaMD
#
# Toda detección que pase los guardrails se registra para revisión
# adversarial periódica (¿estamos cerca del perímetro? ¿debemos retroceder?).
# ----------------------------------------------------------------------------

audit[record] if {
	input.output.label in {"criteria_pattern_match", "divergence_detection"}
	allow
	record := {
		"action": "samd_boundary_event",
		"regulatory_basis": "Decreto 4725 de 2005",
		"output_label": input.output.label,
		"referenced_criteria": input.output.referenced_criteria.citation,
		"severity": input.output.severity,
		"target_role": input.output.target_role,
		"patient_id_hash": input.patient_id_hash,
		"samd_perimeter_check": "passed",
		"timestamp": input.timestamp,
		"ledger_action_id": input.action_id,
	}
}
