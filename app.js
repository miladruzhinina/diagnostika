/* ===========================
   ДИАГНОСТИКА «БАЛАНС ВЕСОВ»
   app.js v3 — красивые весы, кнопка «уже есть игра»
   =========================== */

// ── Состояние ─────────────────────────────────────────────────────────────
const state = {
  hasKids: null,
  spheres: [],
  scores: {},
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
    if (tg.colorScheme === 'dark') {
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

  if (current) {
    current.classList.add('exiting');
    setTimeout(() => current.classList.remove('active', 'exiting'), 420);
  }

  next.style.display = 'flex';
  next.getBoundingClientRect();
  next.classList.add('active');
  _activeScreenId = targetId;

  const body = next.querySelector('.screen-body');
  if (body) body.scrollTop = 0;
}

// ── Квалификатор ───────────────────────────────────────────────────────────
function showQualifier() {
  showScreen('screen-qualifier');
}

function startDiagnostics(hasKids) {
  state.hasKids  = hasKids;
  state.spheres  = hasKids ? SPHERES_WITH_KIDS : SPHERES_NO_KIDS;
  state.scores   = {};
  state.currentIdx = 0;
  showScreen('screen-intro');
}

// ── Вопросы ────────────────────────────────────────────────────────────────
function showQuestion(idx) {
  if (idx < 0)                       { showScreen('screen-intro');      return; }
  if (idx >= state.spheres.length)   { showScreen('screen-pre-result'); return; }

  state.currentIdx = idx;
  const sphere   = state.spheres[idx];
  const total    = state.spheres.length;
  const savedVal = state.scores[sphere.id] !== undefined ? state.scores[sphere.id] : 0;

  document.getElementById('q-step-label').textContent  = `${idx + 1} / ${total}`;
  document.getElementById('q-sphere-name').textContent = sphere.name;
  document.getElementById('q-question').textContent    = sphere.question;
  document.getElementById('progress-bar').style.width  = Math.round((idx / total) * 100) + '%';

  const slider = document.getElementById('q-slider');
  slider.value = savedVal;
  updateSliderUI(slider, sphere);

  document.getElementById('q-hint-minus').textContent = sphere.minus;
  document.getElementById('q-hint-plus').textContent  = sphere.plus;

  document.getElementById('question-back-btn').onclick = () => {
    if (idx === 0) showScreen('screen-intro');
    else showQuestion(idx - 1);
  };

  showScreen('screen-question');
}

// ── Слайдер ────────────────────────────────────────────────────────────────
function onSliderInput(el) {
  updateSliderUI(el, state.spheres[state.currentIdx]);
}

function updateSliderUI(el, sphere) {
  const val = parseInt(el.value, 10);

  const display = document.getElementById('q-value-display');
  display.textContent = val > 0 ? '+' + val : String(val);

  el.classList.remove('stress', 'resource');
  display.classList.remove('stress', 'resource', 'neutral');

  if (val < 0)      { el.classList.add('stress');   display.classList.add('stress'); }
  else if (val > 0) { el.classList.add('resource'); display.classList.add('resource'); }
  else              { display.classList.add('neutral'); }

  const pct        = ((val + 3) / 6) * 100;
  const centerPct  = 50;
  let gradient;
  const cs = getComputedStyle(document.documentElement);
  const stressColor   = cs.getPropertyValue('--color-stress').trim();
  const resColor      = cs.getPropertyValue('--color-resource').trim();

  if (val === 0) {
    gradient = `linear-gradient(to right, var(--color-divider) 0%, var(--color-divider) 100%)`;
  } else if (val < 0) {
    gradient = `linear-gradient(to right,
      var(--color-divider) 0%, var(--color-divider) ${pct}%,
      ${stressColor} ${pct}%, ${stressColor} ${centerPct}%,
      var(--color-divider) ${centerPct}%, var(--color-divider) 100%)`;
  } else {
    gradient = `linear-gradient(to right,
      var(--color-divider) 0%, var(--color-divider) ${centerPct}%,
      ${resColor} ${centerPct}%, ${resColor} ${pct}%,
      var(--color-divider) ${pct}%, var(--color-divider) 100%)`;
  }
  el.style.background = gradient;
}

function saveAndNext() {
  const sphere = state.spheres[state.currentIdx];
  state.scores[sphere.id] = parseInt(document.getElementById('q-slider').value, 10);
  showQuestion(state.currentIdx + 1);
}

// ── Результаты ─────────────────────────────────────────────────────────────
function showResults() {
  const spheres = state.spheres;
  const scores  = state.scores;

  const stressors = spheres.filter(s => scores[s.id] < 0).sort((a, b) => scores[a.id] - scores[b.id]);
  const neutrals  = spheres.filter(s => scores[s.id] === 0);
  const resources = spheres.filter(s => scores[s.id] > 0).sort((a, b) => scores[b.id] - scores[a.id]);

  if (stressors.length === 0) { showScreen('screen-all-positive'); return; }

  const totalStress   = stressors.reduce((s, sp) => s + Math.abs(scores[sp.id]), 0);
  const totalResource = resources.reduce((s, sp) => s + scores[sp.id], 0);

  const body = document.getElementById('results-body');
  body.innerHTML = '';

  // ── Красивые SVG-весы ─────────────────────────────────────────────────
  const maxTilt = 18;
  const diff    = totalStress - totalResource;
  const maxDiff = Math.max(totalStress + totalResource, 1);
  const tiltDeg = Math.min(Math.max((diff / maxDiff) * maxTilt, -maxTilt), maxTilt);
  const rad     = (tiltDeg * Math.PI) / 180;

  // Геометрия
  const cx = 150, cy = 40;   // опора
  const arm = 90;             // длина плеча балки
  const chainH = 26;          // длина цепи
  const bowlRx = 34, bowlRy = 10; // размер чаши

  // Концы балки после поворота
  const lx = cx - arm * Math.cos(rad), ly = cy - arm * Math.sin(rad);
  const rx = cx + arm * Math.cos(rad), ry = cy + arm * Math.sin(rad);

  // Точки подвеса чаш
  const lbx = lx, lby = ly + chainH;
  const rbx = rx, rby = ry + chainH;

  // Смещение подписей
  const labelOff = bowlRy + 16;

  const scalesWrap = document.createElement('div');
  scalesWrap.className = 'scales-result-wrap';
  scalesWrap.innerHTML = `
    <div class="scales-svg-container">
      <svg viewBox="0 0 300 180" width="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bowl-stress-fill" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="var(--color-stress)" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="var(--color-stress)" stop-opacity="0.04"/>
          </radialGradient>
          <radialGradient id="bowl-resource-fill" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="var(--color-resource)" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="var(--color-resource)" stop-opacity="0.04"/>
          </radialGradient>
          <filter id="soft-glow-s">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="soft-glow-r">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <!-- Постамент -->
        <path d="M ${cx - 4} ${cy + 1} L ${cx - 4} 150 Q ${cx} 157 ${cx + 4} 150 L ${cx + 4} ${cy + 1}"
          fill="var(--color-primary)" opacity="0.2"/>
        <path d="M ${cx - 4} ${cy + 1} L ${cx - 4} 150 Q ${cx} 157 ${cx + 4} 150 L ${cx + 4} ${cy + 1}"
          stroke="var(--color-primary)" stroke-width="1.2" fill="none" opacity="0.5"/>
        <!-- Основание -->
        <ellipse cx="${cx}" cy="152" rx="20" ry="5"
          fill="var(--color-primary)" opacity="0.15"/>
        <path d="M ${cx - 20} 152 Q ${cx} 157 ${cx + 20} 152"
          stroke="var(--color-primary)" stroke-width="1.5" opacity="0.4" fill="none"/>

        <!-- Ромб опоры -->
        <path d="M ${cx} ${cy - 7} L ${cx + 6} ${cy} L ${cx} ${cy + 7} L ${cx - 6} ${cy} Z"
          fill="var(--color-primary)" opacity="0.9"/>

        <!-- Балка -->
        <line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}"
              x2="${rx.toFixed(1)}" y2="${ry.toFixed(1)}"
          stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round"/>

        <!-- Левые цепи (3 нити) -->
        <line x1="${(lx - 9).toFixed(1)}" y1="${ly.toFixed(1)}"
              x2="${(lbx - 9).toFixed(1)}" y2="${lby.toFixed(1)}"
          stroke="var(--color-stress)" stroke-width="1" opacity="0.45"/>
        <line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}"
              x2="${lbx.toFixed(1)}" y2="${lby.toFixed(1)}"
          stroke="var(--color-stress)" stroke-width="1.2" opacity="0.7"/>
        <line x1="${(lx + 9).toFixed(1)}" y1="${ly.toFixed(1)}"
              x2="${(lbx + 9).toFixed(1)}" y2="${lby.toFixed(1)}"
          stroke="var(--color-stress)" stroke-width="1" opacity="0.45"/>

        <!-- Левая чаша: заливка -->
        <ellipse cx="${lbx.toFixed(1)}" cy="${lby.toFixed(1)}"
          rx="${bowlRx}" ry="${bowlRy}"
          fill="url(#bowl-stress-fill)" filter="url(#soft-glow-s)"/>
        <!-- Левая чаша: контур -->
        <ellipse cx="${lbx.toFixed(1)}" cy="${lby.toFixed(1)}"
          rx="${bowlRx}" ry="${bowlRy}"
          stroke="var(--color-stress)" stroke-width="1.8" opacity="0.85"/>
        <!-- Дно чаши -->
        <path d="M ${(lbx - bowlRx).toFixed(1)} ${lby.toFixed(1)}
                 Q ${lbx.toFixed(1)} ${(lby + bowlRy * 2.4).toFixed(1)}
                   ${(lbx + bowlRx).toFixed(1)} ${lby.toFixed(1)}"
          stroke="var(--color-stress)" stroke-width="1.4" fill="none" opacity="0.4"/>

        <!-- Правые цепи -->
        <line x1="${(rx - 9).toFixed(1)}" y1="${ry.toFixed(1)}"
              x2="${(rbx - 9).toFixed(1)}" y2="${rby.toFixed(1)}"
          stroke="var(--color-resource)" stroke-width="1" opacity="0.45"/>
        <line x1="${rx.toFixed(1)}" y1="${ry.toFixed(1)}"
              x2="${rbx.toFixed(1)}" y2="${rby.toFixed(1)}"
          stroke="var(--color-resource)" stroke-width="1.2" opacity="0.7"/>
        <line x1="${(rx + 9).toFixed(1)}" y1="${ry.toFixed(1)}"
              x2="${(rbx + 9).toFixed(1)}" y2="${rby.toFixed(1)}"
          stroke="var(--color-resource)" stroke-width="1" opacity="0.45"/>

        <!-- Правая чаша: заливка -->
        <ellipse cx="${rbx.toFixed(1)}" cy="${rby.toFixed(1)}"
          rx="${bowlRx}" ry="${bowlRy}"
          fill="url(#bowl-resource-fill)" filter="url(#soft-glow-r)"/>
        <!-- Правая чаша: контур -->
        <ellipse cx="${rbx.toFixed(1)}" cy="${rby.toFixed(1)}"
          rx="${bowlRx}" ry="${bowlRy}"
          stroke="var(--color-resource)" stroke-width="1.8" opacity="0.85"/>
        <path d="M ${(rbx - bowlRx).toFixed(1)} ${rby.toFixed(1)}
                 Q ${rbx.toFixed(1)} ${(rby + bowlRy * 2.4).toFixed(1)}
                   ${(rbx + bowlRx).toFixed(1)} ${rby.toFixed(1)}"
          stroke="var(--color-resource)" stroke-width="1.4" fill="none" opacity="0.4"/>

        <!-- Счёт в чашах -->
        <text x="${lbx.toFixed(1)}" y="${(lby + 5).toFixed(1)}"
          text-anchor="middle" dominant-baseline="middle"
          font-family="Cormorant Garamond, serif" font-size="14" font-weight="600"
          fill="var(--color-stress)">${totalStress > 0 ? '\u2212' + totalStress : '0'}</text>
        <text x="${rbx.toFixed(1)}" y="${(rby + 5).toFixed(1)}"
          text-anchor="middle" dominant-baseline="middle"
          font-family="Cormorant Garamond, serif" font-size="14" font-weight="600"
          fill="var(--color-resource)">${totalResource > 0 ? '+' + totalResource : '0'}</text>

        <!-- Подписи -->
        <text x="${lbx.toFixed(1)}" y="${(lby + labelOff).toFixed(1)}"
          text-anchor="middle"
          font-family="Nunito, sans-serif" font-size="8.5" font-weight="800"
          fill="var(--color-stress)" letter-spacing="0.07em" opacity="0.75">СТРЕССОРЫ</text>
        <text x="${rbx.toFixed(1)}" y="${(rby + labelOff).toFixed(1)}"
          text-anchor="middle"
          font-family="Nunito, sans-serif" font-size="8.5" font-weight="800"
          fill="var(--color-resource)" letter-spacing="0.07em" opacity="0.75">РЕСУРСЫ</text>
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
      const val    = scores[sphere.id];
      const barPct = Math.round((Math.abs(val) / 3) * 100);
      const row    = document.createElement('div');
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
  const section = document.createElement('div');
  section.className = 'stressor-section';
  section.innerHTML = `
    <p class="stressor-section-title">Выбери сферу, с которой хочешь разобраться прямо сейчас:</p>
    <div class="stressor-btns" id="stressor-btns"></div>
  `;
  body.appendChild(section);

  stressors.forEach(sphere => {
    const btn = document.createElement('button');
    btn.className = 'btn-stressor';
    btn.innerHTML = `
      <span>${sphere.name}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    `;
    btn.onclick = () => showOffer(sphere.id, sphere.name);
    section.querySelector('#stressor-btns').appendChild(btn);
  });

  showScreen('screen-results');
}

// ── Оффер ─────────────────────────────────────────────────────────────────
function showOffer(sphereId, sphereName) {
  state.selectedStressor = sphereId;

  const body = document.getElementById('offer-body');
  body.innerHTML = `
    <div class="offer-stressor-chip">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4M12 16h.01"/></svg>
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
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        <a href="${LINKS.game_page}" class="btn btn-outline" target="_blank">Узнать об игре</a>
        <button class="btn btn-ghost" onclick="showScreen('screen-has-game')" style="font-size:var(--text-xs);color:var(--color-text-faint)">У меня уже есть игра</button>
      </div>
    </div>

    <div class="final-actions">
      <button class="btn btn-ghost" onclick="downloadResults()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
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
  const { spheres, scores, selectedStressor } = state;
  const lines = ['БАЛАНС ВЕСОВ — результаты диагностики', ''];
  lines.push('Сферы:');
  spheres.forEach(s => {
    const v = scores[s.id] !== undefined ? scores[s.id] : 0;
    lines.push(`• ${s.name}: ${v > 0 ? '+' : ''}${v}`);
  });
  lines.push('');
  const stress = spheres.filter(s => scores[s.id] < 0);
  const res    = spheres.filter(s => scores[s.id] > 0);
  if (stress.length) lines.push('Стрессоры: ' + stress.map(s => s.name).join(', '));
  if (res.length)    lines.push('Ресурсы: '   + res.map(s => s.name).join(', '));
  if (selectedStressor) {
    const sp = spheres.find(s => s.id === selectedStressor);
    if (sp) lines.push('\nВыбранная сфера для работы: ' + sp.name);
  }
  lines.push('', 'Записаться на сессию: ' + LINKS.session);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'balans-vesov.txt'; a.click();
  URL.revokeObjectURL(url);
}
