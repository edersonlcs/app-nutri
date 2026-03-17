const LEVEL_INFO = {
  emergencia: { label: "Emergencia", score: 10, severity: 4 },
  ruim: { label: "Ruim", score: 30, severity: 3 },
  ainda_da_para_melhorar: { label: "Ainda da para melhorar", score: 55, severity: 2 },
  bom: { label: "Bom", score: 75, severity: 1 },
  otimo: { label: "Otimo", score: 92, severity: 0 },
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parsePtNumber(raw) {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return null;

  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  let normalized = cleaned;
  if (hasDot && hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else if (!hasDot && hasComma) {
    normalized = cleaned.replace(/,/g, ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReferenceRange(referenceRange) {
  const raw = String(referenceRange || "");
  if (!raw) return null;

  const normalized = normalizeText(raw);
  const matches = raw.match(/-?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|-?\d+(?:\.\d+)?/g) || [];
  const values = matches.map((item) => parsePtNumber(item)).filter((item) => item !== null);

  if (!values.length) return null;

  if (normalized.includes("maior que") || normalized.includes("acima de") || normalized.includes(">")) {
    return { min: values[0], max: null };
  }

  if (normalized.includes("menor que") || normalized.includes("abaixo de") || normalized.includes("<")) {
    return { min: null, max: values[0] };
  }

  if (values.length >= 2) {
    return { min: Math.min(values[0], values[1]), max: Math.max(values[0], values[1]) };
  }

  return { min: null, max: null };
}

function deriveFlagFromMarkerPayload(payload = {}) {
  const rawFlag = normalizeText(payload.flag);
  if (rawFlag === "high" || rawFlag === "alto") return "high";
  if (rawFlag === "low" || rawFlag === "baixo") return "low";
  if (rawFlag === "normal" || rawFlag === "ok") return "normal";

  const value = toNumber(payload.value);
  if (value === null) return "unknown";

  const range = parseReferenceRange(payload.reference_range);
  if (!range) return "unknown";

  if (range.min !== null && value < range.min) return "low";
  if (range.max !== null && value > range.max) return "high";
  if (range.min !== null || range.max !== null) return "normal";
  return "unknown";
}

function deviationRatioFromRange(payload = {}) {
  const value = toNumber(payload.value);
  if (value === null) return null;

  const range = parseReferenceRange(payload.reference_range);
  if (!range) return null;

  if (range.max !== null && value > range.max && range.max > 0) {
    return (value - range.max) / range.max;
  }
  if (range.min !== null && value < range.min && range.min > 0) {
    return (range.min - value) / range.min;
  }
  return 0;
}

function findMarkerByAliases(markers, aliases) {
  const entries = Object.entries(markers || {});
  for (const [name, payload] of entries) {
    const normalized = normalizeText(name);
    const tokens = normalized.replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);

    const matched = aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      if (normalizedAlias.length <= 3) {
        return tokens.includes(normalizedAlias);
      }
      return normalized.includes(normalizedAlias);
    });

    if (matched) {
      return { name, payload };
    }
  }
  return null;
}

function calculateSystemLevel(foundMarkers) {
  if (!foundMarkers.length) {
    return "ainda_da_para_melhorar";
  }

  let abnormalCount = 0;
  let maxDeviation = 0;

  for (const marker of foundMarkers) {
    if (marker.flag === "high" || marker.flag === "low") {
      abnormalCount += 1;
      const deviation = marker.deviationRatio;
      if (typeof deviation === "number") {
        maxDeviation = Math.max(maxDeviation, deviation);
      }
    }
  }

  if (abnormalCount === 0) {
    return foundMarkers.length >= 2 ? "otimo" : "bom";
  }

  if (abnormalCount >= 3 || maxDeviation >= 0.45) {
    return "emergencia";
  }

  if (abnormalCount >= 2 || maxDeviation >= 0.25) {
    return "ruim";
  }

  if (abnormalCount >= 1) {
    return "ainda_da_para_melhorar";
  }

  return "bom";
}

function markerShortText(marker) {
  const value = marker.payload?.value ?? "n/d";
  const unit = marker.payload?.unit ? ` ${marker.payload.unit}` : "";
  const flagText = marker.flag === "high" ? "alto" : marker.flag === "low" ? "baixo" : "ok";
  return `${marker.name}: ${value}${unit} (${flagText})`;
}

function buildSystemInsight({ id, title, markers, aliasesByMarker, impactText }) {
  const foundMarkers = aliasesByMarker
    .map((markerDef) => {
      const found = findMarkerByAliases(markers, markerDef.aliases);
      if (!found) return null;
      return {
        markerKey: markerDef.key,
        name: found.name,
        payload: found.payload,
        flag: deriveFlagFromMarkerPayload(found.payload),
        deviationRatio: deviationRatioFromRange(found.payload),
      };
    })
    .filter(Boolean);

  const level = calculateSystemLevel(foundMarkers);
  const info = LEVEL_INFO[level];
  const markerPreview = foundMarkers.slice(0, 3).map(markerShortText).join(" | ");

  const hasAbnormal = foundMarkers.some((item) => item.flag === "high" || item.flag === "low");
  let reason = "Sem dados suficientes para analise completa.";
  if (foundMarkers.length) {
    reason = hasAbnormal
      ? `Marcadores com alteracao: ${markerPreview || "ver detalhes nos exames"}.`
      : `Marcadores dentro da referencia recente: ${markerPreview || "ok"}.`;
  }

  return {
    id,
    title,
    level,
    label: info.label,
    score: info.score,
    ideal: "Manter marcadores dentro da faixa de referencia",
    current: markerPreview || "Sem dados recentes",
    reason,
    impact: impactText,
    has_data: foundMarkers.length > 0,
    markers: foundMarkers.map((item) => ({
      name: item.name,
      flag: item.flag,
      value: item.payload?.value ?? null,
      unit: item.payload?.unit || null,
      reference_range: item.payload?.reference_range || null,
    })),
  };
}

function buildBodyFatInsight({ profile, latestBio }) {
  const fat = toNumber(latestBio?.body_fat_pct);
  const sex = normalizeText(profile?.biological_sex);

  const idealBySex = {
    male: { min: 10, max: 20, target: 15 },
    female: { min: 18, max: 28, target: 23 },
  };

  const ideal = idealBySex[sex] || { min: 15, max: 25, target: 20 };

  if (fat === null) {
    return {
      id: "bio_fat",
      title: "Bio gordura corporal",
      level: "ainda_da_para_melhorar",
      label: LEVEL_INFO.ainda_da_para_melhorar.label,
      score: LEVEL_INFO.ainda_da_para_melhorar.score,
      ideal: `${ideal.target}% (faixa ${ideal.min}-${ideal.max}%)`,
      current: "Sem bioimpedancia recente",
      reason: "Sem dado suficiente para classificar gordura corporal.",
      impact: "Sem esse dado, fica mais dificil ajustar dieta e treino de forma precisa.",
      has_data: false,
      markers: [],
    };
  }

  let level = "otimo";
  if (fat > ideal.max + 20) level = "emergencia";
  else if (fat > ideal.max + 10) level = "ruim";
  else if (fat > ideal.max + 4) level = "ainda_da_para_melhorar";
  else if (fat > ideal.max) level = "bom";
  else if (fat < ideal.min - 5) level = "ruim";
  else if (fat < ideal.min) level = "ainda_da_para_melhorar";

  const info = LEVEL_INFO[level];
  const delta = (fat - ideal.target).toFixed(1);

  return {
    id: "bio_fat",
    title: "Bio gordura corporal",
    level,
    label: info.label,
    score: info.score,
    ideal: `${ideal.target}% (faixa ${ideal.min}-${ideal.max}%)`,
    current: `${fat.toFixed(1)}%`,
    reason: `Diferenca para alvo: ${delta > 0 ? "+" : ""}${delta} ponto(s) percentuais.`,
    impact:
      level === "otimo" || level === "bom"
        ? "Composicao corporal em faixa aceitavel para evoluir com consistencia."
        : "Fora da faixa ideal pode elevar risco metabolico e desacelerar resultados.",
    has_data: true,
    markers: [
      {
        name: "gordura_corporal_pct",
        flag: level === "otimo" || level === "bom" ? "normal" : "high",
        value: fat,
        unit: "%",
        reference_range: `${ideal.min}-${ideal.max}%`,
      },
    ],
  };
}

function computeOverall(insights) {
  if (!insights.length) {
    return {
      score: LEVEL_INFO.ainda_da_para_melhorar.score,
      level: "ainda_da_para_melhorar",
      label: LEVEL_INFO.ainda_da_para_melhorar.label,
    };
  }

  const average = insights.reduce((acc, item) => acc + Number(item.score || 0), 0) / insights.length;
  const rounded = Math.round(average);

  let level = "emergencia";
  if (rounded >= 85) level = "otimo";
  else if (rounded >= 70) level = "bom";
  else if (rounded >= 50) level = "ainda_da_para_melhorar";
  else if (rounded >= 25) level = "ruim";

  return {
    score: rounded,
    level,
    label: LEVEL_INFO[level].label,
  };
}

function buildClinicalOverview({ profile, latestBio, latestExam }) {
  const markers = latestExam?.markers || {};

  const insights = [
    buildBodyFatInsight({ profile, latestBio }),
    buildSystemInsight({
      id: "liver",
      title: "Figado",
      markers,
      aliasesByMarker: [
        { key: "tgp_alt", aliases: ["tgp", "alt", "alanina aminotransferase"] },
        { key: "tgo_ast", aliases: ["tgo", "ast", "aspartato aminotransferase"] },
        { key: "ggt", aliases: ["ggt", "gama gt", "gama glutamil"] },
      ],
      impactText: "Alteracoes aqui podem indicar sobrecarga hepatica e pior resposta metabolica.",
    }),
    buildSystemInsight({
      id: "kidney",
      title: "Rins",
      markers,
      aliasesByMarker: [
        { key: "creatinina", aliases: ["creatinina"] },
        { key: "ureia", aliases: ["ureia", "urea"] },
        { key: "acido_urico", aliases: ["acido urico", "urico"] },
      ],
      impactText: "Alteracoes renais podem comprometer filtragem, hidratacao e ajuste nutricional.",
    }),
    buildSystemInsight({
      id: "cholesterol",
      title: "Colesterol e triglicerides",
      markers,
      aliasesByMarker: [
        { key: "col_total", aliases: ["colesterol total"] },
        { key: "ldl", aliases: ["ldl"] },
        { key: "hdl", aliases: ["hdl"] },
        { key: "triglicerides", aliases: ["triglicerides", "triglicerideos"] },
      ],
      impactText: "Descontrole lipidico aumenta risco cardiovascular e inflamação cronica.",
    }),
    buildSystemInsight({
      id: "glucose",
      title: "Diabetes e glicose",
      markers,
      aliasesByMarker: [
        { key: "glicose_jejum", aliases: ["glicose de jejum", "glicemia de jejum", "glicose jejum"] },
        { key: "hba1c", aliases: ["hemoglobina glicada", "hba1c"] },
        { key: "glicemia_media", aliases: ["glicemia estimada media"] },
      ],
      impactText: "Alteracoes glicemicas aumentam risco de diabetes e dificultam perda de gordura.",
    }),
  ];

  const overall = computeOverall(insights);
  const topRisks = [...insights]
    .sort((a, b) => LEVEL_INFO[b.level].severity - LEVEL_INFO[a.level].severity)
    .slice(0, 2)
    .map((item) => `${item.title}: ${item.label}`);

  return {
    generated_at: new Date().toISOString(),
    overall_score: overall.score,
    overall_level: overall.level,
    overall_label: overall.label,
    highlights: topRisks,
    insights,
    latest_exam_date: latestExam?.exam_date || latestExam?.created_at || null,
    latest_exam_name: latestExam?.exam_name || null,
  };
}

module.exports = {
  LEVEL_INFO,
  normalizeText,
  parseReferenceRange,
  deriveFlagFromMarkerPayload,
  findMarkerByAliases,
  buildClinicalOverview,
};
