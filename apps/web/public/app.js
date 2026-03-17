const state = {
  userId: null,
  charts: {
    weight: null,
    fat: null,
    hydration: null,
  },
  cache: {
    dashboard: null,
    reports: [],
    measurements: [],
    bioimpedance: [],
    exams: [],
    hydration: [],
    workouts: [],
    nutrition: [],
  },
};

const STATUS_CLASSES = ["status-info", "status-success", "status-warning", "status-error"];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtNumber(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "-";
  return parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function fmtDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function fmtDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("pt-BR");
}

function compactObject(source) {
  const output = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (value === "" || value === undefined || value === null) continue;
    output[key] = value;
  }
  return output;
}

function formToObject(form) {
  const formData = new FormData(form);
  return compactObject(Object.fromEntries(formData.entries()));
}

function setStatus(message, type = "info") {
  const node = document.getElementById("status-message");
  if (!node) return;

  node.textContent = message;
  node.classList.remove(...STATUS_CLASSES);
  node.classList.add(`status-${type}`);
}

function writeOutput(id, value) {
  const node = document.getElementById(id);
  if (!node) return;

  if (typeof value === "string") {
    node.textContent = value;
    return;
  }

  node.textContent = JSON.stringify(value, null, 2);
}

function emptyState(message) {
  return `<p class=\"empty\">${escapeHtml(message)}</p>`;
}

function qualityClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "otimo") return "quality-otimo";
  if (normalized === "bom") return "quality-bom";
  if (normalized === "ainda pode, mas pouco") return "quality-moderado";
  if (normalized === "ruim") return "quality-ruim";
  if (normalized === "nunca coma") return "quality-nunca";
  return "quality-default";
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error || body?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body;
}

async function apiFormData(url, formData, options = {}) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error || body?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body;
}

async function ensureUser() {
  if (state.userId) return state.userId;

  const usersPayload = await apiJson("/api/users?auto_create=1");
  if (!usersPayload.users || usersPayload.users.length === 0) {
    throw new Error("Nao foi possivel encontrar/criar usuario principal");
  }

  state.userId = usersPayload.users[0].id;
  return state.userId;
}

function setupTabs() {
  const buttons = Array.from(document.querySelectorAll(".tab-button"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));

  function activate(tabName) {
    for (const button of buttons) {
      button.classList.toggle("is-active", button.dataset.tab === tabName);
    }

    for (const panel of panels) {
      panel.classList.toggle("is-active", panel.id === `tab-${tabName}`);
    }
  }

  for (const button of buttons) {
    button.addEventListener("click", () => activate(button.dataset.tab));
  }
}

function buildReportCard(report) {
  const reportDate = fmtDate(report.report_date);
  const summary = report.summary || {};
  const hydration = summary.hydration || {};
  const nutrition = summary.nutrition || {};
  const workouts = summary.workouts || {};

  return `
    <article class="history-item report-item">
      <header>
        <strong>${escapeHtml(reportDate)}</strong>
        <span class="muted">${escapeHtml(report.period || "daily")}</span>
      </header>
      <p>Água: <strong>${fmtNumber(hydration.total_ml, 0)} ml</strong> (${fmtNumber(hydration.goal_progress_pct, 0)}%)</p>
      <p>Refeições: <strong>${fmtNumber(nutrition.total_entries, 0)}</strong></p>
      <p>Treinos: <strong>${fmtNumber(workouts.total_sessions, 0)}</strong></p>
      <p class="muted">${escapeHtml((summary.action_hints || [])[0] || "Sem recomendações.")}</p>
    </article>
  `;
}

function renderReports() {
  const container = document.getElementById("reports-list");
  if (!container) return;

  if (!state.cache.reports.length) {
    container.innerHTML = emptyState("Sem relatórios gerados ainda.");
    return;
  }

  container.innerHTML = state.cache.reports.map(buildReportCard).join("");
}

