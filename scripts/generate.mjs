#!/usr/bin/env node
// Generates src/generated/{types,resources}.ts from openapi/openapi.json.
//
//   node scripts/generate.mjs           regenerate from the committed snapshot
//   node scripts/generate.mjs --fetch   download the live document first
//   node scripts/generate.mjs --check   fail if the generated files are stale
//
// No dependencies: this reads the subset of JSON Schema the Ladoo document uses
// and fails loudly on anything it doesn't understand.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { operations, skipped } from "./operations.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const specPath = join(root, "openapi", "openapi.json");
const typesPath = join(root, "src", "generated", "types.ts");
const resourcesPath = join(root, "src", "generated", "resources.ts");
const SPEC_URL = "https://api.tryladoo.com/openapi.json";

const args = new Set(process.argv.slice(2));

if (args.has("--fetch")) {
  const res = await fetch(SPEC_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${SPEC_URL} answered ${res.status}`);
  const doc = await res.json();
  await writeFile(specPath, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`Saved ${SPEC_URL} (version ${doc.info?.version})`);
}

const spec = JSON.parse(await readFile(specPath, "utf8"));
const schemas = spec.components?.schemas ?? {};
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const KNOWN_KEYWORDS = new Set([
  "type",
  "$ref",
  "properties",
  "required",
  "items",
  "prefixItems",
  "enum",
  "allOf",
  "anyOf",
  "oneOf",
  "additionalProperties",
  "description",
  "title",
  "format",
  "default",
  "example",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "minItems",
  "maxItems",
  "pattern",
]);

function refName(ref) {
  const m = /^#\/components\/schemas\/(.+)$/.exec(ref);
  if (!m) throw new Error(`Unsupported $ref ${ref}`);
  if (!schemas[m[1]]) throw new Error(`Dangling $ref ${ref}`);
  return m[1];
}

function docComment(text, indent) {
  if (!text) return "";
  const lines = String(text).replaceAll("*/", "*\\/").split("\n");
  if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
  return `${indent}/**\n${lines.map((l) => `${indent} *${l ? ` ${l}` : ""}`).join("\n")}\n${indent} */\n`;
}

function schemaDoc(schema) {
  const parts = [];
  if (schema.description) parts.push(schema.description);
  if (schema.default !== undefined) parts.push(`Defaults to \`${JSON.stringify(schema.default)}\`.`);
  return parts.join("\n\n");
}

function union(parts) {
  const unique = [...new Set(parts)];
  if (unique.includes("unknown")) return "unknown";
  return unique.join(" | ");
}

