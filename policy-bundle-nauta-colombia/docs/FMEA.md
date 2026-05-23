# FMEA · Análisis de Modos de Falla · ARHIAX Nauta Bundle v0.2

**Propósito:** documentar explícitamente los modos en que el bundle puede fallar, su severidad clínica/regulatoria, y la mitigación implementada. Esto cierra la Debilidad 4 identificada en Kill Critic v0.1.

**Método:** FMEA simplificado (Failure Mode and Effects Analysis) con:
- **S** = Severidad (1-10, donde 10 = catastrófico)
- **O** = Ocurrencia esperada (1-10, donde 10 = casi seguro)
- **D** = Detectabilidad inversa (1-10, donde 10 = imposible de detectar)
- **RPN** = S × O × D (Risk Priority Number; >100 requiere mitigación documentada)

---

## Falla 1 · Falso negativo en encefalitis seronegativa

**Descripción:** paciente con encefalitis autoinmune real, anticuerpos negativos en panel disponible, MRI inicialmente normal, EEG no característico. El bundle no notifica porque `criterion_2_paraclinical` no se cumple.

| S | O | D | RPN |
|---|---|---|-----|
| 9 | 4 | 7 | **252** |

**Reconocimiento explícito de Graus 2016:** el paper original reconoce que existen encefalitis autoinmunes seronegativas. La sección de "Autoantibody-negative but probable autoimmune encephalitis" (Tabla 6 del paper) define criterios adicionales para este caso. **Esta tabla NO está codificada en v0.2.**

**Mitigación v0.2:**
- Documentación explícita en el bundle (`encephalitis_criteria.rego`) de que la tabla 6 no está codificada
- AUDIT continuo que permite revisión retrospectiva por reumatólogo/neurólogo
- Roadmap v0.3: codificar Tabla 6 con feedback de pilotos en REAL LABIC

**Mitigación operativa:** el clinical-navigator humano sigue siendo decisor; Nauta no es el único filtro de detección. La doctrina de mediación protege contra este modo de falla porque no se delega la responsabilidad clínica al agente.

---

## Falla 2 · Flag `alternative_causes_excluded` nunca actualizado

**Descripción:** un paciente entra con criterio 1 y criterio 2 cumplidos, pero el médico tratante nunca actualiza el flag `alternative_causes_excluded` en el grafo del paciente. El bundle nunca emite notificación.

| S | O | D | RPN |
|---|---|---|-----|
| 8 | 7 | 5 | **280** |

**Mitigación v0.2:**
- AUDIT que registra coincidencia de criterio 1 + criterio 2 incluso si criterio 3 no se cumple. Esto permite a clinical-navigator revisar pacientes "casi cumplen" en revisión semanal.
- Roadmap v0.3: regla ESCALATE específica para "criterio 1 + 2 cumplidos por > 7 días sin actualización del flag de alternativas" — esto fuerza la atención humana.

---

## Falla 3 · Race condition en revocación de consentimiento

**Descripción:** el paciente revoca consentimiento. Antes de que la revocación se propague al ATK (≤ 1s contractual), se ejecuta una evaluación de acceso. El acceso se permite incorrectamente.

| S | O | D | RPN |
|---|---|---|-----|
| 8 | 2 | 9 | **144** |

**Mitigación v0.2:**
- Margen protectivo de 1 segundo: si `revocation_timestamp` está dentro de 1 segundo del `access_timestamp`, se considera revocado por defecto (`habeas_data.rego` regla HD-04).
- El runtime contract (`docs/runtime-contract.md`) exige propagación ≤ 1s.
- Roadmap v0.3: protocolo de "ventana segura" donde tras revocación se rechaza acceso por 5 segundos extra para garantizar propagación.

---

## Falla 4 · Overlay institucional con umbral demasiado laxo

**Descripción:** una IPS configura `graus_evaluation_latency_days: 30` cuando el default es 14. Esto reduce sensibilidad de detección y puede causar pacientes invisibles para Nauta.

| S | O | D | RPN |
|---|---|---|-----|
| 7 | 4 | 6 | **168** |

**Mitigación v0.2:**
- Pipeline de despliegue exige firma de director médico Y oficial de protección de datos para deploy_overlay (HIC-2).
- AUDIT que registra todos los umbrales de cada IPS para revisión periódica.
- Roadmap v0.3: validación de overlay que rechaza umbrales fuera de rangos clínicamente defensibles (e.g., latencia > 21 días requiere justificación documentada).

