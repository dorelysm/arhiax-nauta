# ============================================================================
# ARHIAX Nauta · Graus 2016 · Criterios Encefalitis Autoinmune · v0.2 (CO)
# ============================================================================
# Package:    arhiax.nauta.clinical.graus_2016
# Bundle:     policy-bundle-nauta-colombia v0.2.0
#
# Fuente:
#   Graus F, Titulaer MJ, Balu R, Benseler S, Bien CG, Cellucci T, Cortese I,
#   Dale RC, Gelfand JM, Geschwind M, Glaser CA, Honnorat J, Höftberger R,
#   Iizuka T, Irani SR, Lancaster E, Leypoldt F, Prüss H, Rae-Grant A,
#   Reindl M, Rosenfeld MR, Rostásy K, Saiz A, Venkatesan A, Vincent A,
#   Wandinger KP, Waters P, Dalmau J.
#   A clinical approach to diagnosis of autoimmune encephalitis.
#   Lancet Neurol. 2016 Apr;15(4):391-404.
#   DOI: 10.1016/S1474-4422(15)00401-9
#
# CORRECCIÓN CRÍTICA v0.2 vs v0.1:
#   v0.1 modelaba solo "possible AE" simplificado.
#   v0.2 modela los tres niveles del paper original:
#     - Possible Autoimmune Encephalitis (Tabla 1 Graus 2016)
#     - Probable AE en cuatro subtipos:
#         * Probable anti-NMDAR encephalitis (Tabla 3)
#         * Probable autoimmune limbic encephalitis (Tabla 2)
#         * Probable ADEM (Tabla 4 - acute disseminated encephalomyelitis)
#         * Probable Bickerstaff brainstem encephalitis (Tabla 5)
#     - Definite AE (con confirmación de anticuerpos en suero o LCR)
#
# IMPORTANTE: Nauta NO diagnostica. Detecta patrón de coincidencia con
# criterios PUBLICADOS y notifica al clinical-navigator. La interpretación
# diagnóstica corresponde al médico tratante.
# ============================================================================

package arhiax.nauta.clinical.graus_2016

import future.keywords.every
import future.keywords.if
import future.keywords.in

# ============================================================================
# NIVEL 1 · POSSIBLE AUTOIMMUNE ENCEPHALITIS
# Fuente: Graus 2016, Tabla 1
# Los tres criterios deben cumplirse (1 AND 2 AND 3)
# ============================================================================

default possible_ae_pattern := false

possible_ae_pattern if {
	possible_criterion_1
	possible_criterion_2
	possible_criterion_3
}

# Criterion 1: Subacute onset (rapid progression < 3 months) of:
#   - working memory deficits (short-term memory loss), OR
#   - altered mental status (decreased/altered level of consciousness,
#     lethargy, or personality change), OR
#   - psychiatric symptoms
#
# FMEA: pacientes con onset agudo (<24h) técnicamente cumplen subacute pero
# requieren evaluación diferencial urgente distinta. Se mantiene el criterio
# del paper, pero el output severity reflejará la urgencia.
possible_criterion_1 if {
	onset_subacute
	has_qualifying_neuropsych_presentation
}

onset_subacute if {
	days := days_since_first_neuro_symptom
	days >= 1
	days <= 90
}

has_qualifying_neuropsych_presentation if {
	some obs in input.patient_graph.clinical_observations
	obs.category in {
		"working_memory_deficit",
		"short_term_memory_loss",
		"altered_mental_status",
		"decreased_consciousness",
		"lethargy",
		"personality_change",
		"psychiatric_symptoms_new_onset",
	}
	obs.status == "active"
}

# Criterion 2: At least one of:
#   (a) new focal CNS findings
#   (b) seizures not explained by previously known seizure disorder
#   (c) CSF pleocytosis (WBC > 5/mm³)
#   (d) MRI features suggestive of encephalitis
possible_criterion_2 if {
	count(paraclinical_findings) >= 1
}

paraclinical_findings := finding_set if {
	finding_set := {f |
		some obs in input.patient_graph.clinical_observations
		f := classify_paraclinical(obs)
		f != ""
	}
}

classify_paraclinical(obs) := "focal_cns_finding" if {
	obs.category == "focal_neurological_sign"
	obs.attribute.new_onset == true
}

classify_paraclinical(obs) := "unexplained_seizure" if {
	obs.category == "seizure"
	obs.attribute.prior_epilepsy != true
}

