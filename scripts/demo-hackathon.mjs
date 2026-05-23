import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { createHash } from 'node:crypto';
import { startEvaluateServer } from '../runtime/atk/server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathdirname(__filename);
function pathdirname(p) {
  return dirname(p);
}

const root = resolve(__dirname, '..');
const fixtureDir = join(root, 'fixtures', 'evaluate');

// Encontrar OPA de forma robusta en Windows y Linux
function findOpa() {
  const candidates = [
    process.env.OPA_BIN,
    'opa',
    process.platform === 'win32' ? join(process.env.TEMP || '.', 'opa_windows_amd64.exe') : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // Continuar buscando
    }
  }
  throw new Error('No se encontró el binario de OPA. Ejecuta scripts/validate.ps1 primero.');
}

// Colores ANSI para terminal
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const gray = '\x1b[90m';
const magenta = '\x1b[35m';

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

// Configuración de Readline interactivo
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => new Promise((resolveAsk) => rl.question(query, resolveAsk));

// Casos de uso de demostración
const scenarios = [
  {
    id: '1',
    name: 'Envío de RDA Válido (PERMIT)',
    file: 'valid-rda-submission.json',
    description: 'Flujo exitoso donde el paciente otorga consentimiento global, el canal TLS es seguro y los hashes de integridad coinciden plenamente.',
  },
  {
    id: '2',
    name: 'Bloqueo Crítico SaMD (DENY por falta de calibración)',
    file: 'uncalibrated-critical-divergence.json',
    description: 'Intento de envío clínico con divergencia crítica y desviación de dispositivo médico (SaMD) no calibrado. Falla cerrado para salvaguardar la autonomía del paciente.',
  },
  {
    id: '3',
    name: 'Revocación Granular - Habeas Data (SUSPEND)',
    file: 'revoked-consent.json',
    description: 'El paciente ha ejercido su derecho de Habeas Data revocando el consentimiento para el tratamiento. Nauta suspende inmediatamente la acción para revisión legal.',
  },
  {
    id: '4',
    name: 'Inseguridad de Canal de Red (DENY por canal vulnerable)',
    file: 'invalid-transport-denied.json',
    description: 'Simulación de petición utilizando TLS 1.0 (vulnerable). Nauta detecta la vulnerabilidad y rechaza la atestación por riesgos de interceptación en tránsito.',
  }
];

async function showHeader() {
  clearScreen();
  console.log(`${cyan}${bold}========================================================================${reset}`);
  console.log(`${cyan}${bold}                 ARHIAX NAUTA - DEMOSTRACIÓN TÉCNICA                    ${reset}`);
  console.log(`${cyan}             Plataforma de Mediación de Datos Clínicos                  ${reset}`);
  console.log(`${cyan}${bold}========================================================================${reset}`);
  console.log(`${gray}  Servidor de Evaluación REST activo en tiempo real: ${green}http://localhost:<puerto>${reset}`);
  console.log(`${gray}  Políticas de OPA: Firmadas digitalmente (${green}development-public.pem${gray})${reset}`);
  console.log(`${cyan}${bold}------------------------------------------------------------------------${reset}\n`);
}