function renderMetricCards() {
  const overview = state.cache.dashboard?.overview;
  if (!overview) return;

  document.getElementById("metric-water").textContent = `${fmtNumber(overview.today.hydration_total_ml, 0)} ml`;
  document.getElementById("metric-meals").textContent = String(overview.today.nutrition_count || 0);

  const quality = overview.today.latest_nutrition?.meal_quality || "sem registro";
  const qualityNode = document.getElementById("metric-last-quality");
  qualityNode.textContent = quality;
  qualityNode.className = `metric-sub tag ${qualityClass(quality)}`;

  document.getElementById("metric-workouts").textContent = String(overview.week.workout_sessions || 0);
  document.getElementById("metric-workout-minutes").textContent = `${fmtNumber(overview.week.total_workout_minutes, 0)} min`;
}

function renderHistoryList(containerId, items, toHtml) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = emptyState("Sem registros ainda.");
    return;
  }

  container.innerHTML = items.map(toHtml).join("");
}

function renderHistories() {
  renderHistoryList("history-measurements", state.cache.measurements, (item) => `
    <article class="history-item">
      <header><strong>${fmtDateTime(item.recorded_at)}</strong></header>
      <p>Peso: <strong>${fmtNumber(item.weight_kg)} kg</strong> | IMC: ${fmtNumber(item.bmi, 2)}</p>
      <p>Gordura: ${fmtNumber(item.body_fat_pct)}% | Cintura: ${fmtNumber(item.waist_cm)} cm</p>
      <p class="muted">${escapeHtml(item.notes || "-")}</p>
    </article>
  `);

  renderHistoryList("history-bioimpedance", state.cache.bioimpedance, (item) => `
    <article class="history-item">
      <header><strong>${fmtDateTime(item.recorded_at)}</strong></header>
      <p>Gordura: <strong>${fmtNumber(item.body_fat_pct)}%</strong> | Muscular: ${fmtNumber(item.muscle_mass_kg)} kg</p>
      <p>Água: ${fmtNumber(item.body_water_pct)}% | BMR: ${fmtNumber(item.bmr_kcal, 0)} kcal</p>
      <p class="muted">${escapeHtml(item.notes || "-")}</p>
    </article>
  `);

  renderHistoryList("history-exams", state.cache.exams, (item) => {
    const markersJson = JSON.stringify(item.markers || {}, null, 2);
    const fileLink = item.file_url
      ? `<a class="file-link" href="${escapeHtml(item.file_url)}" target="_blank" rel="noreferrer">Abrir anexo</a>`
      : "<span class=\"muted\">Sem anexo</span>";

    return `
      <article class="history-item">
        <header><strong>${escapeHtml(item.exam_name || "Exame")}</strong></header>
        <p>Data: ${fmtDate(item.exam_date || item.created_at)} | Tipo: ${escapeHtml(item.exam_type || "-")}</p>
        <details>
          <summary>Marcadores</summary>
          <pre>${escapeHtml(markersJson)}</pre>
        </details>
        <p>${fileLink}</p>
        <p class="muted">${escapeHtml(item.notes || "-")}</p>
      </article>
    `;
  });

  renderHistoryList("history-hydration", state.cache.hydration, (item) => `
    <article class="history-item">
      <header><strong>${fmtDateTime(item.recorded_at)}</strong></header>
      <p>${fmtNumber(item.amount_ml, 0)} ml</p>
      <p class="muted">${escapeHtml(item.notes || "-")}</p>
    </article>
  `);

  renderHistoryList("history-workouts", state.cache.workouts, (item) => `
    <article class="history-item">
      <header><strong>${escapeHtml(item.activity_type || "Treino")}</strong></header>
      <p>${fmtNumber(item.duration_minutes, 0)} min | Intensidade: ${escapeHtml(item.intensity || "-")}</p>
      <p>Inicio: ${fmtDateTime(item.started_at || item.created_at)}</p>
      <p class="muted">${escapeHtml(item.notes || "-")}</p>
    </article>
  `);

  renderHistoryList("history-nutrition", state.cache.nutrition, (item) => `
    <article class="history-item">
      <header>
        <strong>${fmtDateTime(item.recorded_at)}</strong>
        <span class="tag ${qualityClass(item.meal_quality)}">${escapeHtml(item.meal_quality || "-")}</span>
      </header>
      <p>${escapeHtml(item.analyzed_summary || "Sem resumo")}</p>
      <p class="muted">Calorias: ${fmtNumber(item.estimated_calories, 0)} | Proteína: ${fmtNumber(item.estimated_protein_g)} g</p>
    </article>
  `);
}

