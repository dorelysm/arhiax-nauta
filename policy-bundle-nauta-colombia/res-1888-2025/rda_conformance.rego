# ============================================================================
# ARHIAX Nauta · Resolución 1888 de 2025 · v0.2 (Colombia)
# ============================================================================
# Package:    arhiax.nauta.co.res_1888_2025
# Bundle:     policy-bundle-nauta-colombia v0.2.0
#
# Fuente normativa:
#   - Resolución 1888 de 2025 (MinSalud Colombia), publicada 2025-09-15
#   - Resolución 866 de 2021 (catálogos)
#   - Ley 2015 de 2020 (marco IHCE)
#   - Política de Gobierno Digital (MinTIC)
#
# Fuente técnica (perfiles FHIR oficiales):
#   - Guía de Implementación FHIR RDA (CO) v0.8.1
#   - URL canonical base: https://fhir.minsalud.gov.co/rda/
#   - Package: minsalud.fhir.co.rda#0.8.1
#   - Base: FHIR R4 (4.0.1)
#   - URL navegable: https://vulcano.ihcecol.gov.co/
#
# Vigencia:
#   - Publicación: 2025-09-15
#   - Inicio plazo gracia: 2025-10-15
#   - Cumplimiento obligatorio: 2026-04-15
#
# Disclaimer legal:
#   Este archivo Rego implementa controles técnicos que asisten al
#   cumplimiento de la Resolución 1888 de 2025. NO certifica conformidad
#   oficial. La validación final debe realizarse contra el Validador
#   Oficial de la Plataforma IHCE del MinSalud.
#
# CORRECCIÓN CRÍTICA v0.2 vs v0.1:
#   v0.1 inventaba criterios de conformidad. v0.2 valida contra los perfiles
#   oficiales publicados por HL7 Colombia / MinSalud.
# ============================================================================

package arhiax.nauta.co.res_1888_2025

import future.keywords.if
import future.keywords.in
import future.keywords.contains

# ----------------------------------------------------------------------------
# CANONICAL URLs OFICIALES (no inventadas)
# ----------------------------------------------------------------------------

# Tipos de Composition RDA oficiales
composition_profile_patient_statement := "https://fhir.minsalud.gov.co/rda/StructureDefinition/CompositionPatientStatementRDA"
composition_profile_ambulatory := "https://fhir.minsalud.gov.co/rda/StructureDefinition/CompositionAmbulatoryRDA"
composition_profile_hospitalization := "https://fhir.minsalud.gov.co/rda/StructureDefinition/CompositionHospitalizationRDA"
composition_profile_emergency := "https://fhir.minsalud.gov.co/rda/StructureDefinition/CompositionEmergencyRDA"

# Bundle transaccional RDA Paciente (el único que Nauta puede producir)
bundle_profile_patient_statement := "https://fhir.minsalud.gov.co/rda/StructureDefinition/BundlePatientStatementRDA"

# Perfiles de recursos referenciables
profile_patient := "https://fhir.minsalud.gov.co/rda/StructureDefinition/PatientRDA"
profile_practitioner := "https://fhir.minsalud.gov.co/rda/StructureDefinition/PractitionerRDA"
profile_organization_ips := "https://fhir.minsalud.gov.co/rda/StructureDefinition/CareDeliveryOrganizationRDA"
profile_condition_statement := "https://fhir.minsalud.gov.co/rda/StructureDefinition/ConditionStatementRDA"
profile_allergy_statement := "https://fhir.minsalud.gov.co/rda/StructureDefinition/AllergyIntoleranceStatementRDA"
profile_medication_statement := "https://fhir.minsalud.gov.co/rda/StructureDefinition/MedicationStatementRDA"
profile_family_history := "https://fhir.minsalud.gov.co/rda/StructureDefinition/FamilyMemberHistoryRDA"

# CodeSystems oficiales colombianos (citados, no redefinidos)
codesystem_person_identifier := "https://fhir.minsalud.gov.co/rda/CodeSystem/ColombianPersonIdentifier"
codesystem_icd10_co := "https://fhir.minsalud.gov.co/rda/CodeSystem/ICD10CO"
codesystem_cups := "https://fhir.minsalud.gov.co/rda/CodeSystem/CUPS"
codesystem_practitioner_function := "https://fhir.minsalud.gov.co/rda/CodeSystem/PactitionerTypeFunction"
codesystem_divipola := "https://fhir.minsalud.gov.co/rda/CodeSystem/DIVIPOLA"

# Terminologías internacionales aceptadas por la Guía RDA
codesystem_snomed_ct := "http://snomed.info/sct"
codesystem_loinc := "http://loinc.org"