function wrap(t) {
  return /[|&]/.test(t) && !/^[({[]/.test(t) ? `(${t})` : t;
}

function ts(schema, indent = "") {
  if (schema === undefined || schema === true) return "unknown";
  if (schema === false) return "never";
  for (const k of Object.keys(schema)) {
    if (!KNOWN_KEYWORDS.has(k))
      throw new Error(`Unsupported keyword "${k}" in ${JSON.stringify(schema).slice(0, 200)}`);
  }
  if (schema.$ref) return refName(schema.$ref);
  if (schema.enum) {
    return union(schema.enum.map((v) => (v === null ? "null" : JSON.stringify(v))));
  }
  if (schema.allOf) {
    // `{ allOf: [X, { type: ["object", "null"] }] }` is how the document marks a nullable $ref.
    let nullable = false;
    const members = [];
    for (const member of schema.allOf) {
      const bare =
        !member.$ref && !member.properties && !member.items && !member.allOf && !member.anyOf && !member.oneOf;
      if (bare && member.type) {
        const types = [member.type].flat();
        if (types.includes("null")) nullable = true;
        continue;
      }
      members.push(wrap(ts(member, indent)));
    }
    let out = members.length ? members.join(" & ") : "unknown";
    if (nullable) out = `${wrap(out)} | null`;
    return out;
  }
  if (schema.anyOf || schema.oneOf) {
    return union((schema.anyOf ?? schema.oneOf).map((s) => wrap(ts(s, indent))));
  }
  if (schema.type === undefined) {
    if (schema.properties) return objectType(schema, indent);
    return "unknown";
  }
  const types = [schema.type].flat();
  return union(types.map((t) => single(t, schema, indent)));
}

function single(type, schema, indent) {
  switch (type) {
    case "null":
      return "null";
    case "string":
      return schema.format === "binary" ? "Blob" : "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      if (schema.prefixItems) return `[${schema.prefixItems.map((s) => ts(s, indent)).join(", ")}]`;
      return `Array<${ts(schema.items, indent)}>`;
    case "object":
      return objectType(schema, indent);
    default:
      throw new Error(`Unsupported type ${type}`);
  }
}

function objectType(schema, indent) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const inner = `${indent}  `;
  const lines = [];
  for (const [name, prop] of Object.entries(props)) {
    const key = IDENT.test(name) ? name : JSON.stringify(name);
    lines.push(
      `${docComment(schemaDoc(prop), inner)}${inner}${key}${required.has(name) ? "" : "?"}: ${ts(prop, inner)};`,
    );
  }
  const ap = schema.additionalProperties;
  if (ap !== undefined && ap !== false) {
    const valueType = ap === true ? "unknown" : ts(ap, inner);
    if (lines.length) lines.push(`${inner}[key: string]: unknown;`);
    else lines.push(`${inner}[key: string]: ${valueType};`);
  } else if (!lines.length) {
    return "Record<string, unknown>";
  }
  return `{\n${lines.join("\n")}\n${indent}}`;
}

const camel = (s) => s.replace(/[-_]([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = (s) => camel(s).replace(/^./, (c) => c.toUpperCase());

function singular(word) {
  if (word === "people") return "person";
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

const PATH_PARAM_NAMES = {
  "/v1/integrations/calendars/{id}": "connectionId",
  "{v}": "version",
  "{a}": "fromVersion",
  "{b}": "toVersion",
};

function pathParamName(segments, index) {
  const raw = segments[index];
  const name = raw.slice(1, -1);
  const prefix = segments.slice(0, index + 1).join("/");
  if (PATH_PARAM_NAMES[prefix]) return PATH_PARAM_NAMES[prefix];
  if (PATH_PARAM_NAMES[raw]) return PATH_PARAM_NAMES[raw];
  if (name === "id") return `${camel(singular(segments[index - 1]))}Id`;
  return camel(name);
}

function jsonSchemaOf(content) {
  return content?.["application/json"]?.schema;
}

const known = new Map();
const unmapped = [];
for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of HTTP_METHODS) {
    const op = item[method];
    if (!op) continue;
    const key = `${method.toUpperCase()} ${path}`;
    const apiKey = (op.security ?? spec.security ?? []).some((req) => "ApiKey" in req);
    known.set(key, { path, method, op, apiKey });
    if (path.startsWith("/v1/") && apiKey && !operations[key]) unmapped.push(key);
  }
}
const stale = [...Object.keys(operations), ...Object.keys(skipped)].filter((k) => !known.has(k));
const notApiKey = Object.keys(operations).filter((k) => known.has(k) && !known.get(k).apiKey);
if (unmapped.length || stale.length || notApiKey.length) {
  if (unmapped.length) console.error(`Operations missing from scripts/operations.mjs:\n  ${unmapped.join("\n  ")}`);
  if (stale.length) console.error(`Operations no longer in the document:\n  ${stale.join("\n  ")}`);
  if (notApiKey.length) console.error(`Operations that don't accept an API key:\n  ${notApiKey.join("\n  ")}`);
  process.exit(1);
}

const typeDecls = [];
const declared = new Set(Object.keys(schemas));
function declare(name, schema, doc) {
  if (declared.has(name)) throw new Error(`Type name ${name} is used twice`);
  declared.add(name);
  typeDecls.push(`${docComment(doc, "")}export type ${name} = ${ts(schema)};\n`);
  return name;
}

const tree = { methods: [], children: new Map() };

for (const [key, target] of Object.entries(operations)) {
  const { path, method, op } = known.get(key);
  const segs = target.split(".");
  const name = segs.pop();
  const typePrefix = segs.map((s) => pascal(singular(s))).join("") + pascal(name);

  const segments = path.split("/");
  const pathParams = [];
  segments.forEach((seg, i) => {
    if (seg.startsWith("{")) {
      const param = (op.parameters ?? []).find((p) => p.in === "path" && p.name === seg.slice(1, -1));
      if (!param) throw new Error(`${key}: path parameter ${seg} isn't declared`);
      let type = "string";
      if (param.schema?.enum) type = ts(param.schema);
      else if (["integer", "number"].includes(param.schema?.type)) type = "number";
      pathParams.push({ raw: seg.slice(1, -1), name: pathParamName(segments, i), type });
    }
  });

  const queryParams = (op.parameters ?? []).filter((p) => p.in === "query");
  for (const p of op.parameters ?? []) {
    if (!["query", "path"].includes(p.in)) throw new Error(`${key}: unsupported parameter in ${p.in}`);
  }

  let paramsType = null;
  let paramsRequired = false;
  let bodyKind = null;
  if (queryParams.length && op.requestBody) throw new Error(`${key}: both query and body`);
  if (queryParams.length) {
    const schema = {
      type: "object",
      properties: Object.fromEntries(
        queryParams.map((p) => [p.name, { ...p.schema, description: p.description ?? p.schema?.description }]),
      ),
      required: queryParams.filter((p) => p.required).map((p) => p.name),
    };
    paramsType = declare(`${typePrefix}Params`, schema, `Query parameters for \`${key}\`.`);
    paramsRequired = schema.required.length > 0;
  } else if (op.requestBody) {
    const content = op.requestBody.content;
    bodyKind = content["application/json"] ? "json" : content["multipart/form-data"] ? "multipart" : null;
    if (!bodyKind) throw new Error(`${key}: unsupported request body ${Object.keys(content)}`);
    const schema = content[bodyKind === "json" ? "application/json" : "multipart/form-data"].schema;
    paramsType = schema.$ref
      ? refName(schema.$ref)
      : declare(`${typePrefix}Params`, schema, `Request body for \`${key}\`.`);
    const resolved = schema.$ref ? schemas[refName(schema.$ref)] : schema;
    paramsRequired = op.requestBody.required !== false && (resolved.required ?? []).length > 0;
  }

  // Response: union of the 2xx JSON bodies, or void / ArrayBuffer.
  const ok = Object.entries(op.responses).filter(([code]) => /^2/.test(code));
  let responseType = "void";
  let responseKind = "json";
  let inlineResponse = null;
  const jsonSchemas = ok.map(([, r]) => jsonSchemaOf(r.content)).filter(Boolean);
  const otherContent = ok.flatMap(([, r]) => Object.keys(r.content ?? {})).filter((c) => c !== "application/json");
  if (jsonSchemas.length) {
    const names = [...new Set(jsonSchemas.map((s) => (s.$ref ? refName(s.$ref) : JSON.stringify(s))))];
    if (names.length > 1) throw new Error(`${key}: several different 2xx bodies`);
    const s = jsonSchemas[0];
    responseType = s.$ref ? refName(s.$ref) : null;
    inlineResponse = s.$ref ? null : s;
  } else if (otherContent.length) {
    responseKind = "binary";
    responseType = "ArrayBuffer";
  } else {
    responseKind = "empty";
  }

  // Cursor pagination: a `cursor` query parameter and a `{ data, next_cursor }` body.
  let paginated = null;
  const listSchema = inlineResponse;
  if (
    queryParams.some((p) => p.name === "cursor") &&
    listSchema?.properties?.data?.type === "array" &&
    listSchema.properties.next_cursor
  ) {
    paginated = ts(listSchema.properties.data.items);
  }
  if (inlineResponse) {
    responseType = declare(`${typePrefix}Response`, inlineResponse, `Response body of \`${key}\`.`);
  }

  let node = tree;
  for (const seg of segs) {
    if (!node.children.has(seg)) node.children.set(seg, { methods: [], children: new Map() });
    node = node.children.get(seg);
  }
  node.methods.push({
    key,
    name,
    path,
    method,
    op,
    pathParams,
    paramsType,
    paramsRequired,
    queryParams: queryParams.length > 0,
    bodyKind,
    responseType,
    responseKind,
    paginated,
  });
}

const header = `// Generated by scripts/generate.mjs from the Ladoo OpenAPI document (version ${spec.info.version}).
// Do not edit by hand: run \`npm run generate\`.
`;

const componentDecls = Object.entries(schemas).map(
  ([name, schema]) => `${docComment(schemaDoc(schema), "")}export type ${name} = ${ts(schema)};\n`,
);

const typesSource = `${header}
/** The API version these types were generated from. */
export const API_VERSION = ${JSON.stringify(spec.info.version)};

${componentDecls.join("\n")}
${typeDecls.join("\n")}`;

const usedTypes = new Set();
const classes = [];

// Suffixed so a namespace never collides with a schema of the same name (Billing, Workspace...).
function className(segs) {
  return `${segs.map((s) => pascal(s)).join("")}Resource`;
}

function methodSource(m) {
  const args = [];
  for (const p of m.pathParams) args.push(`${p.name}: ${p.type}`);
  if (m.paramsType) {
    usedTypes.add(m.paramsType);
    args.push(`params${m.paramsRequired ? "" : "?"}: ${m.paramsType}`);
  }
  args.push("options?: RequestOptions");

  const pathExpr = `\`${m.path.replace(/\{([^}]+)\}/g, (_, raw) => `\${encodePath(${m.pathParams.find((p) => p.raw === raw).name})}`)}\``;
  const docs = [m.op.summary, m.op.description, `\`${m.key}\``].filter(Boolean).join("\n\n");

  let returnType;
  let body;
  const req = [`method: "${m.method.toUpperCase()}"`, `path: ${pathExpr}`];
  if (m.queryParams) req.push("query: params");
  if (m.bodyKind === "json") req.push(m.paramsRequired ? "body: params" : "body: params ?? {}");
  if (m.bodyKind === "multipart") req.push("multipart: params");
  if (m.responseKind === "binary") req.push(`responseType: "arrayBuffer"`);
  if (m.responseKind === "empty") req.push(`responseType: "empty"`);
  req.push("options");

  if (m.paginated) {
    usedTypes.add(m.paginated);
    returnType = `PagePromise<${m.paginated}>`;
    body = `return this._client.requestPage<${m.paginated}>({ ${req.join(", ")} });`;
  } else {
    if (m.responseType !== "void" && m.responseType !== "ArrayBuffer") usedTypes.add(m.responseType);
    returnType = `Promise<${m.responseType}>`;
    body = `return this._client.request<${m.responseType}>({ ${req.join(", ")} });`;
  }
  return `${docComment(docs, "  ")}  ${m.name}(${args.join(", ")}): ${returnType} {\n    ${body}\n  }`;
}

function emitClass(segs, node) {
  const name = className(segs);
  const members = [];
  for (const [child, childNode] of node.children) {
    const childName = emitClass([...segs, child], childNode);
    members.push(`  readonly ${child}: ${childName} = new ${childName}(this._client);`);
  }
  for (const m of node.methods) members.push(methodSource(m));
  classes.push(`export class ${name} extends APIResource {\n${members.join("\n\n")}\n}\n`);
  return name;
}

const top = [];
for (const [seg, node] of tree.children) top.push([seg, emitClass([seg], node)]);

const resourcesSource = `${header}
import { APIResource, encodePath, type PagePromise, type Requester, type RequestOptions, type RequestSpec } from "../core.js";
import type {
${[...usedTypes]
  .sort()
  .map((t) => `  ${t},`)
  .join("\n")}
} from "./types.js";

${classes.join("\n")}
/** @internal Mounts every top-level namespace on the client. */
export abstract class LadooResources implements Requester {
  abstract request<T>(spec: RequestSpec): Promise<T>;
  abstract requestPage<T>(spec: RequestSpec): PagePromise<T>;

${top.map(([seg, cls]) => `  readonly ${seg}: ${cls} = new ${cls}(this);`).join("\n")}
}
`;

if (args.has("--check")) {
  const [curTypes, curResources] = await Promise.all([
    readFile(typesPath, "utf8").catch(() => ""),
    readFile(resourcesPath, "utf8").catch(() => ""),
  ]);
  if (curTypes !== typesSource || curResources !== resourcesSource) {
    console.error("src/generated is out of date. Run `npm run generate:offline` and commit the result.");
    process.exit(1);
  }
  console.log("src/generated is up to date.");
} else {
  await writeFile(typesPath, typesSource);
  await writeFile(resourcesPath, resourcesSource);
  const count = Object.keys(operations).length;
  console.log(`Generated ${Object.keys(schemas).length} schemas and ${count} operations (API ${spec.info.version}).`);
}
