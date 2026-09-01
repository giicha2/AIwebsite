(() => {
  const STORAGE_KEY = "retire-plan-v1";
  const FALLBACK_SECURITIES = 629300915;
  const START_YEAR = 2026;
  const START_MONTH = 9;
  const MAX_MONTHS = 600;
  const JONGSIN_UNTIL = 2035 * 100 + 7;
  const WIFE_PREM_UNTIL = 2042 * 100 + 7;
  const USER_NPS_FROM = 2040 * 100 + 7;
  const WIFE_NPS_FROM = 2042 * 100 + 7;
  const CAR_YM = 2027 * 100 + 7;
  const PRESETS = [0, 3, 5, 7];

  const DEFAULTS = {
    living: 5000000,
    jongsin: 116095,
    wifePrem: 100000,
    userNps: 1500000,
    wifeNps: 0,
    house: 1450000000,
    includeHouse: false,
    car: 65000000,
    includeCar: true,
    education: 0,
    returnPct: 5,
    includeHankuk: true,
    irp: 182701587,
    isa: 20793914,
    pnsSave: 1443307,
  };

  let lineChart = null;

  function formatKrw(value) {
    const num = Math.round(Number(value) || 0);
    return num.toLocaleString("ko-KR") + "원";
  }

  function ymNum(year, month) {
    return year * 100 + month;
  }

  function loadPlan() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      const parsed = JSON.parse(raw);
      const plan = Object.assign({}, DEFAULTS, parsed);
      plan.includeHouse = Boolean(plan.includeHouse);
      plan.includeCar = Boolean(plan.includeCar);
      plan.includeHankuk = Boolean(plan.includeHankuk);
      [
        "living", "jongsin", "wifePrem", "userNps", "wifeNps",
        "house", "car", "education", "returnPct", "irp", "isa", "pnsSave",
      ].forEach(function (key) {
        const n = Number(plan[key]);
        plan[key] = Number.isFinite(n) ? n : DEFAULTS[key];
      });
      return plan;
    } catch (_error) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function savePlan(plan) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }

  function spendableOf(plan, securities) {
    const hankuk = plan.includeHankuk
      ? (Number(plan.irp) || 0) + (Number(plan.isa) || 0) + (Number(plan.pnsSave) || 0)
      : 0;
    const house = plan.includeHouse ? Number(plan.house) || 0 : 0;
    return Math.max(0, (Number(securities) || 0) + hankuk + house);
  }

  function simulate(plan, securities) {
    const r = (Number(plan.returnPct) || 0) / 100;
    const monthlyReturn = 1 + r / 12;
    const living = Number(plan.living) || 0;
    const education = Number(plan.education) || 0;
    const jongsin = Number(plan.jongsin) || 0;
    const wifePrem = Number(plan.wifePrem) || 0;
    const userNps = Number(plan.userNps) || 0;
    const wifeNps = Number(plan.wifeNps) || 0;
    const car = Number(plan.car) || 0;
    let assets = spendableOf(plan, securities);
    let year = START_YEAR;
    let month = START_MONTH;
    const points = [];

    for (let i = 0; i < MAX_MONTHS; i += 1) {
      assets *= monthlyReturn;
      assets -= living + education;
      const ym = ymNum(year, month);
      if (ym <= JONGSIN_UNTIL) assets -= jongsin;
      if (ym <= WIFE_PREM_UNTIL) assets -= wifePrem;
      if (ym >= USER_NPS_FROM) assets += userNps;
      if (ym >= WIFE_NPS_FROM) assets += wifeNps;
      if (plan.includeCar && ym === CAR_YM) assets -= car;

      points.push({ year: year, month: month, remaining: assets });
      if (assets <= 0) break;

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    const last = points[points.length - 1];
    const depleted = Boolean(last && last.remaining <= 0);
    return { points: points, depleted: depleted, last: last };
  }

  function headlineText(plan, sim) {
    const pct = Number(plan.returnPct) || 0;
    if (!sim.depleted) {
      return "연 " + pct + "%면 50년 안 바닥";
    }
    const y = sim.last.year;
    const m = sim.last.month;
    const months = sim.points.length;
    const years = months / 12;
    const yearsLabel = Number.isInteger(years)
      ? String(years)
      : years.toFixed(1).replace(/\.0$/, "");
    return "연 " + pct + "%면 바닥은 " + y + "년 " + m + "월 (약 " + yearsLabel + "년)";
  }

  async function loadChartJs() {
    if (window.Chart) return window.Chart;

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Chart.js 로드 실패"));
      document.head.appendChild(script);
    });

    return window.Chart;
  }

  async function fetchPortfolio() {
    const response = await fetch(`api/portfolio.php${window.cacheBust?.() || `?v=${Date.now()}`}`, {
      headers: window.blogAuthHeaders?.() || {},
    });
    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      return { authenticated: false, error: data?.error || "로그인이 필요합니다." };
    }

    if (!response.ok) {
      throw new Error(data?.error || "투자 현황을 불러오지 못했습니다.");
    }

    return data;
  }

  function renderLoginGate(content) {
    content.className = "hero hero--invest";
    content.innerHTML = `
      <span class="badge">내 자산</span>
      <h2>생애 노후계획</h2>
      ${window.investSubtabsHtml ? window.investSubtabsHtml("retire") : ""}
      <p>로그인 후에만 볼 수 있는 개인 페이지입니다.</p>
      <div class="invest-login-card">
        <form class="blog-login-form" id="retire-login-form">
          <label for="retire-password">관리자 비밀번호</label>
          <input id="retire-password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호 입력" required />
          <div class="blog-form-actions">
            <button class="blog-login-submit" type="submit">로그인</button>
          </div>
          <p class="blog-status" id="retire-login-status" aria-live="polite"></p>
        </form>
      </div>
    `;

    const form = document.getElementById("retire-login-form");
    const status = document.getElementById("retire-login-status");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = form.password.value;
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      status.textContent = "로그인 중...";
      status.className = "blog-status";

      try {
        await window.loginBlog(password);
        await window.renderRetireContent();
      } catch (error) {
        status.className = "blog-status error";
        status.textContent = error.message || "로그인에 실패했습니다.";
      } finally {
        button.disabled = false;
      }
    });
  }

  function securitiesFrom(data) {
    const total = Number(data && data.totalKrw);
    if (total > 0) return total;
    const holdings = Array.isArray(data && data.holdings) ? data.holdings : [];
    const sum = holdings.reduce(function (acc, item) {
      return acc + (Number(item && item.valueKrw) || 0);
    }, 0);
    return sum > 0 ? sum : FALLBACK_SECURITIES;
  }

  function readPlanFromForm(form, current) {
    function num(name) {
      const el = form.querySelector("[name='" + name + "']");
      const n = Number(el && el.value);
      return Number.isFinite(n) ? n : current[name];
    }
    function chk(name) {
      const el = form.querySelector("[name='" + name + "']");
      return Boolean(el && el.checked);
    }
    return {
      living: num("living"),
      jongsin: num("jongsin"),
      wifePrem: num("wifePrem"),
      userNps: num("userNps"),
      wifeNps: num("wifeNps"),
      house: num("house"),
      car: num("car"),
      education: num("education"),
      returnPct: num("returnPct"),
      irp: num("irp"),
      isa: num("isa"),
      pnsSave: num("pnsSave"),
      includeHouse: chk("includeHouse"),
      includeCar: chk("includeCar"),
      includeHankuk: chk("includeHankuk"),
    };
  }

  function breakdownHtml(plan, securities, total) {
    const hankuk = plan.includeHankuk
      ? (Number(plan.irp) || 0) + (Number(plan.isa) || 0) + (Number(plan.pnsSave) || 0)
      : 0;
    const house = plan.includeHouse ? Number(plan.house) || 0 : 0;
    const parts = ["증권 " + formatKrw(securities)];
    if (plan.includeHankuk) parts.push("연금·ISA " + formatKrw(hankuk));
    if (plan.includeHouse) parts.push("집 " + formatKrw(house));
    return parts.join(" + ") + " = " + formatKrw(total);
  }

  async function drawLine(points) {
    const canvas = document.getElementById("retire-line");
    if (!canvas) return;
    const Chart = await loadChartJs();
    if (lineChart) {
      lineChart.destroy();
      lineChart = null;
    }
    const labels = points.map(function (p) { return p.year + "." + p.month; });
    const values = points.map(function (p) {
      return Math.max(0, Number(p.remaining) || 0) / 100000000;
    });
    lineChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["데이터 없음"],
        datasets: [{
          label: "잔액(억)",
          data: values.length ? values : [0],
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.18)",
          borderWidth: 2,
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: "#38bdf8",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            ticks: { color: "#94a3b8", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#94a3b8",
              maxTicksLimit: 6,
              callback: function (value) {
                return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "억";
              },
            },
            grid: { color: "rgba(148, 163, 184, 0.15)" },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                const eok = Number(context.raw || 0);
                return eok.toLocaleString("ko-KR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                }) + "억 원";
              },
            },
          },
        },
      },
    });
  }

  function applySimToDom(plan, securities, sim) {
    const headline = document.getElementById("retire-headline");
    const change = document.getElementById("retire-total-change");
    const totalEl = document.getElementById("retire-total-value");
    const total = spendableOf(plan, securities);
    if (headline) headline.textContent = headlineText(plan, sim);
    if (totalEl) totalEl.textContent = formatKrw(total);
    if (change) change.textContent = breakdownHtml(plan, securities, total);
    document.querySelectorAll("[data-retire-preset]").forEach(function (btn) {
      const pct = Number(btn.dataset.retirePreset);
      btn.classList.toggle("is-active", pct === Number(plan.returnPct));
    });
    const returnInput = document.querySelector("[name='returnPct']");
    if (returnInput && document.activeElement !== returnInput) {
      returnInput.value = String(plan.returnPct);
    }
    drawLine(sim.points);
  }

  function bindRetireUi(state) {
    const form = document.getElementById("retire-plan-form");
    function persistAndRefresh() {
      if (!form) return;
      state.plan = readPlanFromForm(form, state.plan);
      savePlan(state.plan);
      applySimToDom(state.plan, state.securities, simulate(state.plan, state.securities));
    }
    if (form) form.addEventListener("change", persistAndRefresh);
    document.querySelectorAll("[data-retire-preset]").forEach(function (button) {
      button.addEventListener("click", function () {
        const pct = Number(button.dataset.retirePreset);
        state.plan.returnPct = Number.isFinite(pct) ? pct : state.plan.returnPct;
        const returnInput = form && form.querySelector("[name='returnPct']");
        if (returnInput) returnInput.value = String(state.plan.returnPct);
        savePlan(state.plan);
        applySimToDom(state.plan, state.securities, simulate(state.plan, state.securities));
      });
    });
  }

  function field(label, name, value, step) {
    return "<label>" + label +
      '<input name="' + name + '" type="number" min="0" step="' + step +
      '" value="' + String(value) + '" inputmode="numeric" /></label>';
  }

  function presetButtons(plan) {
    return PRESETS.map(function (pct) {
      const active = Number(plan.returnPct) === pct ? " is-active" : "";
      return '<button type="button" class="invest-range-btn' + active +
        '" data-retire-preset="' + pct + '"><span>연 ' + pct + "%</span></button>";
    }).join("");
  }

  async function paintRetirePage(state) {
    const content = document.getElementById("content");
    const plan = state.plan;
    const securities = state.securities;
    const total = spendableOf(plan, securities);
    const sim = simulate(plan, securities);
    content.className = "hero hero--invest";
    content.innerHTML =
      '<div class="invest-header"><div>' +
      '<span class="badge">내 자산</span>' +
      "<h2>생애 노후계획</h2>" +
      "<p>증권·연금으로 생활비가 언제까지 버티는지 봅니다. 숫자는 바로 고칠 수 있어요.</p>" +
      "</div></div>" +
      (window.investSubtabsHtml ? window.investSubtabsHtml("retire") : "") +
      '<div class="invest-total-panel" id="retire-total-panel">' +
      '<div class="invest-total-head"><div class="invest-total-summary">' +
      '<span class="invest-total-label">사용 가능 자산</span>' +
      '<div class="invest-total-row">' +
      '<strong id="retire-total-value">' + formatKrw(total) + "</strong>" +
      '<span class="invest-total-change" id="retire-total-change">' +
      breakdownHtml(plan, securities, total) + "</span></div>" +
      '<p class="retire-headline" id="retire-headline">' + headlineText(plan, sim) + "</p>" +
      "</div></div>" +
      '<div class="retire-compare">' + presetButtons(plan) + "</div>" +
      '<div class="retire-chart-wrap invest-line-wrap">' +
      '<canvas id="retire-line" aria-label="노후 잔액 그래프"></canvas></div></div>' +
      '<form class="invest-add-form" id="retire-plan-form" autocomplete="off">' +
      '<div class="retire-grid">' +
      field("월 생활비", "living", plan.living, "10000") +
      field("종신보험(본인, ~2035.7)", "jongsin", plan.jongsin, "1") +
      field("종신보험(배우자, ~2042.7)", "wifePrem", plan.wifePrem, "1") +
      field("국민연금(본인, 2040.7~)", "userNps", plan.userNps, "10000") +
      field("국민연금(배우자)", "wifeNps", plan.wifeNps, "10000") +
      field("월 교육비", "education", plan.education, "10000") +
      field("집 시세", "house", plan.house, "1000000") +
      field("차량 교체(2027.7)", "car", plan.car, "1000000") +
      field("IRP", "irp", plan.irp, "1") +
      field("ISA", "isa", plan.isa, "1") +
      field("연금저축", "pnsSave", plan.pnsSave, "1") +
      "<label>기대 수익률(%)" +
      '<input name="returnPct" type="number" step="0.1" value="' + String(plan.returnPct) +
      '" inputmode="decimal" /></label>' +
      "</div>" +
      '<div class="retire-checks">' +
      "<label><input name=\"includeHankuk\" type=\"checkbox\"" +
      (plan.includeHankuk ? " checked" : "") +
      " /> 한국투자 IRP·ISA·연금저축 포함</label>" +
      "<label><input name=\"includeHouse\" type=\"checkbox\"" +
      (plan.includeHouse ? " checked" : "") +
      " /> 집 시세 포함 (기본 제외)</label>" +
      "<label><input name=\"includeCar\" type=\"checkbox\"" +
      (plan.includeCar ? " checked" : "") +
      " /> 2027년 7월 차량 교체 지출</label>" +
      "</div></form>" +
      '<p class="invest-help">집은 기본으로 원금 제외합니다. 저축보험 만기, 본인 1975 · 아내 1977 · 중3 딸 · 분당 구미동 34평 기준입니다. 입력값은 이 브라우저에만 저장됩니다.</p>';
    bindRetireUi(state);
    await drawLine(sim.points);
  }

  async function renderRetireContent() {
    const content = document.getElementById("content");
    if (lineChart) {
      lineChart.destroy();
      lineChart = null;
    }
    content.className = "hero hero--invest";
    content.innerHTML =
      '<span class="badge">내 자산</span>' +
      "<h2>생애 노후계획</h2>" +
      (window.investSubtabsHtml ? window.investSubtabsHtml("retire") : "") +
      '<p class="media-loading">불러오는 중...</p>';

    try {
      const auth = (window.fetchBlogAuthStatus && (await window.fetchBlogAuthStatus())) || {
        authenticated: false,
      };
      if (!auth.authenticated) {
        renderLoginGate(content);
        return;
      }

      let securities = FALLBACK_SECURITIES;
      try {
        const data = await fetchPortfolio();
        if (data.authenticated === false) {
          renderLoginGate(content);
          return;
        }
        securities = securitiesFrom(data);
      } catch (_error) {
        securities = FALLBACK_SECURITIES;
      }

      await paintRetirePage({ plan: loadPlan(), securities: securities });
    } catch (error) {
      const msg = (window.escapeHtml && window.escapeHtml(error.message)) || error.message;
      content.innerHTML =
        '<span class="badge">내 자산</span>' +
        "<h2>생애 노후계획</h2>" +
        (window.investSubtabsHtml ? window.investSubtabsHtml("retire") : "") +
        '<p class="blog-status error">' + msg + "</p>" +
        "<p>로컬에서는 PHP API가 필요합니다. NAS에 배포된 주소로 확인해 주세요.</p>";
    }
  }

  window.renderRetireContent = renderRetireContent;

  if (typeof window.__retryRouteIfNeeded === "function") {
    window.__retryRouteIfNeeded();
  } else if ((location.hash || "").replace(/^#/, "") === "retire") {
    renderRetireContent();
  }
})();