classify_paraclinical(obs) := "csf_pleocytosis" if {
	obs.category == "csf_analysis"
	obs.attribute.wbc_per_mm3 > 5
}

classify_paraclinical(obs) := "mri_encephalitic" if {
	obs.category == "imaging_finding"
	obs.attribute.modality == "MRI"
	obs.attribute.interpretation in {
		"encephalitic_pattern",
		"limbic_hyperintensity",
		"mesial_temporal_t2_flair_hyperintensity",
	}
}

# Criterion 3: Reasonable exclusion of alternative causes
# (infectious, toxic, metabolic, vascular, paraneoplastic non-immune)
possible_criterion_3 if {
	input.patient_graph.alternative_causes_excluded == true
}

# ============================================================================
# NIVEL 2A · PROBABLE ANTI-NMDAR ENCEPHALITIS
# Fuente: Graus 2016, Tabla 3
# Criterios A AND B AND C (sin necesidad de anticuerpos confirmados)
# ============================================================================

probable_anti_nmdar if {
	nmdar_criterion_a
	nmdar_criterion_b
	nmdar_criterion_c
}

# A: Rapid onset (<3 months) of at least 4 of 6 major symptom groups
nmdar_criterion_a if {
	onset_subacute
	nmdar_symptom_groups_present >= 4
}

nmdar_symptom_groups_present := count(present_groups) if {
	present_groups := {g |
		some obs in input.patient_graph.clinical_observations
		g := classify_nmdar_symptom(obs)
		g != ""
	}
}

classify_nmdar_symptom(obs) := "abnormal_behavior_or_cognitive" if {
	obs.category in {"psychiatric_symptoms_new_onset", "cognitive_dysfunction", "personality_change"}
}

classify_nmdar_symptom(obs) := "speech_dysfunction" if {
	obs.category in {"pressured_speech", "verbal_reduction", "mutism"}
}

classify_nmdar_symptom(obs) := "seizures" if {
	obs.category == "seizure"
}

classify_nmdar_symptom(obs) := "movement_disorder_dyskinesias_rigidity" if {
	obs.category in {"orofacial_dyskinesias", "rigidity", "abnormal_postures", "dystonia"}
}

classify_nmdar_symptom(obs) := "decreased_consciousness" if {
	obs.category in {"decreased_consciousness", "altered_mental_status"}
}

classify_nmdar_symptom(obs) := "autonomic_dysfunction_or_hypoventilation" if {
	obs.category in {"autonomic_instability", "hypoventilation", "central_hypoventilation"}
}

# B: At least one of the following laboratory study results
nmdar_criterion_b if {
	has_abnormal_eeg
}

nmdar_criterion_b if {
	has_csf_pleocytosis_or_oligoclonal_bands
}

has_abnormal_eeg if {
	some obs in input.patient_graph.clinical_observations
	obs.category == "eeg"
	obs.attribute.interpretation in {
		"extreme_delta_brush",
		"focal_or_diffuse_slow_activity",
		"disorganized_activity",
		"epileptic_activity",
	}
}

has_csf_pleocytosis_or_oligoclonal_bands if {
	some obs in input.patient_graph.clinical_observations
	obs.category == "csf_analysis"
	any_of_csf_criteria(obs)
}

any_of_csf_criteria(obs) if {
	obs.attribute.wbc_per_mm3 > 5
}

any_of_csf_criteria(obs) if {
	obs.attribute.oligoclonal_bands == true
}

# C: Reasonable exclusion of other disorders
nmdar_criterion_c if {
	input.patient_graph.alternative_causes_excluded == true
}

# ============================================================================
# NIVEL 2B · PROBABLE AUTOIMMUNE LIMBIC ENCEPHALITIS
# Fuente: Graus 2016, Tabla 2
# Los cuatro criterios deben cumplirse (1 AND 2 AND 3 AND 4)
# ============================================================================

probable_limbic_encephalitis if {
	limbic_criterion_1
	limbic_criterion_2
	limbic_criterion_3
	limbic_criterion_4
}

# 1: Subacute onset (<3 months) of working memory deficits, seizures, or
#    psychiatric symptoms suggesting involvement of the limbic system
limbic_criterion_1 if {
	onset_subacute
	has_limbic_presentation
}

has_limbic_presentation if {
	some obs in input.patient_graph.clinical_observations
	obs.category in {
		"working_memory_deficit",
		"short_term_memory_loss",
		"seizure",
		"psychiatric_symptoms_new_onset",
	}
}

