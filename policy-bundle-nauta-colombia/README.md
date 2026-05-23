# ARHIAX Nauta · Policy Bundle v0.2 · Colombia

**Estado:** Draft for v0.2 release · Mayo 23, 2026
**Alcance jurisdiccional:** EXCLUSIVAMENTE COLOMBIA
**Vigencia regulatoria de referencia:** Resolución 1888 de 2025 · cumplimiento obligatorio desde 15 de abril de 2026

---

## Posicionamiento doctrinal

Este bundle materializa el principio Governex Thinking de Sinergia Consulting Group: **gobernanza ejecutable**. No es documento de compliance; es código Rego que el ARHIAX Agent Trust Kernel carga y evalúa en cada acción del agente Nauta.

Nauta es agente de navegación clínica longitudinal. Opera bajo una doctrina estructural:

- **Nauta media, no decide.** Toda decisión clínica corresponde al médico tratante.
- **Nauta produce solo RDA Paciente.** Documentos donde el autor formal es el paciente mismo (CompositionPatientStatementRDA del perfil oficial MinSalud).
- **Nauta opera fuera del perímetro SaMD.** No emite diagnósticos, recomendaciones terapéuticas ni puntajes clínicos.
- **Nauta atestigua todo lo que hace.** Cada acción registrada en ledger HMAC antes de ejecutarse (bifurcación epistémica).

---

## Cambios respecto a v0.1 (Kill Critic corregido)

| Debilidad v0.1 | Corrección v0.2 |
|----------------|-----------------|
| Conformidad RDA declarada pero no validada contra perfiles oficiales | Canonical URLs reales de StructureDefinitions MinSalud (vulcano.ihcecol.gov.co) |
| Códigos LOINC/SNOMED inventados | Solo se valida que el coding system sea aceptado; codes específicos delegados al Validador IHCE |
| Graus 2016 simplificado (solo "possible") | Tres niveles modelados: possible, probable (anti-NMDAR + limbic), definite |
| Sin FMEA | docs/FMEA.md con 8 modos de falla + mitigaciones |
| Provenance sub-especificado | Formato JWS ES256 + agent identifier + signature obligatoria |
| Runtime asumido sin documentar | docs/runtime-contract.md completo |
| Sin tests cross-paquete | tests/integration_test.rego con 5 escenarios integrales |

---

## Estructura del bundle

```
policy-bundle-nauta-colombia/
├── manifest.json                                  ← versión, regulaciones, disclaimers
├── README.md                                      ← este archivo
├── base/
│   ├── autonomy.rego                              ← niveles A0-A4, ledger HMAC
│   └── hic.rego                                   ← 5 checkpoints humanos
├── res-1888-2025/
│   └── rda_conformance.rego                       ← Resolución 1888/2025 con canonical URLs oficiales
├── habeas-data/
│   └── granular_consent.rego                      ← Ley 1581/2012 + Ley 2015/2020
├── decreto-4725-2005/
│   └── samd_guardrails.rego                       ← Límites SaMD INVIMA
├── clinical-graus-2016/
│   └── encephalitis_criteria.rego                 ← 3 niveles diagnósticos
├── data/
│   ├── thresholds.json                            ← umbrales por IPS (externalizado)
│   └── entity_types.json                          ← roles alineados con REPS
├── tests/
│   ├── autonomy_test.rego                         ← 8 tests
│   └── integration_test.rego                      ← 5 escenarios cross-paquete
└── docs/
    ├── runtime-contract.md                        ← contrato con el ATK
    └── FMEA.md                                    ← análisis modos de falla
```

---

## Disclaimer legal

**ESTE BUNDLE NO SUSTITUYE LAS OBLIGACIONES LEGALES** de los Prestadores de Servicios de Salud (PSS) ni de las Entidades Administradoras de Planes de Beneficios (EAPB) bajo la Resolución 1888 de 2025, la Ley 2015 de 2020, la Ley 1581 de 2012 ni cualquier otra norma vigente.

El bundle implementa controles técnicos que asisten al cumplimiento pero NO certifican conformidad ante autoridades. La validación final de conformidad RDA debe realizarse contra el **Validador Oficial del MinSalud / Plataforma IHCE**. La interpretación jurídica corresponde a los asesores legales de la institución implementadora.

---

## Despliegue

```bash
# 1. Validar sintaxis
opa parse policy-bundle-nauta-colombia/

# 2. Ejecutar tests
opa test policy-bundle-nauta-colombia/

# 3. Construir bundle
opa build policy-bundle-nauta-colombia/ -o nauta.tar.gz

# 4. Desplegar en runtime ARHIAX (ver runtime-contract.md)
arhiax-runtime deploy --bundle nauta.tar.gz --institution ips_cgn_baq
```

---

## Roadmap v0.3

- Codificar Tabla 6 de Graus 2016 (autoantibody-negative AE)
- Integración con Validador IHCE oficial en CI pipeline
- Regla ESCALATE para flag `alternative_causes_excluded` no actualizado
- Open-sourcing del bundle base (Graus 2016 + reglas comunes) bajo CC-BY-SA 4.0
- Overlay structure formalizada para PANLAR/EULAR criterios (reumatología)

---

**Contacto:** Sinergia Consulting Group S.A.S. · architect@sinergia.co
**Licencia:** Proprietary · Sinergia + licensed institutions (base layer roadmap v0.3 → CC-BY-SA 4.0)