---

## Falla 5 · Submission RDA rechazada por validador IHCE

**Descripción:** el bundle Nauta produce un Bundle FHIR que pasa las validaciones internas (`R1888-02` a `R1888-06`) pero es rechazado por el Validador Oficial IHCE del MinSalud por un constraint no codificado.

| S | O | D | RPN |
|---|---|---|-----|
| 5 | 6 | 3 | **90** |

**Mitigación v0.2:**
- Disclaimer explícito en manifest.json: "ESTE BUNDLE NO SUSTITUYE LAS OBLIGACIONES LEGALES". La validación final es contra el Validador IHCE oficial.
- Logging del response del IHCE para diagnóstico.
- Roadmap v0.3: integración directa con el Validador IHCE en CI pipeline (validar contra el servidor del MinSalud antes de cada release del bundle).

---

## Falla 6 · Composition.author es Nauta por accidente

**Descripción:** un developer modifica el código y, por descuido, Nauta termina figurando como `Composition.author` en lugar de `Provenance.agent`. Esto convierte estructuralmente a Nauta en SaMD sin habilitación INVIMA.

| S | O | D | RPN |
|---|---|---|-----|
| 10 | 2 | 4 | **80** |

**Mitigación v0.2:**
- Regla `SAMD-05` en `decreto_4725_2005.rego` deniega explícitamente esta condición.
- Test de integración `test_full_flow_blocked_samd_perimeter`.
- Roadmap v0.3: validación estática (linter) del código del agente que detecte cualquier asignación de `nauta` a `Composition.author` y bloquee el merge.

---

## Falla 7 · Patient sin first_neurological_symptom_date

**Descripción:** un paciente entra al sistema sin fecha de primer síntoma neurológico documentada. El bundle no evalúa ninguno de los criterios Graus (silencio absoluto).

| S | O | D | RPN |
|---|---|---|-----|
| 6 | 7 | 5 | **210** |

**Mitigación v0.2:**
- AUDIT que registra todos los pacientes con `first_neurological_symptom_date` ausente para revisión por clinical-navigator.
- Roadmap v0.3: regla ESCALATE específica para "paciente enrolled > 7 días sin first_symptom_date" — fuerza captura del dato.

---

## Falla 8 · LLM hallucination al producir Bundle FHIR

**Descripción:** si el componente de extracción de Nauta usa un LLM para mapear input del paciente a FHIR resources, podría inventar campos o códigos no válidos.

| S | O | D | RPN |
|---|---|---|-----|
| 9 | 5 | 4 | **180** |

**Mitigación v0.2:**
- Reglas `R1888-03` (identificador del paciente con CodeSystem oficial) y `R1888-04` (terminologías aceptadas) actúan como guardrails.
- Validación contra StructureDefinition oficial antes de submission.
- Roadmap v0.3: capa de validación FHIR antes de pasar al bundle Rego, usando HL7 FHIR Validator oficial.

---

## Riesgos NO mitigados explícitamente en v0.2 (roadmap v0.3+)

1. **Concept drift en criterios Graus:** los criterios Graus 2016 son de 2016. Pueden ser actualizados (existe Graus 2024 borrador). El bundle no detecta cuando los criterios codificados están obsoletos.
2. **Calibración por subpoblación:** los umbrales son por IPS, no por subpoblación dentro de la IPS (pediátricos vs. adultos, comorbilidades específicas). v0.3 podría introducir overlays por cohorte.
3. **Pacientes con identidades duplicadas:** si un paciente aparece con dos identificadores en distintas IPS, el bundle no detecta la unicidad (responsabilidad de la capa de identidad nacional).
4. **Datos faltantes por desconexión del paciente:** si el paciente no completa el cuestionario o lo abandona, el grafo queda incompleto. Nauta no detecta este abandono.

---

## Cadencia de revisión

- **Mensual** durante los primeros 6 meses post-deploy: revisión de AUDIT logs para identificar fallas reales observadas.
- **Semestral** después: revisión completa del FMEA con incorporación de hallazgos del piloto.
- **Trigger inmediato:** cualquier evento de severidad ≥ 8 dispara revisión out-of-band.

---

**Versión documento:** 0.2.0
**Última revisión:** 2026-05-23
**Mantenedor:** Sinergia Consulting Group · Architect: Ray Miller