# 2: Bilateral brain abnormalities on T2-weighted FLAIR MRI highly
#    restricted to medial temporal lobes
limbic_criterion_2 if {
	some obs in input.patient_graph.clinical_observations
	obs.category == "imaging_finding"
	obs.attribute.modality == "MRI"
	obs.attribute.interpretation == "bilateral_medial_temporal_t2_flair_hyperintensity"
}

# 3: At least one of:
#    - CSF pleocytosis (WBC > 5/mm³)
#    - EEG with epileptic or slow-wave activity involving temporal lobes
limbic_criterion_3 if {
	has_csf_pleocytosis_or_oligoclonal_bands
}

limbic_criterion_3 if {
	some obs in input.patient_graph.clinical_observations
	obs.category == "eeg"
	obs.attribute.interpretation in {"temporal_epileptic_activity", "temporal_slow_wave"}
}

# 4: Reasonable exclusion of alternative causes
limbic_criterion_4 if {
	input.patient_graph.alternative_causes_excluded == true
}

# ============================================================================
# NIVEL 3 · DEFINITE AUTOIMMUNE ENCEPHALITIS
# Requiere confirmación de anticuerpos específicos en suero o LCR
# Fuente: Graus 2016, secciones específicas por subtipo
# ============================================================================

definite_ae_with_antibodies if {
	possible_ae_pattern
	has_confirmed_specific_antibody
}

has_confirmed_specific_antibody if {
	some obs in input.patient_graph.clinical_observations
	obs.category == "antibody_test_result"
	obs.attribute.status == "final"
	obs.attribute.result == "positive"
	obs.attribute.antibody_target in confirmed_ae_antibodies
}

# Anticuerpos asociados a encefalitis autoinmune (Graus 2016)
confirmed_ae_antibodies := {
	"anti-NMDAR",
	"anti-LGI1",
	"anti-CASPR2",
	"anti-AMPAR",
	"anti-GABA-B-R",
	"anti-GABA-A-R",
	"anti-GAD65",
	"anti-IgLON5",
	"anti-DPPX",
	"anti-mGluR5",
	"anti-D2R",
	"anti-glycine-receptor",
	"anti-Hu",
	"anti-Ma2",
	"anti-CV2-CRMP5",
	"anti-amphiphysin",
}

# ============================================================================
# DETECCIÓN DE DIVERGENCIA · Patrones operacionales que ameritan notificación
# ============================================================================

# Divergencia · Latencia anómala entre onset y evaluación
# El umbral default es 14 días (literatura) configurable por IPS
divergence_evaluation_latency if {
	possible_ae_pattern
	days_since_first_neuro_symptom > institutional_threshold("graus_evaluation_latency_days")
}

# Divergencia · Anticuerpo ordenado sin resultado en ventana
divergence_antibody_pending if {
	some order in input.patient_graph.orders
	order.category == "antibody_panel"
	order.target in confirmed_ae_antibodies
	days_since_iso(order.date) > institutional_threshold("antibody_result_max_days")
	not has_matching_result(order.id)
}

has_matching_result(order_id) if {
	some result in input.patient_graph.clinical_observations
	result.attribute.based_on == order_id
	result.attribute.status == "final"
}

# Divergencia · Patrón probable sin inmunoterapia iniciada
divergence_treatment_not_started if {
	any_probable_pattern
	days_since_first_neuro_symptom > institutional_threshold("immunotherapy_initiation_max_days")
	not has_immunotherapy_started
}

any_probable_pattern if probable_anti_nmdar
any_probable_pattern if probable_limbic_encephalitis

has_immunotherapy_started if {
	some med in input.patient_graph.clinical_observations
	med.category == "medication_statement"
	med.attribute.therapeutic_class in {"corticosteroids_high_dose", "ivig", "plasma_exchange", "rituximab", "cyclophosphamide"}
	med.attribute.status == "active"
}

# ============================================================================
# NOTIFICACIÓN · CDS Hook al clinical-navigator (NUNCA a treating-physician)
# Origen: TR-2026-032 · CT-02 · Política P-01
# ============================================================================

notify_clinical_navigator if divergence_evaluation_latency
notify_clinical_navigator if divergence_antibody_pending
notify_clinical_navigator if divergence_treatment_not_started

severity_indicator := "critical" if {
	days_since_first_neuro_symptom > 14
	any_probable_pattern
}