function getChartContext(id) {
  const canvas = document.getElementById(id);
  if (!canvas || typeof window.Chart === "undefined") return null;
  return canvas.getContext("2d");
}

function upsertChart(name, canvasId, config) {
  const ctx = getChartContext(canvasId);
  if (!ctx) return;

  if (state.charts[name]) {
    state.charts[name].destroy();
  }

  state.charts[name] = new window.Chart(ctx, config);
}

function sortAscByDate(items, key) {
  return [...(items || [])].sort((a, b) => new Date(a[key]).getTime() - new Date(b[key]).getTime());
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 120,
    animation: false,
    plugins: { legend: { display: false } },
  };
}

function renderWeightChart() {
  const points = sortAscByDate(state.cache.measurements, "recorded_at")
    .filter((item) => item.weight_kg !== null && item.weight_kg !== undefined)
    .slice(-20);

  upsertChart("weight", "chart-weight", {
    type: "line",
    data: {
      labels: points.map((item) => fmtDate(item.recorded_at)),
      datasets: [
        {
          label: "Peso (kg)",
          data: points.map((item) => Number(item.weight_kg)),
          borderColor: "#d35f2f",
          backgroundColor: "rgba(211,95,47,0.2)",
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      ...baseChartOptions(),
    },
  });
}

function renderFatChart() {
  const measurementPoints = sortAscByDate(state.cache.measurements, "recorded_at")
    .filter((item) => item.body_fat_pct !== null && item.body_fat_pct !== undefined)
    .map((item) => ({ date: item.recorded_at, value: Number(item.body_fat_pct) }));

  const bioPoints = sortAscByDate(state.cache.bioimpedance, "recorded_at")
    .filter((item) => item.body_fat_pct !== null && item.body_fat_pct !== undefined)
    .map((item) => ({ date: item.recorded_at, value: Number(item.body_fat_pct) }));

  const points = (measurementPoints.length > 0 ? measurementPoints : bioPoints).slice(-20);

  upsertChart("fat", "chart-fat", {
    type: "line",
    data: {
      labels: points.map((item) => fmtDate(item.date)),
      datasets: [
        {
          label: "Gordura corporal (%)",
          data: points.map((item) => item.value),
          borderColor: "#2f8f83",
          backgroundColor: "rgba(47,143,131,0.22)",
          tension: 0.25,
          pointRadius: 3,
        },
      ],
    },
    options: {
      ...baseChartOptions(),
    },
  });
}

function hydrationSeries(logs, days = 14) {
  const totals = {};
  for (const item of logs || []) {
    const dateKey = String(item.recorded_at || "").slice(0, 10);
    if (!dateKey) continue;
    totals[dateKey] = (totals[dateKey] || 0) + Number(item.amount_ml || 0);
  }

  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const ref = new Date(today);
    ref.setDate(today.getDate() - i);
    const key = ref.toISOString().slice(0, 10);
    result.push({
      key,
      label: ref.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: Number(totals[key] || 0),
    });
  }

  return result;
}

function renderHydrationChart() {
  const points = hydrationSeries(state.cache.hydration, 14);

  upsertChart("hydration", "chart-hydration", {
    type: "bar",
    data: {
      labels: points.map((item) => item.label),
      datasets: [
        {
          label: "Hidratação (ml)",
          data: points.map((item) => item.value),
          backgroundColor: "rgba(38, 124, 183, 0.45)",
          borderColor: "#267cb7",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      ...baseChartOptions(),
    },
  });
}

function renderCharts() {
  renderWeightChart();
  renderFatChart();
  renderHydrationChart();
}

async function loadAllData() {
  const userId = await ensureUser();

  const [dashboard, reports, measurements, bioimpedance, exams, hydration, workouts, nutrition] = await Promise.all([
    apiJson(`/api/dashboard/overview?user_id=${encodeURIComponent(userId)}`),
    apiJson(`/api/reports?user_id=${encodeURIComponent(userId)}&period=daily&limit=14`),
    apiJson(`/api/measurements?user_id=${encodeURIComponent(userId)}&limit=100`),
    apiJson(`/api/bioimpedance?user_id=${encodeURIComponent(userId)}&limit=100`),
    apiJson(`/api/medical-exams?user_id=${encodeURIComponent(userId)}&limit=100`),
    apiJson(`/api/hydration?user_id=${encodeURIComponent(userId)}&limit=200`),
    apiJson(`/api/workouts?user_id=${encodeURIComponent(userId)}&limit=100`),
    apiJson(`/api/nutrition?user_id=${encodeURIComponent(userId)}&limit=100`),
  ]);

  state.cache.dashboard = dashboard;
  state.cache.reports = reports.reports || [];
  state.cache.measurements = measurements.measurements || [];
  state.cache.bioimpedance = bioimpedance.records || [];
  state.cache.exams = exams.exams || [];
  state.cache.hydration = hydration.hydration || [];
  state.cache.workouts = workouts.workouts || [];
  state.cache.nutrition = nutrition.nutrition || [];

  renderMetricCards();
  renderReports();
  renderHistories();
  renderCharts();
}

function bindForm(formId, handler) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      setStatus("Processando...", "info");
      await ensureUser();
      const payload = formToObject(form);
      await handler(payload, form);
    } catch (err) {
      setStatus(`Erro: ${err.message}`, "error");
    }
  });
}

