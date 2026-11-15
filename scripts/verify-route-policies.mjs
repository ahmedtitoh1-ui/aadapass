import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE = process.cwd();
const API_DIR = path.join(WORKSPACE, 'app', 'api');
const POLICIES_FILE = path.join(WORKSPACE, 'lib', 'server', 'routePolicies.ts');

const PROTECTED_PATH_PREFIXES = [
  '/api/admin/',
  '/api/merchant/',
  '/api/customer/',
  '/api/transactions',
  '/api/me',
  '/api/auth/logout-all',
];

function walkRouteFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkRouteFiles(full));
    } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
      results.push(full);
    }
  }
  return results;
}

function extractDefinedPolicyKeys(policiesSource) {
  const map = new Map();
  const entryRegex = /'([a-zA-Z0-9_.]+)'\s*:\s*\{([\s\S]*?)\n\s*\}/g;
  let match;
  while ((match = entryRegex.exec(policiesSource)) !== null) {
    const key = match[1];
    const body = match[2];
    const pathMatch = /pathPattern\s*:\s*'([^']+)'/.exec(body);
    const rolesMatch = /allowedRoles\s*:\s*('PUBLIC'|'AUTHENTICATED'|\[[^\]]+\])/.exec(body);
    map.set(key, {
      pathPattern: pathMatch ? pathMatch[1] : '',
      allowedRoles: rolesMatch ? rolesMatch[1] : '',
    });
  }
  return map;
}

function verifyRoutes() {
  const policiesSource = fs.readFileSync(POLICIES_FILE, 'utf8');
  const definedPolicies = extractDefinedPolicyKeys(policiesSource);
  const routeFiles = walkRouteFiles(API_DIR);

  if (routeFiles.length === 0) {
    console.error('FAIL: No API route files found under app/api.');
    process.exit(1);
  }

  let failures = 0;
  let checkedHandlers = 0;

  for (const file of routeFiles) {
    const rel = path.relative(WORKSPACE, file).replace(/\\/g, '/');
    const apiPath = '/' + rel.replace(/^app\//, '').replace(/\/route\.tsx?$/, '');
    const src = fs.readFileSync(file, 'utf8');

    const exportedMethods = [];
    const methodRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/g;
    let m;
    while ((m = methodRegex.exec(src)) !== null) {
      exportedMethods.push({ method: m[1], index: m.index });
    }

    if (exportedMethods.length === 0) {
      console.error(`FAIL [${rel}]: No HTTP handler exported.`);
      failures += 1;
      continue;
    }

    for (let i = 0; i < exportedMethods.length; i += 1) {
      const current = exportedMethods[i];
      const nextIndex = i + 1 < exportedMethods.length ? exportedMethods[i + 1].index : src.length;
      const bodySlice = src.slice(current.index, nextIndex);
      checkedHandlers += 1;

      const enforceMatch = /enforcePolicy\s*\(\s*[a-zA-Z0-9_]+\s*,\s*'([a-zA-Z0-9_.]+)'/.exec(bodySlice);
      if (!enforceMatch) {
        console.error(`FAIL [${rel} -> ${current.method}]: Missing enforcePolicy(req, '<policyKey>') call!`);
        failures += 1;
        continue;
      }

      const policyKey = enforceMatch[1];
      if (!definedPolicies.has(policyKey)) {
        console.error(`FAIL [${rel} -> ${current.method}]: Policy key '${policyKey}' is not registered in routePolicies.ts!`);
        failures += 1;
        continue;
      }

      const meta = definedPolicies.get(policyKey);
      const isProtectedPath = PROTECTED_PATH_PREFIXES.some((prefix) => apiPath.startsWith(prefix));
      if (isProtectedPath && meta.allowedRoles === "'PUBLIC'") {
        console.error(`FAIL [${rel} -> ${current.method}]: Protected route '${apiPath}' must NOT use 'PUBLIC' policy '${policyKey}'!`);
        failures += 1;
        continue;
      }

      console.log(`PASS [${current.method} ${apiPath}] -> policy '${policyKey}' (${meta.allowedRoles})`);
    }
  }

  // Verify required security primitives exist
  const rlsSrc = fs.readFileSync(path.join(WORKSPACE, 'lib', 'server', 'rls.ts'), 'utf8');
  const policySrc = fs.readFileSync(path.join(WORKSPACE, 'lib', 'server', 'policy.ts'), 'utf8');
  const requiredSymbols = [
    [policySrc, 'export function requireRole('],
    [policySrc, 'export function requireScope('],
    [policySrc, 'export function enforcePolicy('],
    [policySrc, 'user.tokenVersion !== payload.tv'],
    [rlsSrc, 'export function rlsCanAccessMerchant('],
    [rlsSrc, 'export function rlsFilterTransactions('],
  ];

  for (const [sourceText, symbol] of requiredSymbols) {
    if (!sourceText.includes(symbol)) {
      console.error(`FAIL: Required security enforcement primitive missing: ${symbol}`);
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(`\nRoute policy verification FAILED with ${failures} error(s).`);
    process.exit(1);
  }

  console.log(`\nALL ${checkedHandlers} HTTP API handlers verified with explicit server policies & tenant isolation.`);
}

verifyRoutes();