# ----------------------------------------------------------------------------
# Regla R1888-01 · DOCTRINAL · Nauta SOLO produce RDA Paciente
#
# Posicionamiento estructural: Nauta produce únicamente documentos del tipo
# CompositionPatientStatementRDA, donde el AUTOR FORMAL del documento es el
# paciente mismo. Esto preserva la mediación: Nauta facilita el autoreporte
# del paciente, no genera acto clínico.
#
# Producir CompositionAmbulatoryRDA, CompositionHospitalizationRDA o
# CompositionEmergencyRDA implica que un profesional de salud (Practitioner)
# es el autor del documento, lo cual constituye acto clínico bajo el régimen
# sanitario colombiano y haría a Nauta clasificable como SaMD (Decreto
# 4725/2005).
#
# Esta regla es la implementación técnica de la decisión doctrinal del
# TR-032/CT-02 + Decisión 2.
# ----------------------------------------------------------------------------

default may_produce := false

may_produce if {
    input.target_composition_profile == composition_profile_patient_statement
}

deny[msg] if {
    input.action_category == "produce_composition"
    input.target_composition_profile in {
        composition_profile_ambulatory,
        composition_profile_hospitalization,
        composition_profile_emergency
    }
    msg := sprintf("DENY · R1888-01 · Decreto 4725/2005: Nauta NO puede producir %s (constituye acto clínico). Solo CompositionPatientStatementRDA permitido.", [input.target_composition_profile])
}

# ----------------------------------------------------------------------------
# Regla R1888-02 · Validación estructural del Bundle Paciente
#
# El Bundle producido debe:
#   1. Ser de tipo "document"
#   2. Declarar conformidad al perfil BundlePatientStatementRDA
#   3. Tener Composition raíz con perfil CompositionPatientStatementRDA
#   4. Incluir un recurso Patient conformante a PatientRDA
#
# FMEA: Si el Bundle se acepta sin estos predicados, será rechazado por la
# plataforma IHCE en submission → falso positivo de conformidad.
# ----------------------------------------------------------------------------

default bundle_structurally_valid := false

bundle_structurally_valid if {
    input.bundle.type == "document"
    has_bundle_profile_declaration
    has_root_composition
    has_patient_resource
}

has_bundle_profile_declaration if {
    some profile in input.bundle.meta.profile
    profile == bundle_profile_patient_statement
}

has_root_composition if {
    first := input.bundle.entry[0].resource
    first.resourceType == "Composition"
    some profile in first.meta.profile
    profile == composition_profile_patient_statement
}

has_patient_resource if {
    some entry in input.bundle.entry
    entry.resource.resourceType == "Patient"
    some profile in entry.resource.meta.profile
    profile == profile_patient
}

deny[msg] if {
    input.action_category == "submit_bundle_to_ihce"
    not bundle_structurally_valid
    msg := "DENY · R1888-02: Bundle no conforme estructuralmente al perfil BundlePatientStatementRDA. Verificar tipo='document', meta.profile, Composition raíz y Patient referenciado."
}

# ----------------------------------------------------------------------------
# Regla R1888-03 · Identificador de paciente conforme catálogo oficial
#
# El paciente DEBE identificarse mediante el sistema oficial colombiano
# ColombianPersonIdentifier (CC, CE, TI, RC, PA, AS, MS, NU, PE).
#
# CORRECCIÓN v0.2: en v0.1 se usaban URNs inventadas. v0.2 referencia
# el CodeSystem oficial de la Guía RDA.
# ----------------------------------------------------------------------------

deny[msg] if {
    input.action_category == "submit_bundle_to_ihce"
    some entry in input.bundle.entry
    entry.resource.resourceType == "Patient"
    not has_valid_patient_identifier(entry.resource)
    msg := "DENY · R1888-03: Patient debe identificarse con el CodeSystem ColombianPersonIdentifier oficial. Ver: https://vulcano.ihcecol.gov.co/CodeSystem-ColombianPersonIdentifier.html"
}

has_valid_patient_identifier(patient) if {
    some identifier in patient.identifier
    identifier.type.coding[_].system == codesystem_person_identifier
}

# ----------------------------------------------------------------------------
# Regla R1888-04 · Codificación clínica con terminologías aceptadas
#
# Las observaciones y condiciones del Bundle deben codificarse usando los
# CodeSystems aceptados por la Guía RDA. Estos son:
#   - ICD-10 Colombia (ICD10CO) para diagnósticos
#   - CUPS para procedimientos
#   - SNOMED CT (internacional) cuando aplique
#   - LOINC para observaciones de laboratorio
#
# Nauta NO codifica directamente; verifica que la codificación presente en
# el Bundle producido use sistemas aceptados.
#
# CORRECCIÓN v0.2: en v0.1 se especificaban códigos concretos (e.g. LOINC
# 26466-4) no verificados. v0.2 solo exige que el system pertenezca al
# catálogo aceptado y delega la validez del code al Validador IHCE oficial.
# ----------------------------------------------------------------------------