async function refreshAllWithStatus(successMessage = "Dados atualizados.") {
  await loadAllData();
  setStatus(successMessage, "success");
}

function setupActions() {
  document.getElementById("refresh-dashboard")?.addEventListener("click", async () => {
    try {
      setStatus("Atualizando painel...", "info");
      await refreshAllWithStatus("Painel atualizado.");
    } catch (err) {
      setStatus(`Erro ao atualizar: ${err.message}`, "error");
    }
  });

  document.getElementById("generate-daily-report")?.addEventListener("click", async () => {
    try {
      const userId = await ensureUser();
      const today = new Date().toISOString().slice(0, 10);
      setStatus("Gerando relatório diário...", "info");

      await apiJson("/api/reports/generate", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, period: "daily", report_date: today }),
      });

      await refreshAllWithStatus("Relatório diário gerado com sucesso.");
    } catch (err) {
      setStatus(`Erro ao gerar relatório: ${err.message}`, "error");
    }
  });

  document.getElementById("load-workout-recommendation")?.addEventListener("click", async () => {
    try {
      const userId = await ensureUser();
      setStatus("Gerando recomendação de treino...", "info");
      const payload = await apiJson(`/api/workouts/recommendation?user_id=${encodeURIComponent(userId)}`);
      writeOutput("workout-recommendation", payload.recommendation);
      setStatus("Recomendação atualizada.", "success");
    } catch (err) {
      writeOutput("workout-recommendation", `Erro: ${err.message}`);
      setStatus(`Erro no treino: ${err.message}`, "error");
    }
  });
}