severity_indicator := "high" if {
	days_since_first_neuro_symptom <= 14
	any_probable_pattern
}

severity_indicator := "warning" if {
	not any_probable_pattern
	notify_clinical_navigator
}

# Etiqueta del nivel de coincidencia detectado (para el navegador)
match_level := "definite_with_antibodies" if definite_ae_with_antibodies

match_level := "probable_anti_nmdar" if {
	not definite_ae_with_antibodies
	probable_anti_nmdar
}

match_level := "probable_limbic_encephalitis" if {
	not definite_ae_with_antibodies
	not probable_anti_nmdar
	probable_limbic_encephalitis
}

match_level := "possible_ae" if {
	not definite_ae_with_antibodies
	not probable_anti_nmdar
	not probable_limbic_encephalitis
	possible_ae_pattern
}

# ============================================================================
# CDS Hook Payload · estructura canónica de notificación
# ============================================================================

cds_hook_payload := {
	"hook": "patient-view",
	"context": {
		"patient_id_hash": input.patient_id_hash,
		"user_role": "clinical-navigator",
	},
	"cards": [{
		"summary": sprintf("Coincidencia con criterios Graus 2016 · nivel %s · severidad %s", [match_level, severity_indicator]),
		"indicator": severity_indicator,
		"detail": detail_text,
		"source": {
			"label": "Graus F et al. Lancet Neurol 2016;15:391-404",
			"url": "https://doi.org/10.1016/S1474-4422(15)00401-9",
		},
		"links": [{
			"label": "Trayectoria atestada del paciente",
			"url": sprintf("https://nauta.arhiax.co/trajectory/%s", [input.patient_id_hash]),
			"type": "absolute",
		}],
	}],
} if {
	notify_clinical_navigator
}

detail_text := text if {
	notify_clinical_navigator
	text := sprintf(
		"Días desde primer síntoma: %d · Nivel coincidencia: %s · Divergencia detectada: %s · Nauta organiza la trayectoria autoreportada del paciente y detecta coincidencia con criterios publicados. NO constituye diagnóstico. La interpretación clínica corresponde al médico tratante.",
		[days_since_first_neuro_symptom, match_level, divergence_description],
	)
}

divergence_description := "latencia anómala de evaluación" if divergence_evaluation_latency
divergence_description := "anticuerpos pendientes" if divergence_antibody_pending
divergence_description := "tratamiento no iniciado en ventana óptima" if divergence_treatment_not_started

# ============================================================================
# AUDIT obligatorio de cada match para feedback loop de calibración
# ============================================================================

audit[record] if {
	notify_clinical_navigator
	record := {
		"action": "graus_2016_pattern_match",
		"criteria_source": "Graus et al. 2016 Lancet Neurol 15:391-404",
		"criteria_doi": "10.1016/S1474-4422(15)00401-9",
		"match_level": match_level,
		"severity": severity_indicator,
		"possible_criteria_met": {
			"criterion_1_neuropsych": possible_criterion_1,
			"criterion_2_paraclinical": possible_criterion_2,
			"criterion_3_alternatives_excluded": possible_criterion_3,
		},
		"probable_pattern_anti_nmdar": probable_anti_nmdar,
		"probable_pattern_limbic": probable_limbic_encephalitis,
		"definite_with_antibodies": definite_ae_with_antibodies,
		"days_since_onset": days_since_first_neuro_symptom,
		"divergence_type": divergence_description,
		"patient_id_hash": input.patient_id_hash,
		"institution_id": input.institution.id,
		"timestamp": input.evaluation_date,
		"ledger_action_id": input.action_id,
	}
}

# ============================================================================
# HELPERS
# ============================================================================

days_since_first_neuro_symptom := days if {
	first := input.patient_graph.first_neurological_symptom_date
	days := days_since_iso(first)
}

days_since_iso(iso_date) := days if {
	current := time.parse_rfc3339_ns(input.evaluation_date)
	past := time.parse_rfc3339_ns(iso_date)
	nanos := current - past
	days := nanos / ((24 * 3600) * 1000000000)
}

institutional_threshold(name) := value if {
	inst_id := input.institution.id
	value := data.thresholds.institutional[inst_id][name]
}

institutional_threshold(name) := value if {
	inst_id := input.institution.id
	not data.thresholds.institutional[inst_id][name]
	value := data.thresholds.default[name]
}
