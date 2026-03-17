const fs = require("fs");
const path = require("path");

let cachedPersona = null;

function getPersonaDocument() {
  if (cachedPersona) return cachedPersona;

  const personaPath = path.resolve(__dirname, "../../../../doc-ia/persona-ia-edevida.md");
  const raw = fs.readFileSync(personaPath, "utf-8");
  cachedPersona = raw;
  return cachedPersona;
}

module.exports = {
  getPersonaDocument,
};