function setupForms() {
  bindForm("nutrition-form", async (payload, form) => {
    const userId = await ensureUser();

    const analysis = await apiJson("/api/nutrition/analyze-text", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, text: payload.text }),
    });

    writeOutput("nutrition-result", {
      quality: analysis.quality,
      replyText: analysis.replyText,
      analysis: analysis.analysis,
    });

    form.reset();
    await refreshAllWithStatus("Alimentação analisada e registrada.");
  });

  bindForm("hydration-form", async (payload, form) => {
    const userId = await ensureUser();

    await apiJson("/api/hydration", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        amount_ml: Number(payload.amount_ml),
        notes: payload.notes,
        source: "web",
      }),
    });

    form.reset();
    await refreshAllWithStatus("Hidratação registrada.");
  });

  bindForm("profile-form", async (payload, form) => {
    const userId = await ensureUser();

    await apiJson("/api/profile", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, ...payload }),
    });

    form.reset();
    await refreshAllWithStatus("Perfil salvo.");
  });

  bindForm("measurement-form", async (payload, form) => {
    const userId = await ensureUser();

    await apiJson("/api/measurements", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, ...payload }),
    });

    form.reset();
    await refreshAllWithStatus("Medidas corporais salvas.");
  });

  bindForm("bioimpedance-form", async (payload, form) => {
    const userId = await ensureUser();

    await apiJson("/api/bioimpedance", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, ...payload }),
    });

    form.reset();
    await refreshAllWithStatus("Bioimpedância salva.");
  });

  bindForm("exam-form", async (payload, form) => {
    const userId = await ensureUser();
    let markers = {};

    if (payload.markers) {
      try {
        markers = JSON.parse(payload.markers);
      } catch {
        throw new Error("Marcadores do exame devem estar em JSON válido");
      }
    }

    await apiJson("/api/medical-exams", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        exam_name: payload.exam_name,
        exam_type: payload.exam_type,
        exam_date: payload.exam_date,
        markers,
      }),
    });

    form.reset();
    await refreshAllWithStatus("Exame médico salvo.");
  });

  bindForm("workout-form", async (payload, form) => {
    const userId = await ensureUser();

    await apiJson("/api/workouts", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, ...payload }),
    });

    form.reset();
    await refreshAllWithStatus("Treino salvo.");
  });

  const bioUploadForm = document.getElementById("bioimpedance-upload-form");
  bioUploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const userId = await ensureUser();
      setStatus("Enviando bioimpedância para análise...", "info");

      const formData = new FormData(bioUploadForm);
      formData.set("user_id", userId);
      const result = await apiFormData("/api/bioimpedance/upload", formData);

      writeOutput("bioimpedance-upload-result", result);
      bioUploadForm.reset();
      await refreshAllWithStatus("Bioimpedância por anexo processada.");
    } catch (err) {
      writeOutput("bioimpedance-upload-result", `Erro: ${err.message}`);
      setStatus(`Erro no upload de bioimpedância: ${err.message}`, "error");
    }
  });

  const examUploadForm = document.getElementById("exam-upload-form");
  examUploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const userId = await ensureUser();
      setStatus("Enviando exame para análise...", "info");

      const formData = new FormData(examUploadForm);
      formData.set("user_id", userId);
      const result = await apiFormData("/api/medical-exams/upload", formData);

      writeOutput("exam-upload-result", result);
      examUploadForm.reset();
      await refreshAllWithStatus("Exame por anexo processado.");
    } catch (err) {
      writeOutput("exam-upload-result", `Erro: ${err.message}`);
      setStatus(`Erro no upload de exame: ${err.message}`, "error");
    }
  });
}

async function boot() {
  setupTabs();
  setupActions();
  setupForms();

  try {
    setStatus("Carregando dados...", "info");
    await loadAllData();
    setStatus("Painel carregado.", "success");
  } catch (err) {
    setStatus(`Painel carregado com aviso: ${err.message}`, "warning");
  }
}

boot();
