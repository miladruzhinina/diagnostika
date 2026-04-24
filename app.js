/* ===========================
   ДИАГНОСТИКА «БАЛАНС ВЕСОВ»
   app.js v2 — игровой стиль
   =========================== */

// ── Состояние ─────────────────────────────────────────────────────────────
const state = {
  hasKids: null,
  spheres: [],
  scores: {},       // { sphere_id: number }
  currentIdx: 0,
  selectedStressor: null,
};

// ── Telegram WebApp / тема ─────────────────────────────────────────────────
(function initTelegram() {
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    const colorScheme = tg.colorScheme; // 'dark' | 'light'
    if (colorScheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (_) {}
})();

// ── Навигация ──────────────────────────────────────────────────────────────
let _activeScreenId = 'screen-welcome';

function showScreen(targetId) {
  const current = document.getElementById(_activeScreenId);
  const next    = document.getElementById(targetId);
  if (!next || current === next) return;

  // Запускаем выход текущего
  if (current) {
    current.classList.add('exiting');
    setTimeout(() => {
      current.classList.remove('active', 'exiting');
    }, 420);
  }

  // Запускаем вход нового
  next.style.display = 'flex';
  // force reflow
  next.getBoundingClientRect();
  next.classList.add('active');
  _activeScreenId = targetId;

  // Прокручиваем тело экрана к началу
  const body = next.querySelector('.screen-body');
  if (body) body.scrollTop = 0;
}

// ── Квалификатор ───────────────────────────────────────────────────────────
function showQualifier() {
  showScreen('screen-qualifier');
}

function startDiagnostics(hasKids) {
  state.hasKids = hasKids;
  state.spheres = hasKids ? SPHERES_WITH_KIDS : SPHERES_NO_KIDS;
  state.scores  = {};
  state.currentIdx = 0;
  showScreen('screen-intro');
}

// ── Вопросы ────────────────────────────────────────────────────────────────
function showQuestion(idx) {
  if (idx < 0) { showScreen('screen-intro'); return; }
  if (idx >= state.spheres.length) { showScreen('screen-pre-result'); return; }

  state.currentIdx = idx;
  const sphere = state.spheres[idx];
  const total  = state.spheres.length;
  const savedVal = state.scores[sphere.id] !== undefined ? state.scores[sphere.id] : 0;

  // Заголовки
  document.getElementById('q-step-label').textContent  = `${idx + 1} / ${total}`;
  document.getElementById('q-sphere-name').textContent = sphere.name;
  document.getElementById('q-question').textContent    = sphere.question;

  // Прогресс
  const pct = Math.round((idx / total) * 100);
  document.getElementById('progress-bar').style.width  = pct + '%';

  // Слайдер
  const slider = document.getElementById('q-slider');
  slider.value = savedVal;
  updateSliderUI(slider, sphere);

  // Подсказки
  document.getElementById('q-hint-minus').textContent = sphere.minus;
  document.getElementById('q-hint-plus').textContent  = sphere.plus;

  // Кнопка назад
  const backBtn = document.getElementById('question-back-btn');
  backBtn.onclick = () => {
    if (idx === 0) showScreen('screen-intro');
    else showQuestion(idx - 1);
  };

  showScreen('screen-question');
}

// ── Слайдер ────────────────────────────────────────────────────────────────
function onSliderInput(el) {
  const sphere = state.spheres[state.currentIdx];
  updateSliderUI(el, sphere);
}

function updateSliderUI(el, sphere) {
  const val = parseInt(el.value, 10);

  // Числовой дисплей
  const display = document.getElementById('q-value-display');
  display.textContent = val > 0 ? '+' + val : val;

  // Классы цвета
  el.classList.remove('stress', 'resource');
  display.classList.remove('stress', 'resource', 'neutral');

  if (val < 0) {
    el.classList.add('stress');
    display.classList.add('stress');
  } else if (val > 0) {
    el.classList.add('resource');
    display.classList.add('resource');
  } else {
    display.classList.add('neutral');
  }

  // Градиент трека: заполнение от центра к позиции
  const pct = ((val + 3) / 6) * 100; // 0%..100%, 50% = 0
  const centerPct = 50;
  let gradient;
  if (val === 0) {
    gradient = `linear-gradient(to right, var(--color-divider) 0%, var(--color-divider) 100%)`;
  } else if (val < 0) {
    const stressColor = getComputedStyle(document.documentElement).getPropertyValue('--color-stress').trim();
    gradient = `linear-gradient(to right,
      var(--color-divider) 0%,
      var(--color-divider) ${pct}%,
      ${stressColor} ${pct}%,
      ${stressColor} ${centerPct}%,
      var(--color-divider) ${centerPct}%,
      var(--color-divider) 100%)`;
  } else {
    const resColor = getComputedStyle(document.documentElement).getPropertyValue('--color-resource').trim();
    gradient = `linear-gradient(to right,
      var(--color-divider) 0%,
      var(--color-divider) ${centerPct}%,
      ${resColor} ${centerPct}%,
      ${resColor} ${pct}%,
      var(--color-divider) ${pct}%,
      var(--color-divider) 100%)`;
  }
  el.style.background = gradient;
}

// ── Сохранить и перейти дальше ─────────────────────────────────────────────
function saveAndNext() {
  const sphere = state.spheres[state.currentIdx];
  const val    = parseInt(document.getElementById('q-slider').value, 10);
  state.scores[sphere.id] = val;
  showQuestion(state.currentIdx + 1);
}

// ── Результаты ─────────────────────────────────────────────────────────────
function showResults() {
  const spheres = state.spheres;
  const scores  = state.scores;

  // Разбиваем на группы
  const stressors  = spheres.filter(s => scores[s.id] < 0).sort((a, b) => scores[a.id] - scores[b.id]);
  const neutrals   = spheres.filter(s => scores[s.id] === 0);
  const resources  = spheres.filter(s => scores[s.id] > 0).sort((a, b) => scores[b.id] - scores[a.id]);

  // Если всё в плюсе
  if (stressors.length === 0) {
    showScreen('screen-all-positive');
    return;
  }

  const totalStress    = stressors.reduce((sum, s) => sum + Math.abs(scores[s.id]), 0);
  const totalResource  = resources.reduce((sum, s) => sum + scores[s.id], 0);

  const body = document.getElementById('results-body');
  body.innerHTML = '';

  // ── SVG Весы ──────────────────────────────────────────────────────────
  const maxTilt = 20; // градусов
  const diff    = totalStress - totalResource;
  const maxDiff = Math.max(totalStress + totalResource, 1);
  const tiltDeg = Math.min(Math.max(diff / maxDiff * maxTilt, -maxTilt), maxTilt);

  // Стрессоры тяжелее → левая чаша опускается (tiltDeg > 0 → левая ниже)
  const leftY  = 44 + tiltDeg * 0.7;
  const rightY = 44 - tiltDeg * 0.7;
  const beamAngle = tiltDeg * 0.5;

  const scalesWrap = document.createElement('div');
  scalesWrap.className = 'scales-result-wrap';
  scalesWrap.innerHTML = `
    <div class="scales-labels">
      <span class="scales-label stress">Стрессоры</span>
      <span class="scales-label resource">Ресурсы</span>
    </div>
    <div class="scales-svg-container">
      <svg viewBox="0 0 280 130" width="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Стойка -->
        <line x1="140" y1="20" x2="140" y2="110" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="140" cy="112" rx="28" ry="6" fill="var(--color-primary)" opacity="0.18"/>
        <!-- Ось вращения -->
        <circle cx="140" cy="20" r="4" fill="var(--color-primary)"/>
        <!-- Балка — поворачивается -->
        <g transform="rotate(${beamAngle.toFixed(2)}, 140, 20)">
          <line x1="40" y1="20" x2="240" y2="20" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round"/>
          <!-- Левая цепь (стрессоры) -->
          <line x1="40" y1="20" x2="40" y2="${leftY.toFixed(1)}" stroke="var(--color-stress)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 2"/>
          <!-- Левая чаша -->
          <ellipse cx="40" cy="${(leftY + 5).toFixed(1)}" rx="32" ry="9"
            fill="var(--color-stress)" opacity="0.12"/>
          <ellipse cx="40" cy="${(leftY + 5).toFixed(1)}" rx="32" ry="9"
            stroke="var(--color-stress)" stroke-width="1.5"/>
          <text x="40" y="${(leftY + 10).toFixed(1)}" text-anchor="middle"
            font-family="Cormorant Garamond, serif" font-size="11" fill="var(--color-stress)" font-weight="600">${totalStress}</text>
          <!-- Правая цепь (ресурсы) -->
          <line x1="240" y1="20" x2="240" y2="${rightY.toFixed(1)}" stroke="var(--color-resource)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 2"/>
          <!-- Правая чаша -->
          <ellipse cx="240" cy="${(rightY + 5).toFixed(1)}" rx="32" ry="9"
            fill="var(--color-resource)" opacity="0.12"/>
          <ellipse cx="240" cy="${(rightY + 5).toFixed(1)}" rx="32" ry="9"
            stroke="var(--color-resource)" stroke-width="1.5"/>
          <text x="240" y="${(rightY + 10).toFixed(1)}" text-anchor="middle"
            font-family="Cormorant Garamond, serif" font-size="11" fill="var(--color-resource)" font-weight="600">+${totalResource}</text>
        </g>
      </svg>
    </div>
  `;
  body.appendChild(scalesWrap);

  // ── Таблица сфер ───────────────────────────────────────────────────────
  function buildSection(list, type, label) {
    if (!list.length) return;
    const labelEl = document.createElement('p');
    labelEl.className = 'results-section-label';
    labelEl.textContent = label;
    body.appendChild(labelEl);

    const table = document.createElement('div');
    table.className = 'sphere-table';

    list.forEach(sphere => {
      const val     = scores[sphere.id];
      const absVal  = Math.abs(val);
      const barPct  = Math.round((absVal / 3) * 100);
      const row     = document.createElement('div');
      row.className = `sphere-row ${type}`;
      row.innerHTML = `
        <span class="sphere-row-name">${sphere.name}</span>
        <div class="sphere-bar-wrap">
          <div class="sphere-bar" style="width:${barPct}%"></div>
        </div>
        <span class="sphere-row-score">${val > 0 ? '+' + val : val}</span>
      `;
      table.appendChild(row);
    });
    body.appendChild(table);
  }

  buildSection(stressors, 'stress',   'Стрессоры — давят');
  buildSection(neutrals,  'neutral',  'Нейтральные');
  buildSection(resources, 'resource', 'Ресурсы — держат');

  // ── Выбор стрессора ───────────────────────────────────────────────────
  if (stressors.length > 0) {
    const section = document.createElement('div');
    section.className = 'stressor-section';
    section.innerHTML = `
      <p class="stressor-section-title">Выбери сферу, с которой хочешь разобраться прямо сейчас:</p>
      <div class="stressor-btns" id="stressor-btns"></div>
    `;
    body.appendChild(section);

    const btnsWrap = section.querySelector('#stressor-btns');
    stressors.forEach(sphere => {
      const btn = document.createElement('button');
      btn.className = 'btn-stressor';
      btn.innerHTML = `
        <span>${sphere.name}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      `;
      btn.onclick = () => showOffer(sphere.id, sphere.name);
      btnsWrap.appendChild(btn);
    });
  }

  showScreen('screen-results');
}

// ── Оффер ─────────────────────────────────────────────────────────────────
function showOffer(sphereId, sphereName) {
  state.selectedStressor = sphereId;

  const body = document.getElementById('offer-body');
  body.innerHTML = `
    <div class="offer-stressor-chip">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      ${sphereName}
    </div>

    <p class="offer-title">Что можно сделать с этим прямо сейчас?</p>

    <div class="offer-card">
      <p class="offer-card-title">Пробная сессия</p>
      <p class="offer-card-desc">60–90 минут один на один. Без домашних заданий, лекций и диагнозов. Разберёмся с тем, что тянет именно в этой сфере — и выйдешь с конкретным следующим шагом.</p>
      <p class="offer-card-price">2 250 ₽ <s style="font-weight:400;color:var(--color-text-faint)">4 500 ₽</s></p>
      <a href="${LINKS.session}" class="btn btn-primary" target="_blank">Записаться — 2 250 ₽</a>
    </div>

    <div class="offer-divider">или</div>

    <div class="offer-card">
      <p class="offer-card-title">Игра «С тобой всё в порядке»</p>
      <p class="offer-card-desc">Карточная игра в ОРКТ-подходе — можно пройти в одиночку или с близким человеком. Помогает увидеть ресурсы там, где их не замечаешь.</p>
      <p class="offer-card-price">1 500 ₽</p>
      <a href="${LINKS.game_page}" class="btn btn-outline" target="_blank">Узнать об игре</a>
    </div>

    <div class="final-actions">
      <button class="btn btn-ghost" onclick="downloadResults()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Сохранить результаты
      </button>
      <div class="messenger-row">
        <a href="${LINKS.telegram}" class="btn btn-ghost" target="_blank">Telegram</a>
        <a href="${LINKS.max}" class="btn btn-ghost" target="_blank">Max</a>
      </div>
    </div>
  `;

  showScreen('screen-offer');
}

// ── Скачать результаты ────────────────────────────────────────────────────
function downloadResults() {
  const spheres = state.spheres;
  const scores  = state.scores;
  const lines   = ['БАЛАНС ВЕСОВ — результаты диагностики', ''];
  lines.push('Сферы:');
  spheres.forEach(s => {
    const val = scores[s.id] !== undefined ? scores[s.id] : 0;
    const sign = val > 0 ? '+' : '';
    lines.push(`• ${s.name}: ${sign}${val}`);
  });
  lines.push('');

  const stressors = spheres.filter(s => scores[s.id] < 0);
  const resources = spheres.filter(s => scores[s.id] > 0);
  if (stressors.length) lines.push('Стрессоры: ' + stressors.map(s => s.name).join(', '));
  if (resources.length) lines.push('Ресурсы: '   + resources.map(s => s.name).join(', '));
  lines.push('');
  if (state.selectedStressor) {
    const sp = spheres.find(s => s.id === state.selectedStressor);
    if (sp) lines.push('Выбранная сфера для работы: ' + sp.name);
  }
  lines.push('');
  lines.push('Записаться на сессию: ' + LINKS.session);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'balans-vesov.txt';
  a.click();
  URL.revokeObjectURL(url);
}