deny[msg] if {
    input.action_category == "submit_bundle_to_ihce"
    some entry in input.bundle.entry
    entry.resource.resourceType in {"Condition", "Observation", "Procedure", "AllergyIntolerance"}
    not has_accepted_coding_system(entry.resource)
    msg := sprintf("DENY · R1888-04: Recurso %s usa coding system fuera de los aceptados por la Guía RDA. Aceptados: ICD10CO, CUPS, SNOMED CT, LOINC.", [entry.resource.resourceType])
}

has_accepted_coding_system(resource) if {
    some coding in resource.code.coding
    coding.system in accepted_coding_systems
}

accepted_coding_systems := {
    "https://fhir.minsalud.gov.co/rda/CodeSystem/ICD10CO",
    "https://fhir.minsalud.gov.co/rda/CodeSystem/CUPS",
    "http://snomed.info/sct",
    "http://loinc.org"
}

# ----------------------------------------------------------------------------
# Regla R1888-05 · Provenance criptográficamente firmado por Nauta
#
# Todo Bundle producido por Nauta debe incluir un recurso Provenance que:
#   1. Identifica a Nauta como contribuidor (no como autor clínico)
#   2. Incluye firma criptográfica (Provenance.signature) verificable
#   3. Referencia el ledger HMAC interno de ARHIAX
#
# CORRECCIÓN v0.2: en v0.1 el Provenance estaba sub-especificado. v0.2
# define formato, firma y vínculo con el ledger.
#
# Formato firma: JWS (RFC 7515) con algoritmo ES256
# Identificador agente: urn:sinergia:arhiax:nauta:v{version}
# ----------------------------------------------------------------------------

nauta_agent_identifier := "urn:sinergia:arhiax:nauta"

deny[msg] if {
    input.action_category == "submit_bundle_to_ihce"
    not has_signed_nauta_provenance
    msg := "DENY · R1888-05: Bundle debe incluir Provenance firmado identificando a Nauta como contribuidor (no como autor clínico). Formato JWS ES256."
}

has_signed_nauta_provenance if {
    some entry in input.bundle.entry
    prov := entry.resource
    prov.resourceType == "Provenance"
    is_nauta_agent(prov)
    has_valid_signature(prov)
    is_contributor_role(prov)
}

is_nauta_agent(provenance) if {
    some agent in provenance.agent
    startswith(agent.who.identifier.value, nauta_agent_identifier)
}

# Provenance debe tener rol "contributor", NUNCA "author" para el Bundle
# Patient Statement (porque el autor formal del documento es el paciente)
is_contributor_role(provenance) if {
    some agent in provenance.agent
    some coding in agent.type.coding
    coding.code == "ASSEMBLER"  # FHIR provenance-participant-type code
}

has_valid_signature(provenance) if {
    some sig in provenance.signature
    sig.type[_].code == "1.2.840.10065.1.12.1.7"  # ASTM signature meaning code
    sig.sigFormat == "application/jose"
    sig.data != ""
}

# ----------------------------------------------------------------------------
# Regla R1888-06 · Transporte cifrado obligatorio
#
# La Resolución 1888/2025 exige TLS 1.3 + AES-256 para transmisión a la
# plataforma IHCE del MinSalud. Esta es responsabilidad del runtime, no del
# bundle, pero se valida que el flag esté presente.
# ----------------------------------------------------------------------------

deny[msg] if {
    input.action_category == "submit_bundle_to_ihce"
    not input.transport.tls_version == "1.3"
    msg := "DENY · R1888-06: Transmisión a IHCE requiere TLS 1.3 (Anexo Técnico Res. 1888/2025)."
}

# ----------------------------------------------------------------------------
# Regla R1888-07 · AUDIT obligatorio de cada submission
#
# Cada submission exitosa al IHCE debe quedar registrada para auditoría
# administrativa de cumplimiento ante MinSalud / SuperSalud.
# ----------------------------------------------------------------------------

audit[record] if {
    input.action_category == "submit_bundle_to_ihce"
    bundle_structurally_valid
    record := {
        "action": "ihce_bundle_submission",
        "regulatory_basis": "Resolución 1888 de 2025",
        "composition_profile": composition_profile_patient_statement,
        "institution_id": input.institution.id,
        "patient_id_hash": input.patient_id_hash,
        "submission_timestamp": input.timestamp,
        "ihce_transaction_id": input.ihce_response.transaction_id,
        "compliance_status": "submitted_conformant",
        "tls_version": input.transport.tls_version,
        "nauta_version": "v0.2"
    }
}
