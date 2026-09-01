(() => {
  const PIE_COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb7185", "#2dd4bf"];

  function formatKrw(value) {
    const num = Math.round(Number(value) || 0);
    return `${num.toLocaleString("ko-KR")}원`;
  }

  /** 금액을 한글로 읽기: 123456789 → 일억 이천삼백사십오만 육천칠백팔십구 원 */
  function formatKrwHangul(value) {
    const amount = Math.round(Math.abs(Number(value) || 0));
    if (!(amount > 0)) return "";

    const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    const small = ["", "십", "백", "천"];
    const big = ["", "만", "억", "조"];

    const chunkToHangul = (n) => {
      if (n <= 0) return "";
      let s = "";
      const str = String(n).padStart(4, "0");
      for (let i = 0; i < 4; i++) {
        const d = Number(str[i]);
        if (!d) continue;
        const unit = small[3 - i];
        if (d === 1 && unit) {
          s += unit;
        } else {
          s += digits[d] + unit;
        }
      }
      return s;
    };

    let n = amount;
    const parts = [];
    let bigIdx = 0;

    while (n > 0 && bigIdx < big.length) {
      const chunk = n % 10000;
      if (chunk > 0) {
        parts.unshift(chunkToHangul(chunk) + big[bigIdx]);
      }
      n = Math.floor(n / 10000);
      bigIdx += 1;
    }

    const body = parts.join(" ").replace(/\s+/g, " ").trim();
    const prefix = Number(value) < 0 ? "마이너스 " : "";
    return `${prefix}${body} 원`;
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
    if (state.sparkChart) {
      state.sparkChart.destroy();
      state.sparkChart = null;
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

  function sortHoldingsByValue(holdings, mode) {
    const list = Array.isArray(holdings) ? holdings.slice() : [];
    const desc = mode !== "value-asc";
    list.sort((a, b) => {
      const av = Number(a?.valueKrw) || 0;
      const bv = Number(b?.valueKrw) || 0;
      if (bv === av) {
        return String(a?.name || "").localeCompare(String(b?.name || ""), "ko");
      }
      return desc ? bv - av : av - bv;
    });
    return list;
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
            const isCash = item.symbol === "CASH";
            const logo = String(item.logoUrl || "").trim();
            const symbol = String(item.symbol || "");
            const rawName = String(item.name || "");
            let shownName = rawName;
            if (symbol && symbol !== "CASH") {
              const wrapped = " (" + symbol + ")";
              if (shownName.endsWith(wrapped)) shownName = shownName.slice(0, -wrapped.length).trim();
              else if (shownName.endsWith("(" + symbol + ")")) shownName = shownName.slice(0, -(("(" + symbol + ")").length)).trim();
            }
            const initial = (shownName || item.symbol || "?").trim().charAt(0);
            const logoHtml = isCash
              ? `<span class="invest-item-logo invest-item-logo--cash" aria-hidden="true">₩</span>`
              : logo
                ? `<img class="invest-item-logo" src="${window.escapeHtml?.(logo) || logo}" alt="" width="32" height="32" loading="lazy" decoding="async" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'invest-item-logo invest-item-logo--fallback',textContent:${JSON.stringify(initial)},ariaHidden:'true'}))" />`
                : `<span class="invest-item-logo invest-item-logo--fallback" aria-hidden="true">${window.escapeHtml?.(initial) || initial}</span>`;

            const editPayload = encodeURIComponent(
              JSON.stringify({
                id: item.id,
                name: item.name,
                symbol: item.symbol,
                shares: item.shares,
                costKrw: isCash ? item.valueKrw : item.costKrw > 0 ? item.costKrw : item.valueKrw,
                asCash: isCash,
              })
            );

            const sparkAttrs = isCash
              ? ""
              : ` data-symbol="${window.escapeHtml?.(symbol) || symbol}" data-name="${window.escapeHtml?.(shownName) || shownName}"`;

            return `
              <li class="invest-item${isCash ? "" : " invest-item--chart"}" data-id="${window.escapeHtml?.(item.id) || item.id}"${sparkAttrs}>
                ${logoHtml}
                <div class="invest-item-main">
                  <strong>${window.escapeHtml?.(shownName) || shownName}</strong>
                  <span class="invest-item-symbol">${window.escapeHtml?.(item.symbol) || item.symbol}</span>
                </div>
                <div class="invest-item-quote">${isCash ? quoteNote : `${Number(item.shares).toLocaleString("ko-KR")}주 · ${quoteNote}`}</div>
                <div class="invest-item-value">
                  <strong>${formatKrw(item.valueKrw)}</strong>
                  <span class="invest-item-weight">${item.weight.toFixed(1)}%</span>
                </div>
                <button type="button" class="invest-edit-btn" data-edit="${editPayload}" aria-label="수정">수정</button>
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
    const values = valuesOrZero(series);
    const labelText = mode === "daily" ? "일간 총액" : mode === "weekly" ? "주간 총액" : "월간 총액";

    state.lineChart = new Chart(canvas, {
      data: {
        labels: labels.length ? labels : ["데이터 없음"],
        datasets: [
          {
            type: "bar",
            label: labelText,
            data: values,
            backgroundColor: "rgba(56, 189, 248, 0.35)",
            borderColor: "#38bdf8",
            borderWidth: 1,
            borderRadius: 4,
            maxBarThickness: 36,
            order: 2,
          },
          {
            type: "line",
            label: `${labelText} 추세`,
            data: values,
            borderColor: "#7dd3fc",
            backgroundColor: "transparent",
            borderWidth: 2,
            fill: false,
            tension: 0.25,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: "#38bdf8",
            pointBorderColor: "#e2e8f0",
            pointBorderWidth: 1,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            ticks: { color: "#94a3b8", maxRotation: 0 },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#94a3b8",
              maxTicksLimit: 5,
              callback(value) {
                const man = Number(value) / 10000;
                return `${man.toLocaleString("ko-KR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}만`;
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
                if (context.dataset.type === "line") return null;
                const man = Number(context.raw || 0) / 10000;
                return `${man.toLocaleString("ko-KR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}만원`;
              },
            },
          },
        },
      },
    });
  }

  function valuesOrZero(series) {
    const values = (series || []).map((p) => Number(p.totalKrw) || 0);
    return values.length ? values : [0];
  }

  async function fetchQuoteForName(name) {
    const query = String(name || "").trim();
    if (!query) return null;

    const params = new URLSearchParams({
      mode: "quote",
      q: query,
      v: String(Date.now()),
    });
    const response = await fetch(`api/portfolio.php?${params.toString()}`, {
      headers: window.blogAuthHeaders?.() || {},
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      throw new Error("로그인이 필요합니다.");
    }

    if (!response.ok || !data?.ok) {
      const detail = data?.detail ? ` — ${data.detail}` : data?.symbol ? ` (${data.symbol})` : "";
      throw new Error((data?.error || "시세를 불러오지 못했습니다.") + detail);
    }

    return data;
  }

  function bindSharesCostSync(form) {
    const nameInput = form.querySelector("[name='holdingName']");
    const sharesInput = form.querySelector("[name='shares']");
    const costInput = form.querySelector("[name='costKrw']");
    const asCashInput = form.querySelector("[name='asCash']");
    const quoteHint = form.querySelector("#invest-quote-hint");
    const amountHangul = form.querySelector("#invest-amount-hangul");

    let priceKrw = 0;
    let syncLock = false;
    let quoteTimer = null;
    let quoteRequestId = 0;
    let lastQuotedName = "";
    let lastEdited = ""; // "shares" | "cost"

    const isCashMode = () => {
      const name = String(nameInput?.value || "").trim();
      return asCashInput?.value === "1" || /현금|기타/i.test(name);
    };

    const updateAmountHangul = () => {
      if (!amountHangul) return;
      const cost = Number(costInput?.value || 0);
      amountHangul.textContent = cost > 0 ? formatKrwHangul(cost) : "";
    };

    const setHint = (text, isError = false) => {
      if (!quoteHint) return;
      quoteHint.textContent = text || "";
      quoteHint.className = isError ? "invest-quote-hint is-error" : "invest-quote-hint";
    };

    const writeField = (input, value) => {
      if (!input) return;
      syncLock = true;
      if (Number.isFinite(value) && value > 0) {
        const rounded = input === costInput ? Math.round(value) : Math.round(value * 10000) / 10000;
        input.value = String(rounded);
      }
      syncLock = false;
      if (input === costInput) updateAmountHangul();
    };

    const applySharesToCost = () => {
      if (!(priceKrw > 0) || isCashMode()) return false;
      const shares = Number(sharesInput?.value || 0);
      if (!(shares > 0)) return false;
      writeField(costInput, shares * priceKrw);
      return true;
    };

    const applyCostToShares = () => {
      if (!(priceKrw > 0) || isCashMode()) return false;
      const cost = Number(costInput?.value || 0);
      if (!(cost > 0)) return false;
      writeField(sharesInput, cost / priceKrw);
      return true;
    };

    const syncFromLastEdit = () => {
      if (lastEdited === "cost") {
        applyCostToShares();
      } else {
        applySharesToCost();
      }
    };

    const refreshQuote = async ({ force = false } = {}) => {
      const name = String(nameInput?.value || "").trim();

      if (isCashMode()) {
        priceKrw = 0;
        lastQuotedName = name;
        if (asCashInput) asCashInput.value = "1";
        setHint("현금/기타 · 금액만 입력");
        return false;
      }

      if (asCashInput) asCashInput.value = "0";

      if (!name) {
        priceKrw = 0;
        lastQuotedName = "";
        setHint("");
        return false;
      }

      if (!force && name === lastQuotedName && priceKrw > 0) {
        syncFromLastEdit();
        return true;
      }

      const requestId = ++quoteRequestId;
      setHint("전일종가 조회…");

      try {
        const quote = await fetchQuoteForName(name);
        if (requestId !== quoteRequestId) return false;

        if (quote.cash) {
          priceKrw = 0;
          lastQuotedName = name;
          if (asCashInput) asCashInput.value = "1";
          setHint("현금/기타 · 금액만 입력");
          return false;
        }

        priceKrw = Number(quote.priceKrw) || Number(quote.previousCloseKrw) || 0;
        lastQuotedName = name;

        if (!(priceKrw > 0)) {
          setHint("전일종가 없음", true);
          return false;
        }

        const unit = Math.round(priceKrw).toLocaleString("ko-KR");
        const fx = Number(quote.usdKrw) > 0 ? Number(quote.usdKrw) : 0;
        let hint = `${quote.symbol} · 전일종가 ${unit}원`;
        if (quote.currency && quote.currency !== "KRW" && Number(quote.price) > 0) {
          hint = `${quote.symbol} · 전일종가 ${Number(quote.price).toLocaleString("en-US")} ${quote.currency} → ${unit}원`;
          if (fx > 0) {
            hint += ` (환율 ${fx.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원)`;
          }
        }
        setHint(`${hint} · 시세 적용됨`);
        // Prefer filling the empty side from live previous-close.
        const shares = Number(sharesInput?.value || 0);
        const cost = Number(costInput?.value || 0);
        if (shares > 0) {
          lastEdited = "shares";
        } else if (cost > 0) {
          lastEdited = "cost";
        }
        syncFromLastEdit();
        updateAmountHangul();
        return true;
      } catch (error) {
        if (requestId !== quoteRequestId) return false;
        priceKrw = 0;
        lastQuotedName = "";
        setHint(error.message || "시세 조회 실패", true);
        return false;
      }
    };

    const scheduleQuote = () => {
      clearTimeout(quoteTimer);
      quoteTimer = setTimeout(() => {
        refreshQuote({ force: true });
      }, 350);
    };

    nameInput?.addEventListener("input", () => {
      priceKrw = 0;
      lastQuotedName = "";
      scheduleQuote();
    });
    nameInput?.addEventListener("change", () => refreshQuote({ force: true }));
    nameInput?.addEventListener("blur", () => refreshQuote({ force: true }));

    sharesInput?.addEventListener("input", async () => {
      if (syncLock) return;
      lastEdited = "shares";
      if (!(priceKrw > 0)) await refreshQuote({ force: true });
      applySharesToCost();
    });

    sharesInput?.addEventListener("change", async () => {
      if (syncLock) return;
      lastEdited = "shares";
      await refreshQuote({ force: !(priceKrw > 0) });
      applySharesToCost();
    });

    costInput?.addEventListener("input", async () => {
      if (syncLock) return;
      lastEdited = "cost";
      updateAmountHangul();
      if (!(priceKrw > 0)) await refreshQuote({ force: true });
      applyCostToShares();
    });

    costInput?.addEventListener("change", async () => {
      if (syncLock) return;
      lastEdited = "cost";
      updateAmountHangul();
      await refreshQuote({ force: !(priceKrw > 0) });
      applyCostToShares();
    });

    updateAmountHangul();
  }

  function setFormEditMode(form, holding) {
    const plusBtn = form.querySelector(".invest-add-plus");
    const cancel = form.querySelector("#invest-edit-cancel");
    const idInput = form.querySelector("[name='editId']");
    const nameInput = form.querySelector("[name='holdingName']");
    const sharesInput = form.querySelector("[name='shares']");
    const costInput = form.querySelector("[name='costKrw']");
    const asCashInput = form.querySelector("[name='asCash']");
    const hint = form.querySelector("#invest-quote-hint");
    const row = form.querySelector(".invest-add-row");

    if (!holding) {
      if (idInput) idInput.value = "";
      if (asCashInput) asCashInput.value = "0";
      if (plusBtn) {
        plusBtn.textContent = "+";
        plusBtn.setAttribute("aria-label", "추가");
        plusBtn.title = "추가";
      }
      cancel?.setAttribute("hidden", "");
      row?.classList.remove("is-editing");
      form.reset();
      if (asCashInput) asCashInput.value = "0";
      if (hint) {
        hint.textContent = "";
        hint.className = "invest-quote-hint";
      }
      const amountHangul = form.querySelector("#invest-amount-hangul");
      if (amountHangul) amountHangul.textContent = "";
      return;
    }

    if (idInput) idInput.value = holding.id || "";
    if (plusBtn) {
      plusBtn.textContent = "✓";
      plusBtn.setAttribute("aria-label", "저장");
      plusBtn.title = "저장";
    }
    cancel?.removeAttribute("hidden");
    row?.classList.add("is-editing");
    if (nameInput) nameInput.value = holding.name || "";
    const cash = Boolean(holding.asCash || holding.symbol === "CASH");
    if (asCashInput) asCashInput.value = cash ? "1" : "0";
    if (sharesInput) {
      sharesInput.value = cash ? "" : String(holding.shares ?? "");
    }
    if (costInput) {
      const cost = Number(holding.costKrw || holding.valueKrw || 0);
      costInput.value = cost > 0 ? String(Math.round(cost)) : "";
    }
    const amountHangul = form.querySelector("#invest-amount-hangul");
    if (amountHangul) {
      const cost = Number(costInput?.value || 0);
      amountHangul.textContent = cost > 0 ? formatKrwHangul(cost) : "";
    }
    if (hint) {
      hint.textContent = "수량·금액 수정 후 ✓";
      hint.className = "invest-quote-hint";
    }

    nameInput?.dispatchEvent(new Event("change"));
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    sharesInput?.focus();
  }


  const SPARK_PERIODS = [
    { id: "1d", label: "일간" },
    { id: "1mo", label: "월간" },
    { id: "1y", label: "연간" },
    { id: "3y", label: "3년" },
    { id: "5y", label: "5년" },
  ];
  const sparkHistoryCache = new Map();
  const sparkUi = {
    showTimer: null,
    hideTimer: null,
    period: "1mo",
    symbol: "",
    name: "",
    requestId: 0,
    bound: false,
  };

  function ensureSparkPopover() {
    let el = document.getElementById("invest-spark");
    if (el) return el;

    el = document.createElement("div");
    el.id = "invest-spark";
    el.className = "invest-spark";
    el.hidden = true;
    el.setAttribute("role", "tooltip");
    el.innerHTML = `
      <div class="invest-spark-title" id="invest-spark-title"></div>
      <div class="invest-range-tabs invest-spark-tabs" role="tablist">
        ${SPARK_PERIODS.map(
          (p) =>
            `<button type="button" class="invest-range-btn${p.id === "1mo" ? " is-active" : ""}" data-spark-period="${p.id}">${p.label}</button>`
        ).join("")}
      </div>
      <div class="invest-spark-canvas-wrap">
        <canvas id="invest-spark-canvas" height="120" aria-label="종목 가격 차트"></canvas>
      </div>
      <p class="invest-spark-status" id="invest-spark-status" aria-live="polite"></p>
    `;
    document.body.appendChild(el);
    return el;
  }

  function clearSparkTimers() {
    if (sparkUi.showTimer) {
      clearTimeout(sparkUi.showTimer);
      sparkUi.showTimer = null;
    }
    if (sparkUi.hideTimer) {
      clearTimeout(sparkUi.hideTimer);
      sparkUi.hideTimer = null;
    }
  }

  function hideSparkPopover(state) {
    clearSparkTimers();
    const el = document.getElementById("invest-spark");
    if (el) el.hidden = true;
    sparkUi.symbol = "";
    sparkUi.name = "";
    if (state?.sparkChart) {
      state.sparkChart.destroy();
      state.sparkChart = null;
    }
  }

  function positionSparkPopover(el, anchor) {
    if (!el || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(320, Math.min(340, window.innerWidth * 0.92));
    el.style.width = `${width}px`;
    const height = el.offsetHeight || 220;
    let left = rect.left;
    let top = rect.bottom + 8;

    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    if (left < 8) left = 8;

    if (top + height > window.innerHeight - 8) {
      top = rect.top - height - 8;
    }
    if (top < 8) top = 8;

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  function formatSparkAxisLabel(dateStr, period) {
    const raw = String(dateStr || "");
    if (period === "1d") {
      const time = raw.slice(11, 16);
      return time || raw.slice(5);
    }
    if (period === "1mo") {
      const m = Number(raw.slice(5, 7));
      const d = Number(raw.slice(8, 10));
      if (m && d) return `${m}/${d}`;
    }
    if (period === "1y") {
      const y = raw.slice(2, 4);
      const m = Number(raw.slice(5, 7));
      if (m) return `${y}.${m}`;
    }
    const y = raw.slice(2, 4);
    const m = raw.slice(5, 7);
    return y && m ? `${y}.${m}` : raw;
  }

  function formatSparkPrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "";
    const abs = Math.abs(num);
    const digits = abs >= 1000 ? 0 : abs >= 10 ? 2 : 3;
    return num.toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  }

  async function fetchSparkHistory(symbol, period) {
    const key = `${symbol}|${period}`;
    if (sparkHistoryCache.has(key)) {
      return sparkHistoryCache.get(key);
    }

    const params = new URLSearchParams({
      mode: "history",
      symbol,
      period,
      v: String(Date.now()),
    });
    const response = await fetch(`api/portfolio.php?${params.toString()}`, {
      headers: window.blogAuthHeaders?.() || {},
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      throw new Error("로그인이 필요합니다.");
    }
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "차트를 불러오지 못했습니다.");
    }

    sparkHistoryCache.set(key, data);
    return data;
  }

  async function drawSparkChart(state, points, period) {
    const canvas = document.getElementById("invest-spark-canvas");
    if (!canvas) return;

    const Chart = await loadChartJs();
    if (state.sparkChart) {
      state.sparkChart.destroy();
      state.sparkChart = null;
    }

    const labels = (points || []).map((p) => formatSparkAxisLabel(p.date, period));
    const values = (points || []).map((p) => Number(p.close) || 0);
    const up = values.length >= 2 && values[values.length - 1] >= values[0];
    const stroke = up ? "#34d399" : "#fb7185";

    state.sparkChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["데이터 없음"],
        datasets: [
          {
            label: "종가",
            data: values.length ? values : [0],
            borderColor: stroke,
            backgroundColor: up ? "rgba(52, 211, 153, 0.12)" : "rgba(251, 113, 133, 0.12)",
            borderWidth: 1.6,
            fill: true,
            tension: 0.25,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHitRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title(items) {
                const idx = items[0]?.dataIndex ?? 0;
                return points[idx]?.date || items[0]?.label || "";
              },
              label(context) {
                return `종가 ${formatSparkPrice(context.raw)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#94a3b8",
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 5,
              font: { size: 10 },
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: false,
            ticks: {
              color: "#94a3b8",
              maxTicksLimit: 4,
              font: { size: 10 },
              callback(value) {
                return formatSparkPrice(value);
              },
            },
            grid: { color: "rgba(148, 163, 184, 0.15)" },
          },
        },
      },
    });
  }

  async function loadSparkFor(state, symbol, name, period, anchor) {
    const popover = ensureSparkPopover();
    const title = popover.querySelector("#invest-spark-title");
    const status = popover.querySelector("#invest-spark-status");
    const requestId = ++sparkUi.requestId;

    sparkUi.symbol = symbol;
    sparkUi.name = name;
    sparkUi.period = period;

    popover.querySelectorAll("[data-spark-period]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.sparkPeriod === period);
    });
    if (title) title.textContent = name ? `${name} · ${symbol}` : symbol;
    if (status) status.textContent = "불러오는 중…";
    popover.hidden = false;
    positionSparkPopover(popover, anchor);

    try {
      const data = await fetchSparkHistory(symbol, period);
      if (requestId !== sparkUi.requestId) return;
      const points = Array.isArray(data.points) ? data.points : [];
      if (!points.length) {
        if (status) status.textContent = "표시할 시세가 없습니다.";
        if (state.sparkChart) {
          state.sparkChart.destroy();
          state.sparkChart = null;
        }
        positionSparkPopover(popover, anchor);
        return;
      }
      if (status) status.textContent = "";
      await drawSparkChart(state, points, period);
      positionSparkPopover(popover, anchor);
    } catch (error) {
      if (requestId !== sparkUi.requestId) return;
      if (status) status.textContent = error.message || "차트를 불러오지 못했습니다.";
      if (state.sparkChart) {
        state.sparkChart.destroy();
        state.sparkChart = null;
      }
      positionSparkPopover(popover, anchor);
    }
  }

  function scheduleSparkShow(state, item) {
    const symbol = String(item.dataset.symbol || "").trim();
    if (!symbol || symbol.toUpperCase() === "CASH") return;

    clearSparkTimers();
    sparkUi.showTimer = setTimeout(() => {
      sparkUi.showTimer = null;
      loadSparkFor(state, symbol, String(item.dataset.name || symbol), sparkUi.period || "1mo", item);
    }, 200);
  }

  function scheduleSparkHide(state) {
    if (sparkUi.showTimer) {
      clearTimeout(sparkUi.showTimer);
      sparkUi.showTimer = null;
    }
    if (sparkUi.hideTimer) clearTimeout(sparkUi.hideTimer);
    sparkUi.hideTimer = setTimeout(() => {
      sparkUi.hideTimer = null;
      hideSparkPopover(state);
    }, 200);
  }

  function currentSparkState() {
    return sparkUi.state || { sparkChart: null };
  }

  function bindSparkPopover(state) {
    const popover = ensureSparkPopover();
    sparkUi.state = state;
    if (sparkUi.bound) return popover;

    popover.addEventListener("mouseenter", () => {
      if (sparkUi.hideTimer) {
        clearTimeout(sparkUi.hideTimer);
        sparkUi.hideTimer = null;
      }
    });
    popover.addEventListener("mouseleave", () => scheduleSparkHide(currentSparkState()));
    popover.addEventListener("focusin", () => {
      if (sparkUi.hideTimer) {
        clearTimeout(sparkUi.hideTimer);
        sparkUi.hideTimer = null;
      }
    });
    popover.addEventListener("focusout", (event) => {
      if (popover.contains(event.relatedTarget)) return;
      scheduleSparkHide(currentSparkState());
    });
    popover.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-spark-period]");
      if (!btn) return;
      event.preventDefault();
      const period = btn.dataset.sparkPeriod || "1mo";
      sparkUi.period = period;
      popover.querySelectorAll("[data-spark-period]").forEach((item) => {
        item.classList.toggle("is-active", item === btn);
      });
      if (sparkUi.symbol) {
        const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(sparkUi.symbol) : sparkUi.symbol.replace(/"/g, '\"');
        const anchor = document.querySelector(`.invest-item--chart[data-symbol="${escaped}"]`);
        loadSparkFor(currentSparkState(), sparkUi.symbol, sparkUi.name, period, anchor || popover);
      }
    });

    sparkUi.bound = true;
    return popover;
  }

  function bindHoldingSparkHover(state) {
    bindSparkPopover(state);
    document.querySelectorAll(".invest-item--chart").forEach((item) => {
      item.addEventListener("mouseenter", () => scheduleSparkShow(state, item));
      item.addEventListener("mouseleave", (event) => {
        const popover = document.getElementById("invest-spark");
        if (popover && (popover.contains(event.relatedTarget) || event.relatedTarget === popover)) {
          return;
        }
        scheduleSparkHide(state);
      });
      item.addEventListener("focusin", () => scheduleSparkShow(state, item));
      item.addEventListener("focusout", (event) => {
        const popover = document.getElementById("invest-spark");
        if (item.contains(event.relatedTarget)) return;
        if (popover && popover.contains(event.relatedTarget)) return;
        scheduleSparkHide(state);
      });
    });
  }

  function bindInvestUi(state, data) {
    const form = document.getElementById("invest-add-form");
    const status = document.getElementById("invest-form-status");
    const totalPanel = document.getElementById("invest-total-panel");
    const rangeButtons = document.querySelectorAll("[data-invest-range]");

    if (form) {
      bindSharesCostSync(form);
    }

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector(".invest-add-plus");
      if (submit) submit.disabled = true;
      if (status) {
        status.textContent = "저장 중...";
        status.className = "blog-status";
      }

      const fd = new FormData(form);
      const name = String(fd.get("holdingName") || "").trim();
      const shares = Number(fd.get("shares") || 0);
      const costKrw = Number(fd.get("costKrw") || 0);
      const editId = String(fd.get("editId") || "").trim();
      const asCash = fd.get("asCash") === "1" || /현금|기타/i.test(name);

      const payload = {
        name,
        shares,
        costKrw,
        asCash: asCash ? 1 : 0,
      };

      if (editId) {
        payload.id = editId;
      }

      if (asCash) {
        payload.priceKrw = costKrw || shares;
      }

      try {
        const next = await mutatePortfolio("POST", payload);
        await paintInvestPage(state, next);
        const freshStatus = document.getElementById("invest-form-status");
        if (freshStatus && next.message) {
          freshStatus.className = "blog-status";
          freshStatus.textContent = next.message;
        }
      } catch (error) {
        if (status) {
          status.className = "blog-status error";
          status.textContent = error.message || "저장 실패";
        }
        if (submit) submit.disabled = false;
      }
    });

    form?.querySelector("#invest-edit-cancel")?.addEventListener("click", () => {
      setFormEditMode(form, null);
      if (status) {
        status.textContent = "";
        status.className = "blog-status";
      }
    });

    document.querySelectorAll(".invest-edit-btn").forEach((button) => {
      button.addEventListener("click", () => {
        hideSparkPopover(state);
        try {
          const holding = JSON.parse(decodeURIComponent(button.dataset.edit || ""));
          setFormEditMode(form, holding);
          if (status) {
            status.textContent = `「${holding.name}」 수정 중`;
            status.className = "blog-status";
          }
        } catch (_error) {
          alert("수정 정보를 불러오지 못했습니다.");
        }
      });
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

    document.getElementById("invest-sort-btn")?.addEventListener("click", async () => {
      state.sortMode = state.sortMode === "value-asc" ? "value-desc" : "value-asc";
      await paintInvestPage(state, data);
    });

    bindHoldingSparkHover(state);
  }

  async function paintInvestPage(state, data) {
    hideSparkPopover(state);
    destroyCharts(state);
    const content = document.getElementById("content");
    if (!state.sortMode) state.sortMode = "value-desc";
    const holdings = sortHoldingsByValue(data.holdings || [], state.sortMode);
    const sortDesc = state.sortMode !== "value-asc";
    const changeClass =
      data.changeKrw > 0 ? "is-up" : data.changeKrw < 0 ? "is-down" : "";

    content.className = "hero hero--invest";
    content.innerHTML = `
      <div class="invest-header">
        <div>
          <span class="badge">내 자산</span>
          <h2>투자 현황</h2>
        </div>
      </div>

      <div class="invest-layout invest-layout--stack">
        <section class="invest-chart-card">
          <div class="invest-total-panel ${changeClass}" id="invest-total-panel">
            <div class="invest-total-head">
              <div class="invest-total-summary">
                <span class="invest-total-label">투자 총액</span>
                <div class="invest-total-row">
                  <strong>${formatKrw(data.totalKrw)}</strong>
                  <span class="invest-total-change">${formatSignedKrw(data.changeKrw)} (${formatPct(data.changePct)})</span>
                </div>
              </div>
              <div class="invest-range-tabs">
                <button type="button" class="invest-range-btn${state.rangeMode === "daily" ? " is-active" : ""}" data-invest-range="daily">일간</button>
                <button type="button" class="invest-range-btn${state.rangeMode === "weekly" ? " is-active" : ""}" data-invest-range="weekly">주간</button>
                <button type="button" class="invest-range-btn${state.rangeMode === "monthly" ? " is-active" : ""}" data-invest-range="monthly">월간</button>
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
        </section>

        <section class="invest-side">
          <div class="invest-side-head">
            <h3>보유 종목</h3>
            <button
              type="button"
              class="invest-sort-btn"
              id="invest-sort-btn"
              data-sort="${sortDesc ? "value-desc" : "value-asc"}"
              title="금액순 정렬"
              aria-label="보유 종목 금액순 정렬"
            >금액 ${sortDesc ? "높은순 ↓" : "낮은순 ↑"}</button>
          </div>
          ${holdingsListHtml(holdings)}

          <form class="invest-add-form" id="invest-add-form" autocomplete="off">
            <input type="hidden" name="editId" value="" />
            <input type="hidden" name="asCash" value="0" />
            <div class="invest-add-row">
              <button type="submit" class="invest-add-plus" title="추가" aria-label="추가">+</button>
              <input name="holdingName" type="text" maxlength="80" placeholder="종목" required />
              <input name="shares" type="number" min="0" step="any" placeholder="수량" inputmode="decimal" />
              <input name="costKrw" type="number" min="0" step="1" placeholder="금액" inputmode="numeric" />
              <button type="button" class="invest-add-cancel" id="invest-edit-cancel" hidden title="취소" aria-label="수정 취소">×</button>
            </div>
            <div class="invest-add-meta">
              <p class="invest-quote-hint" id="invest-quote-hint" aria-live="polite"></p>
              <p class="invest-amount-hangul" id="invest-amount-hangul" aria-live="polite"></p>
            </div>
            <p class="blog-status" id="invest-form-status" aria-live="polite"></p>
          </form>
        </section>
      </div>

      <div class="invest-footer-note">
        <p class="invest-eval-note">전일 종가 기준으로 평가합니다. 수량·금액은 시세로 서로 자동 환산됩니다.</p>
        <p class="invest-fx-rate">환율 USD/KRW · ${Number(data.usdKrw || 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원${data.usdKrwSource === "fallback" ? " (참고치)" : ""}</p>
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
      sparkChart: null,
      rangeMode: "daily",
      sortMode: "value-desc",
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
