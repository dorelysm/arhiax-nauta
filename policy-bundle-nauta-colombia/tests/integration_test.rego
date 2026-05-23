# ============================================================================
# Tests de integración cross-paquete · ARHIAX Nauta v0.2
# ============================================================================
# Estos tests verifican que múltiples paquetes Rego trabajen correctamente
# en composición, no aislados. Esta es la corrección al hueco identificado
# en Kill Critic v0.1 (Debilidad 7).
# ============================================================================
package arhiax.nauta.integration_test

import data.arhiax.nauta.base.autonomy
import data.arhiax.nauta.co.res_1888_2025
import data.arhiax.nauta.co.habeas_data
import data.arhiax.nauta.co.decreto_4725_2005
import data.arhiax.nauta.clinical.graus_2016

# ---- Flujo integral: submission RDA Paciente válida ----
# Escenario: Bundle bien formado + consentimiento activo + transporte cifrado
test_full_flow_valid_rda_submission {
    # Autonomy permite la acción
    autonomy.allow with input as full_flow_input
        with data.runtime.ledger.records as ledger_fixture

    # Res 1888 valida estructuralmente
    res_1888_2025.bundle_structurally_valid with input as full_flow_input
}

# ---- Flujo bloqueado: SAMD perimeter cruzado ----
# Escenario: alguien intenta producir CompositionAmbulatoryRDA con Nauta
test_full_flow_blocked_samd_perimeter {
    res_1888_2025.deny[_] with input as samd_violation_input
}

# ---- Flujo bloqueado: routing a treating-physician ----
test_full_flow_blocked_treating_physician_routing {
    autonomy.deny[_] with input as treating_physician_routing_input
        with data.runtime.ledger.records as ledger_fixture
}

# ---- Flujo bloqueado: consentimiento revocado ----
test_full_flow_blocked_revoked_consent {
    habeas_data.suspend[_] with input as data_access_after_revocation_input
        with data.consent as consent_with_revocation_fixture
}

# ---- Flujo bloqueado: dato sensible sin granular_explicit ----
test_full_flow_blocked_sensitive_without_granular {
    habeas_data.deny[_] with input as sensitive_blanket_input
        with data.consent as consent_blanket_only_fixture
}

# ============================================================================
# FIXTURES
# ============================================================================

full_flow_input := {
    "action_category": "submit_bundle_to_ihce",
    "action_id": "act_int_001",
    "autonomy_level": "A3",
    "target_role": "clinical-navigator",
    "target_composition_profile": "https://fhir.minsalud.gov.co/rda/StructureDefinition/CompositionPatientStatementRDA",
    "institution": {"id": "ips_cgn_baq", "overlay_status": "calibrated", "a4_enabled": false},
    "transport": {"tls_version": "1.3"},
    "patient_id_hash": "h_pat_001",
    "timestamp": "2026-04-20T10:00:00Z",
    "bundle": {
        "type": "document",
        "meta": {"profile": ["https://fhir.minsalud.gov.co/rda/StructureDefinition/BundlePatientStatementRDA"]},
        "entry": [
            {
                "resource": {
                    "resourceType": "Composition",
                    "meta": {"profile": ["https://fhir.minsalud.gov.co/rda/StructureDefinition/CompositionPatientStatementRDA"]}
                }
            },
            {
                "resource": {
                    "resourceType": "Patient",
                    "meta": {"profile": ["https://fhir.minsalud.gov.co/rda/StructureDefinition/PatientRDA"]},
                    "identifier": [{
                        "type": {"coding": [{"system": "https://fhir.minsalud.gov.co/rda/CodeSystem/ColombianPersonIdentifier", "code": "CC"}]},
                        "value": "12345678"
                    }]
                }
            }
        ]
    }
}

samd_violation_input := {
    "action_category": "produce_composition",
    "target_composition_profile": "https://fhir.minsalud.gov.co/rda/StructureDefinition/CompositionAmbulatoryRDA"
}

treating_physician_routing_input := {
    "autonomy_level": "A3",
    "action_id": "act_int_002",
    "target_role": "treating-physician"
}

data_access_after_revocation_input := {
    "action_category": "data_access",
    "patient_id": "pat_002",
    "requester": {"role": "clinical_navigator", "institution_type": "ips_alta_complejidad"},
    "data_category": "general_clinical",
    "access_purpose": "trajectory_coordination",
    "access_timestamp": "2026-04-20T10:00:00Z"
}

sensitive_blanket_input := {
    "patient_id": "pat_003",
    "requester": {"role": "treating_physician", "institution_type": "ips_alta_complejidad"},
    "data_category": "mental_health",
    "access_purpose": "clinical_consultation",
    "access_timestamp": "2026-04-20T10:00:00Z"
}

ledger_fixture := {
    "act_int_001": {"verified": true, "hmac_signature_valid": true, "timestamp": "2026-04-20T09:59:59Z"},
    "act_int_002": {"verified": true, "hmac_signature_valid": true, "timestamp": "2026-04-20T09:59:59Z"}
}

consent_with_revocation_fixture := {
    "policies": {
        "pat_002": [{
            "requester_role": "clinical_navigator",
            "data_category": "general_clinical",
            "purpose": "trajectory_coordination",
            "status": "active",
            "consent_type": "granular_explicit",
            "signed_timestamp": "2026-01-01T10:00:00Z"
        }]
    },
    "revocations": {
        "pat_002": {"timestamp": "2026-04-15T08:00:00Z"}
    },
    "exclusions": {"pat_002": []}
}

consent_blanket_only_fixture := {
    "policies": {
        "pat_003": [{
            "requester_role": "treating_physician",
            "data_category": "mental_health",
            "purpose": "clinical_consultation",
            "status": "active",
            "consent_type": "blanket",
            "signed_timestamp": "2026-01-01T10:00:00Z"
        }]
    },
    "revocations": {},
    "exclusions": {"pat_003": []}
}