async function runDemo() {
  let opaBin;
  try {
    opaBin = findOpa();
  } catch (error) {
    console.error(`${red}${bold}[ERROR] ${error.message}${reset}`);
    process.exit(1);
  }

  // Inicializar servidor de evaluación en puerto dinámico
  const { server, port } = await startEvaluateServer(0, { opaBin });
  
  while (true) {
    await showHeader();
    console.log(`Selecciona un escenario interactivo para evaluar:\n`);
    
    for (const sc of scenarios) {
      console.log(`  ${bold}${cyan}${sc.id}.${reset} ${bold}${sc.name}${reset}`);
      console.log(`     ${gray}${sc.description}${reset}\n`);
    }
    
    console.log(`  ${bold}${magenta}Q. Salir de la Demo${reset}\n`);
    
    const choice = (await askQuestion(`${bold}Selección > ${reset}`)).trim().toLowerCase();
    
    if (choice === 'q') {
      console.log(`\n${cyan}Apagando servidor de evaluación de forma segura...${reset}`);
      server.close();
      rl.close();
      console.log(`${green}¡Gracias por utilizar la Demo de ARHIAX Nauta!${reset}\n`);
      break;
    }
    
    const scenario = scenarios.find(s => s.id === choice);
    if (!scenario) {
      console.log(`\n${red}Opción inválida. Presiona ENTER para reintentar...${reset}`);
      await askQuestion('');
      continue;
    }

    // Cargar el fixture JSON
    const filePath = join(fixtureDir, scenario.file);
    let fixtureData;
    try {
      fixtureData = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`${red}Error al leer el archivo del fixture: ${e.message}${reset}`);
      await askQuestion('\nPresiona ENTER para continuar...');
      continue;
    }

    clearScreen();
    console.log(`${cyan}${bold}========================================================================${reset}`);
    console.log(`${cyan}${bold} ESCENARIO: ${scenario.name}${reset}`);
    console.log(`${cyan}${bold}========================================================================${reset}\n`);
    
    console.log(`${bold}1. Inspección del Payload entrante (Simplificado):${reset}`);
    console.log(`${gray}------------------------------------------------------------------------${reset}`);
    console.log(`  Categoría de Acción : ${green}${fixtureData.input.action_category}${reset}`);
    console.log(`  ID de Acción        : ${fixtureData.input.action_id}`);
    console.log(`  Institución Emisora : ${fixtureData.input.requester?.institution_id || 'N/A'}`);
    console.log(`  Rol del Solicitante : ${fixtureData.input.requester?.institution_type || 'N/A'}`);
    console.log(`  Transporte Seguro   : TLS ${fixtureData.input.transport?.tls_version || 'N/A'}`);
    if (fixtureData.input.divergence_severity) {
      console.log(`  Gravedad Desviación : ${yellow}${fixtureData.input.divergence_severity}${reset}`);
    }
    console.log(`${gray}------------------------------------------------------------------------${reset}\n`);

    console.log(`${bold}2. Ejecución del Ciclo de Vida de Atestación de Nauta:${reset}`);
    
    await delay(600);
    const hashIdempotency = createHash('md5').update(scenario.file).digest('hex');
    console.log(`  ${cyan}[1/3] Atestando acción en el Ledger criptográfico HMAC...${reset}`);
    
    await delay(800);
    console.log(`  ${cyan}[2/3] Validando integridad estructural de la Submission...${reset}`);
    
    await delay(800);
    console.log(`  ${cyan}[3/3] Consultando OPA Engine (Políticas Rego con Firma Digital)...${reset}`);

    // Realizar la consulta REST real al servidor corriendo localmente
    let response;
    try {
      const res = await fetch(`http://localhost:${port}/v1/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Arhiax-Idempotency-Key': hashIdempotency,
          'X-Arhiax-Institution-Id': fixtureData.input.requester?.institution_id || 'hosp-bogota-01'
        },
        body: JSON.stringify(fixtureData.input)
      });
      response = await res.json();
    } catch (err) {
      console.error(`\n${red}[ERROR DE COMUNICACIÓN]: No se pudo conectar al runtime real: ${err.message}${reset}`);
      await askQuestion('\nPresiona ENTER para continuar...');
      continue;
    }

    await delay(400);
    console.log(`\n${bold}3. Veredicto del Clinical Navigator de Nauta:${reset}`);
    console.log(`${gray}------------------------------------------------------------------------${reset}`);
    
    let outcomeColor = green;
    if (response.outcome === 'DENY') outcomeColor = red;
    if (response.outcome === 'SUSPEND' || response.outcome === 'AUDIT' || response.outcome === 'ESCALATE') outcomeColor = yellow;

    console.log(`  DECISIÓN FINAL     : ${outcomeColor}${bold}${response.outcome}${reset}`);
    console.log(`  ID Evaluación (v7) : ${gray}${response.evaluation_id}${reset}`);
    console.log(`  Latencia Real      : ${green}${response.latency_ms} ms${reset}`);
    console.log(`  Versión Bundle     : ${response.policy_bundle_version}`);
    
    if (response.reasons && response.reasons.length > 0) {
      console.log(`\n  Justificaciones del Motor de Reglas (Rego):`);
      for (const reason of response.reasons) {
        console.log(`    ${red}• [${reason.source}] ${reason.message}${reset}`);
      }
    } else {
      console.log(`\n  ${green}✓ Aprobado conforme a todos los marcos regulatorios (Ley 1751, Res 1888/2025, Ley 1581).${reset}`);
    }

    if (response.effects && Object.keys(response.effects).length > 0) {
      console.log(`\n  Efectos de Auditoría y Flujo:`);
      if (response.effects.audit && response.effects.audit.length > 0) {
        for (const ad of response.effects.audit) {
          console.log(`    ${yellow}⚠ [AUDITAR] ${ad.message}${reset}`);
        }
      }
      if (response.effects.modify && response.effects.modify.length > 0) {
        for (const mod of response.effects.modify) {
          console.log(`    ${cyan}⚙ [MODIFICAR] ${mod.message}${reset}`);
        }
      }
    }
    
    console.log(`${gray}------------------------------------------------------------------------${reset}\n`);
    
    await askQuestion(`${bold}Presiona ENTER para volver al menú de escenarios...${reset}`);
  }
}

// Iniciar
runDemo().catch(console.error);
