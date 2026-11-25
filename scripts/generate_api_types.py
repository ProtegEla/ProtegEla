import json
import sys
from pathlib import Path

source = Path(sys.argv[1])
target = Path(sys.argv[2])

document = json.loads(source.read_text(encoding="utf-8-sig"))
schemas = document["components"]["schemas"]


def literal(value):
    return json.dumps(value, ensure_ascii=False)


def typescript(schema):
    if "$ref" in schema:
        name = schema["$ref"].split("/")[-1]
        return f"Schemas[{literal(name)}]"

    if "const" in schema:
        return literal(schema["const"])

    if "enum" in schema:
        return " | ".join(literal(value) for value in schema["enum"])

    for keyword, separator in [
        ("anyOf", " | "),
        ("oneOf", " | "),
        ("allOf", " & "),
    ]:
        if keyword in schema:
            return "(" + separator.join(
                typescript(item) for item in schema[keyword]
            ) + ")"

    kind = schema.get("type")

    if isinstance(kind, list):
        return "(" + " | ".join(
            typescript({**schema, "type": item}) for item in kind
        ) + ")"

    if kind == "array":
        if "prefixItems" in schema:
            return "[" + ", ".join(
                typescript(item) for item in schema["prefixItems"]
            ) + "]"

        return f"Array<{typescript(schema.get('items', {}))}>"

    if kind == "object" or "properties" in schema:
        required = set(schema.get("required", []))

        fields = [
            literal(name)
            + ("" if name in required else "?")
            + ": "
            + typescript(value)
            + ";"
            for name, value in schema.get("properties", {}).items()
        ]

        extra = schema.get("additionalProperties")

        if isinstance(extra, dict) and not fields:
            return f"Record<string, {typescript(extra)}>"

        return "{ " + " ".join(fields) + " }" if fields else "Record<string, never>"

    return {
        "string": "string",
        "number": "number",
        "integer": "number",
        "boolean": "boolean",
        "null": "null",
    }.get(kind, "unknown")


lines = [
    "// Gerado do OpenAPI. Não valida respostas em runtime.",
    "export interface Schemas {",
]

lines += [
    f"  {literal(name)}: {typescript(schema)};"
    for name, schema in schemas.items()
]

lines += [
    "}",
    "export interface components { schemas: Schemas; }",
]

target.parent.mkdir(parents=True, exist_ok=True)
target.write_text("\n".join(lines), encoding="utf-8")