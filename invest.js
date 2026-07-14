(() => {
  const PIE_COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb7185", "#2dd4bf"];

  function formatKrw(value) {
    const num = Math.round(Number(value) || 0);
    return `${num.toLocaleString("ko-KR")}원`;
  }

  function formatSignedKrw(value) {
    const num = Math.round(Number(value) || 0);
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toLocaleString("ko-KR")}원`;
  }

  function formatPct(value) {
    const num = Number(value) || 0;
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(2)}%`;
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

  async function mutatePortfolio(method, body) {
    const headers = {
      "Content-Type": "application/json",
      ...(window.blogAuthHeaders?.() || {}),
    };
    const response = await fetch(`api/portfolio.php${window.cacheBust?.() || `?v=${Date.now()}`}`, {
      method,
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error || "저장에 실패했습니다.");
    }

    return data;
  }

  function destroyCharts(state) {
    if (state.pieChart) {
      state.pieChart.destroy();
      state.pieChart = null;
    }
    if (state.lineChart) {
      state.lineChart.destroy();
      state.lineChart = null;
    }
  }

  function renderLoginGate(content) {
    content.className = "hero hero--invest";
    content.innerHTML = `
      <span class="badge">내 자산</span>
      <h2>나만의 투자 현황</h2>
      <p>로그인 후에만 볼 수 있는 개인 페이지입니다.</p>
      <div class="invest-login-card">
        <form class="blog-login-form" id="invest-login-form">
          <label for="invest-password">관리자 비밀번호</label>
          <input id="invest-password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호 입력" required />
          <div class="blog-form-actions">
            <button class="blog-login-submit" type="submit">로그인</button>
          </div>
          <p class="blog-status" id="invest-login-status" aria-live="polite"></p>
        </form>
      </div>
    `;

    const form = document.getElementById("invest-login-form");
    const status = document.getElementById("invest-login-status");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = form.password.value;
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      status.textContent = "로그인 중...";
      status.className = "blog-status";

      try {
        await window.loginBlog(password);
        await window.renderInvestContent();
      } catch (error) {
        status.className = "blog-status error";
        status.textContent = error.message || "로그인에 실패했습니다.";
      } finally {
        button.disabled = false;
      }
    });
  }

  function holdingsListHtml(holdings) {
    if (!holdings.length) {
      return `<p class="invest-empty">등록된 종목이 없습니다. 아래에서 추가해 보세요.</p>`;
    }

    return `
      <ul class="invest-list">
        ${holdings
          .map((item) => {
            const quoteNote = item.quoteOk
              ? item.symbol === "CASH"
                ? "현금/기타"
                : `전일종가 ${Number(item.price).toLocaleString("ko-KR")} ${item.currency}`
              : item.quoteError || "시세 갱신 실패";

            return `
              <li class="invest-item" data-id="${window.escapeHtml?.(item.id) || item.id}">
                <div class="invest-item-body">
                  <div class="invest-item-main">
                    <strong>${window.escapeHtml?.(item.name) || item.name}</strong>
                    <span class="invest-item-symbol">${window.escapeHtml?.(item.symbol) || item.symbol}</span>
                  </div>
                  <div class="invest-item-meta">
                    <span>${item.symbol === "CASH" ? "" : `${Number(item.shares).toLocaleString("ko-KR")}주 · `}${quoteNote}</span>
                    <strong>${formatKrw(item.valueKrw)}</strong>
                    <span class="invest-item-weight">${item.weight.toFixed(1)}%</span>
                  </div>
                </div>
                <button type="button" class="invest-delete-btn" data-id="${window.escapeHtml?.(item.id) || item.id}" aria-label="삭제">×</button>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  async function drawPie(state, holdings) {
    const canvas = document.getElementById("invest-pie");
    if (!canvas) return;

    const Chart = await loadChartJs();
    if (state.pieChart) state.pieChart.destroy();

    const labels = holdings.map((h) => h.name);
    const values = holdings.map((h) => Math.max(0, Number(h.valueKrw) || 0));

    state.pieChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values.length ? values : [1],
            backgroundColor: values.length
              ? holdings.map((_, i) => PIE_COLORS[i % PIE_COLORS.length])
              : ["#334155"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "42%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue("--color-muted").trim() || "#64748b",
              boxWidth: 12,
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0) || 1;
                return `${context.label}: ${formatKrw(value)} (${((value / total) * 100).toFixed(1)}%)`;
              },
            },
          },
        },
      },
    });
  }

  async function drawHistory(state, series, mode) {
    const canvas = document.getElementById("invest-line");
    if (!canvas) return;

    const Chart = await loadChartJs();
    if (state.lineChart) state.lineChart.destroy();

    const labels = series.map((p) => p.label || p.date);
    const values = series.map((p) => Number(p.totalKrw) || 0);

    state.lineChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["데이터 없음"],
        datasets: [
          {
            label: mode === "daily" ? "일간 총액" : mode === "weekly" ? "주간 총액" : "월간 총액",
            data: values.length ? values : [0],
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            fill: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { color: "#94a3b8", maxRotation: 0 },
            grid: { color: "rgba(148, 163, 184, 0.15)" },
          },
          y: {
            ticks: {
              color: "#94a3b8",
              callback(value) {
                return Number(value).toLocaleString("ko-KR");
              },
            },
            grid: { color: "rgba(148, 163, 184, 0.15)" },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return formatKrw(context.raw);
              },
            },
          },
        },
      },
    });
  }

  async function fetchQuoteForName(name) {
    const query = String(name || "").trim();
    if (!query) return null;

    const bust = window.cacheBust?.() || `?v=${Date.now()}`;
    const sep = bust.includes("?") ? "&" : "?";
    const url = `api/portfolio.php${bust}${sep}mode=quote&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: window.blogAuthHeaders?.() || {},
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "시세를 불러오지 못했습니다.");
    }

    return data;
  }

  function bindSharesCostSync(form, status) {
    const nameInput = form.querySelector("[name='holdingName']");
    const sharesInput = form.querySelector("[name='shares']");
    const costInput = form.querySelector("[name='costKrw']");
    const asCashSelect = form.querySelector("[name='asCash']");
    const quoteHint = form.querySelector("#invest-quote-hint");

    let priceKrw = 0;
    let syncLock = false;
    let quoteTimer = null;
    let lastQuotedName = "";

    const setHint = (text, isError = false) => {
      if (!quoteHint) return;
      quoteHint.textContent = text || "";
      quoteHint.className = isError ? "invest-quote-hint is-error" : "invest-quote-hint";
    };

    const writeField = (input, value) => {
      syncLock = true;
      if (Number.isFinite(value) && value > 0) {
        const rounded = input === costInput ? Math.round(value) : Math.round(value * 10000) / 10000;
        input.value = String(rounded);
      } else {
        input.value = "";
      }
      syncLock = false;
    };

    const recalculateFromShares = () => {
      if (syncLock || !(priceKrw > 0) || asCashSelect?.value === "1") return;
      const shares = Number(sharesInput.value || 0);
      if (shares > 0) writeField(costInput, shares * priceKrw);
    };

    const recalculateFromCost = () => {
      if (syncLock || !(priceKrw > 0) || asCashSelect?.value === "1") return;
      const cost = Number(costInput.value || 0);
      if (cost > 0) writeField(sharesInput, cost / priceKrw);
    };

    const refreshQuote = async () => {
      const name = String(nameInput?.value || "").trim();
      const asCash = asCashSelect?.value === "1" || /현금|기타/i.test(name);

      if (asCash) {
        priceKrw = 0;
        lastQuotedName = name;
        setHint("현금/기타: 금액만 입력하면 됩니다.");
        return;
      }

      if (!name) {
        priceKrw = 0;
        lastQuotedName = "";
        setHint("");
        return;
      }

      if (name === lastQuotedName && priceKrw > 0) {
        return;
      }

      setHint("시세 조회 중...");
      try {
        const quote = await fetchQuoteForName(name);
        lastQuotedName = name;
        priceKrw = Number(quote.priceKrw) || 0;

        if (quote.cash) {
          priceKrw = 0;
          setHint("현금/기타로 인식되었습니다.");
          return;
        }

        const unit = Math.round(priceKrw).toLocaleString("ko-KR");
        setHint(
          `시세 ${unit}원/주 (${quote.symbol}${quote.currency && quote.currency !== "KRW" ? `, ${quote.currency}` : ""})`
        );

        const shares = Number(sharesInput.value || 0);
        const cost = Number(costInput.value || 0);

        if (shares > 0 && !(cost > 0)) {
          recalculateFromShares();
        } else if (cost > 0 && !(shares > 0)) {
          recalculateFromCost();
        } else if (shares > 0) {
          recalculateFromShares();
        }
      } catch (error) {
        priceKrw = 0;
        setHint(error.message || "시세 조회 실패", true);
      }
    };

    const scheduleQuote = () => {
      clearTimeout(quoteTimer);
      quoteTimer = setTimeout(refreshQuote, 450);
    };

    nameInput?.addEventListener("input", scheduleQuote);
    nameInput?.addEventListener("change", refreshQuote);
    asCashSelect?.addEventListener("change", refreshQuote);

    sharesInput?.addEventListener("input", () => {
      if (syncLock) return;
      if (!(priceKrw > 0)) scheduleQuote();
      recalculateFromShares();
    });

    costInput?.addEventListener("input", () => {
      if (syncLock) return;
      if (!(priceKrw > 0)) scheduleQuote();
      recalculateFromCost();
    });

    form._investGetPriceKrw = () => priceKrw;
  }

  function bindInvestUi(state, data) {
    const form = document.getElementById("invest-add-form");
    const status = document.getElementById("invest-form-status");
    const totalPanel = document.getElementById("invest-total-panel");
    const rangeButtons = document.querySelectorAll("[data-invest-range]");

    if (form) {
      bindSharesCostSync(form, status);
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector("button[type='submit']");
      submit.disabled = true;
      status.textContent = "저장 중...";
      status.className = "blog-status";

      const fd = new FormData(form);
      const name = String(fd.get("holdingName") || "").trim();
      const shares = Number(fd.get("shares") || 0);
      const costKrw = Number(fd.get("costKrw") || 0);
      const asCash = fd.get("asCash") === "1" || /현금|기타/i.test(name);

      const payload = {
        name,
        shares,
        costKrw,
        asCash: asCash ? 1 : 0,
      };

      if (asCash) {
        payload.priceKrw = costKrw || shares;
      }

      try {
        const next = await mutatePortfolio("POST", payload);
        await paintInvestPage(state, next);
      } catch (error) {
        status.className = "blog-status error";
        status.textContent = error.message || "추가 실패";
        submit.disabled = false;
      }
    });

    document.querySelectorAll(".invest-delete-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("이 종목을 삭제할까요?")) return;
        try {
          const next = await mutatePortfolio("DELETE", { id: button.dataset.id });
          await paintInvestPage(state, next);
        } catch (error) {
          alert(error.message || "삭제 실패");
        }
      });
    });

    if (totalPanel) {
      drawHistory(state, data.history?.[state.rangeMode] || [], state.rangeMode);
    }

    rangeButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        state.rangeMode = button.dataset.investRange || "daily";
        rangeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
        await drawHistory(state, data.history?.[state.rangeMode] || [], state.rangeMode);
      });
    });
  }

  async function paintInvestPage(state, data) {
    destroyCharts(state);
    const content = document.getElementById("content");
    const holdings = data.holdings || [];
    const changeClass =
      data.changeKrw > 0 ? "is-up" : data.changeKrw < 0 ? "is-down" : "";

    content.className = "hero hero--invest";
    content.innerHTML = `
      <div class="invest-header">
        <div>
          <span class="badge">내 자산</span>
          <h2>투자 현황</h2>
          <p>전일 종가 기준으로 평가합니다. 수량·금액은 시세로 서로 자동 환산됩니다.</p>
        </div>
      </div>

      <div class="invest-layout invest-layout--stack">
        <section class="invest-chart-card">
          <div class="invest-total-panel ${changeClass}" id="invest-total-panel">
            <div class="invest-total-head">
              <div class="invest-total-summary">
                <span class="invest-total-label">투자 총액</span>
                <strong>${formatKrw(data.totalKrw)}</strong>
                <span class="invest-total-change">${formatSignedKrw(data.changeKrw)} (${formatPct(data.changePct)})</span>
              </div>
              <div class="invest-range-tabs">
                <button type="button" class="invest-range-btn is-active" data-invest-range="daily">일간</button>
                <button type="button" class="invest-range-btn" data-invest-range="weekly">주간</button>
                <button type="button" class="invest-range-btn" data-invest-range="monthly">월간</button>
              </div>
            </div>
            <div class="invest-line-wrap">
              <canvas id="invest-line" aria-label="투자 총액 증감 그래프"></canvas>
            </div>
          </div>

          <h3 class="invest-pie-title">자산 비율</h3>
          <div class="invest-pie-wrap">
            <canvas id="invest-pie" aria-label="자산 비율 원형 그래프"></canvas>
          </div>
          <p class="invest-note">예시 기본값: 테슬라 / 삼성전자 / 나머지(현금). 시세·수량에 따라 비율이 달라집니다.</p>
        </section>

        <section class="invest-side">
          <h3>보유 종목</h3>
          ${holdingsListHtml(holdings)}

          <form class="invest-add-form" id="invest-add-form">
            <h3>종목 추가</h3>
            <div class="invest-form-grid">
              <label>
                종목명
                <input name="holdingName" type="text" maxlength="80" placeholder="테슬라, 삼성전자, 애플…" required />
              </label>
              <label class="invest-cash-check">
                <span>유형</span>
                <select name="asCash">
                  <option value="0">주식/ETF (심볼 자동)</option>
                  <option value="1">현금/기타</option>
                </select>
              </label>
              <label>
                수량(주)
                <input name="shares" type="number" min="0" step="any" placeholder="10" />
              </label>
              <label>
                금액(원)
                <input name="costKrw" type="number" min="0" step="1" placeholder="시세로 자동 환산" />
              </label>
            </div>
            <p class="invest-quote-hint" id="invest-quote-hint" aria-live="polite"></p>
            <p class="invest-help">종목명 입력 후 수량 또는 금액 중 하나만 넣어도 다른 쪽이 시세로 채워집니다.</p>
            <button type="submit" class="invest-submit">추가</button>
            <p class="blog-status" id="invest-form-status" aria-live="polite"></p>
          </form>
        </section>
      </div>
    `;

    await drawPie(state, holdings);
    bindInvestUi(state, data);
  }

  async function renderInvestContent() {
    const content = document.getElementById("content");
    const state = {
      pieChart: null,
      lineChart: null,
      rangeMode: "daily",
    };

    content.className = "hero hero--invest";
    content.innerHTML = `
      <span class="badge">내 자산</span>
      <h2>투자 현황</h2>
      <p class="media-loading">불러오는 중...</p>
    `;

    try {
      const auth = (await window.fetchBlogAuthStatus?.()) || { authenticated: false };

      if (!auth.authenticated) {
        renderLoginGate(content);
        return;
      }

      const data = await fetchPortfolio();

      if (data.authenticated === false) {
        renderLoginGate(content);
        return;
      }

      await paintInvestPage(state, data);
    } catch (error) {
      content.innerHTML = `
        <span class="badge">내 자산</span>
        <h2>투자 현황</h2>
        <p class="blog-status error">${window.escapeHtml?.(error.message) || error.message}</p>
        <p>로컬에서는 PHP API와 외부 시세 호출이 필요합니다. NAS에 배포된 주소로 확인해 주세요.</p>
      `;
    }
  }

  window.renderInvestContent = renderInvestContent;

  if (typeof window.__retryRouteIfNeeded === "function") {
    window.__retryRouteIfNeeded();
  } else if ((location.hash || "").replace(/^#/, "") === "invest") {
    renderInvestContent();
  }
})();
