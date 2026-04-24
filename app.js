/* ===========================
   ДИАГНОСТИКА «БАЛАНС ВЕСОВ»
   app.js v6
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
    if (tg.colorScheme === 'dark')
      document.documentElement.setAttribute('data-theme', 'dark');
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
function showQualifier() { showScreen('screen-qualifier'); }

function startDiagnostics(hasKids) {
  state.hasKids  = hasKids;
  state.spheres  = hasKids ? SPHERES_WITH_KIDS : SPHERES_NO_KIDS;
  state.scores   = {};
  state.currentIdx = 0;
  showScreen('screen-intro');
}

// ── Вопросы ────────────────────────────────────────────────────────────────
function showQuestion(idx) {
  if (idx < 0)                     { showScreen('screen-intro');      return; }
  if (idx >= state.spheres.length) { showScreen('screen-pre-result'); return; }

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
  updateSliderUI(slider);

  document.getElementById('q-hint-minus').textContent = sphere.minus;
  document.getElementById('q-hint-plus').textContent  = sphere.plus;

  document.getElementById('question-back-btn').onclick = () => {
    if (idx === 0) showScreen('screen-intro');
    else showQuestion(idx - 1);
  };

  showScreen('screen-question');
}

// ── Слайдер ────────────────────────────────────────────────────────────────
function onSliderInput(el) { updateSliderUI(el); }

function updateSliderUI(el) {
  const val    = parseInt(el.value, 10);
  const display = document.getElementById('q-value-display');
  display.textContent = val > 0 ? '+' + val : String(val);

  el.classList.remove('stress', 'resource');
  display.classList.remove('stress', 'resource', 'neutral');

  if (val < 0)      { el.classList.add('stress');   display.classList.add('stress'); }
  else if (val > 0) { el.classList.add('resource'); display.classList.add('resource'); }
  else              { display.classList.add('neutral'); }

  const pct       = ((val + 3) / 6) * 100;
  const half      = 50;
  const cs        = getComputedStyle(document.documentElement);
  const sc        = cs.getPropertyValue('--color-stress').trim();
  const rc        = cs.getPropertyValue('--color-resource').trim();

  let gradient;
  if (val === 0) {
    gradient = `linear-gradient(to right, var(--color-divider) 0%, var(--color-divider) 100%)`;
  } else if (val < 0) {
    gradient = `linear-gradient(to right,
      var(--color-divider) 0%,var(--color-divider) ${pct}%,
      ${sc} ${pct}%,${sc} ${half}%,
      var(--color-divider) ${half}%,var(--color-divider) 100%)`;
  } else {
    gradient = `linear-gradient(to right,
      var(--color-divider) 0%,var(--color-divider) ${half}%,
      ${rc} ${half}%,${rc} ${pct}%,
      var(--color-divider) ${pct}%,var(--color-divider) 100%)`;
  }
  el.style.background = gradient;
}

function saveAndNext() {
  const sphere = state.spheres[state.currentIdx];
  state.scores[sphere.id] = parseInt(document.getElementById('q-slider').value, 10);
  showQuestion(state.currentIdx + 1);
}

// ── Тонкие линейные весы с настоящими чашами-дугами ──────────────────────
function buildScalesSVG(totalStress, totalResource) {
  const maxTilt = 14;
  const diff    = totalStress - totalResource;
  const maxDiff = Math.max(totalStress + totalResource, 1);
  const tiltDeg = Math.min(Math.max((diff / maxDiff) * maxTilt, -maxTilt), maxTilt);
  const rad     = (tiltDeg * Math.PI) / 180;

  // viewBox 280 × 160, центр опоры cx=140, cy=38
  const W = 280, H = 160;
  const cx = 140, cy = 38;
  const arm = 98; // плечо балки от центра

  // Концы балки (точки подвеса цепей)
  const lx = cx - arm * Math.cos(rad), ly = cy + arm * Math.sin(rad);
  const rx = cx + arm * Math.cos(rad), ry = cy - arm * Math.sin(rad);

  // Параметры цепей (3 нити — веером из точки подвеса)
  const chainH = 38;  // длина нитей
  const bowlR  = 28;  // радиус/полуширина чаши

  // Нижние точки нитей: левая, средняя, правая
  const lBL = [lx - bowlR, ly + chainH];
  const lBM = [lx,          ly + chainH * 0.88]; // средняя нить чуть короче
  const lBR = [lx + bowlR,  ly + chainH];
  const rBL = [rx - bowlR, ry + chainH];
  const rBM = [rx,          ry + chainH * 0.88];
  const rBR = [rx + bowlR,  ry + chainH];

  // Чаша — дуга через SVG arc (полукруглая снизу)
  const bowlDepth = 14; // глубина чаши
  // path: M left top → arc → right top
  function bowlPath(bl, br) {
    const mx = (bl[0] + br[0]) / 2;
    const ty = Math.min(bl[1], br[1]); // верхняя линия обода
    const by = ty + bowlDepth;          // нижняя точка дуги
    return `M ${bl[0].toFixed(1)} ${ty.toFixed(1)} Q ${mx.toFixed(1)} ${by.toFixed(1)} ${br[0].toFixed(1)} ${ty.toFixed(1)}`;
  }

  const lBowl = bowlPath(lBL, lBR);
  const rBowl = bowlPath(rBL, rBR);
  const lBowlFill = bowlPath(lBL, lBR) + ` L ${lBR[0].toFixed(1)} ${lBL[1].toFixed(1)} L ${lBL[0].toFixed(1)} ${lBL[1].toFixed(1)} Z`;
  const rBowlFill = bowlPath(rBL, rBR) + ` L ${rBR[0].toFixed(1)} ${rBL[1].toFixed(1)} L ${rBL[0].toFixed(1)} ${rBL[1].toFixed(1)} Z`;

  const labelY = Math.max(lBL[1], rBL[1]) + bowlDepth + 14;

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" fill="none" xmlns="http://www.w3.org/2000/svg">

      <!-- Столб (тонкий) -->
      <line x1="${cx}" y1="${cy + 4}" x2="${cx}" y2="${cy + 100}"
        stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round"/>

      <!-- Основание — элегантная горизонтальная черта -->
      <line x1="${cx - 22}" y1="${cy + 100}" x2="${cx + 22}" y2="${cy + 100}"
        stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round"/>
      <line x1="${cx - 14}" y1="${cy + 104}" x2="${cx + 14}" y2="${cy + 104}"
        stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>

      <!-- Центральная опора — маленький ромб -->
      <circle cx="${cx}" cy="${cy}" r="4.5" fill="var(--color-primary)"/>
      <circle cx="${cx}" cy="${cy}" r="2" fill="var(--color-bg, #f5f3ef)"/>

      <!-- Балка (тонкая линия) -->
      <line
        x1="${lx.toFixed(2)}" y1="${ly.toFixed(2)}"
        x2="${rx.toFixed(2)}" y2="${ry.toFixed(2)}"
        stroke="var(--color-primary)" stroke-width="1.8" stroke-linecap="round"/>

      <!-- Точки подвеса -->
      <circle cx="${lx.toFixed(2)}" cy="${ly.toFixed(2)}" r="2.5" fill="var(--color-primary)"/>
      <circle cx="${rx.toFixed(2)}" cy="${ry.toFixed(2)}" r="2.5" fill="var(--color-primary)"/>

      <!-- === ЛЕВЫЕ НИТИ (3 штуки, веером) === -->
      <line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${lBL[0].toFixed(1)}" y2="${lBL[1].toFixed(1)}"
        stroke="var(--color-stress)" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
      <line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${lBM[0].toFixed(1)}" y2="${lBM[1].toFixed(1)}"
        stroke="var(--color-stress)" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
      <line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${lBR[0].toFixed(1)}" y2="${lBR[1].toFixed(1)}"
        stroke="var(--color-stress)" stroke-width="1" stroke-linecap="round" opacity="0.8"/>

      <!-- === ЛЕВАЯ ЧАША === -->
      <!-- Заливка -->
      <path d="${lBowlFill}" fill="var(--color-stress)" opacity="0.1"/>
      <!-- Обод (горизонтальная линия) -->
      <line x1="${lBL[0].toFixed(1)}" y1="${lBL[1].toFixed(1)}" x2="${lBR[0].toFixed(1)}" y2="${lBR[1].toFixed(1)}"
        stroke="var(--color-stress)" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Дуга чаши -->
      <path d="${lBowl}" stroke="var(--color-stress)" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Счёт внутри чаши -->
      <text x="${lx.toFixed(1)}" y="${(lBL[1] + 6).toFixed(1)}"
        text-anchor="middle" dominant-baseline="middle"
        font-family="Cormorant Garamond, serif" font-size="13" font-weight="600"
        fill="var(--color-stress)" opacity="0.9">${totalStress > 0 ? '\u2212' + totalStress : '0'}</text>

      <!-- === ПРАВЫЕ НИТИ === -->
      <line x1="${rx.toFixed(1)}" y1="${ry.toFixed(1)}" x2="${rBL[0].toFixed(1)}" y2="${rBL[1].toFixed(1)}"
        stroke="var(--color-resource)" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
      <line x1="${rx.toFixed(1)}" y1="${ry.toFixed(1)}" x2="${rBM[0].toFixed(1)}" y2="${rBM[1].toFixed(1)}"
        stroke="var(--color-resource)" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
      <line x1="${rx.toFixed(1)}" y1="${ry.toFixed(1)}" x2="${rBR[0].toFixed(1)}" y2="${rBR[1].toFixed(1)}"
        stroke="var(--color-resource)" stroke-width="1" stroke-linecap="round" opacity="0.8"/>

      <!-- === ПРАВАЯ ЧАША === -->
      <path d="${rBowlFill}" fill="var(--color-resource)" opacity="0.1"/>
      <line x1="${rBL[0].toFixed(1)}" y1="${rBL[1].toFixed(1)}" x2="${rBR[0].toFixed(1)}" y2="${rBR[1].toFixed(1)}"
        stroke="var(--color-resource)" stroke-width="1.8" stroke-linecap="round"/>
      <path d="${rBowl}" stroke="var(--color-resource)" stroke-width="1.8" stroke-linecap="round"/>
      <text x="${rx.toFixed(1)}" y="${(rBL[1] + 6).toFixed(1)}"
        text-anchor="middle" dominant-baseline="middle"
        font-family="Cormorant Garamond, serif" font-size="13" font-weight="600"
        fill="var(--color-resource)" opacity="0.9">${totalResource > 0 ? '+' + totalResource : '0'}</text>

      <!-- Подписи под чашами -->
      <text x="${lx.toFixed(1)}" y="${labelY.toFixed(1)}"
        text-anchor="middle"
        font-family="Nunito, sans-serif" font-size="8" font-weight="800"
        fill="var(--color-stress)" letter-spacing="0.08em" opacity="0.6">СТРЕССОРЫ</text>
      <text x="${rx.toFixed(1)}" y="${labelY.toFixed(1)}"
        text-anchor="middle"
        font-family="Nunito, sans-serif" font-size="8" font-weight="800"
        fill="var(--color-resource)" letter-spacing="0.08em" opacity="0.6">РЕСУРСЫ</text>
    </svg>
  `;
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

  // ── SVG весы (стиль главного экрана) ─────────────────────────────────
  const scalesWrap = document.createElement('div');
  scalesWrap.className = 'scales-result-wrap';
  scalesWrap.innerHTML = `<div class="scales-svg-container">${buildScalesSVG(totalStress, totalResource)}</div>`;
  body.appendChild(scalesWrap);

  // ── Butterfly bars (двусторонние) вместо buildSection ──────────────────
  // Стрессоры + нейтральные слева, ресурсы справа, центр = 0
  const allSorted = [
    ...stressors,  // сортированы по возрастанию (worst first)
    ...neutrals,
    ...resources,  // сортированы по убыванию (best first)
  ];

  const butterflyWrap = document.createElement('div');
  butterflyWrap.className = 'butterfly-chart';

  allSorted.forEach(sphere => {
    const val  = scores[sphere.id];
    const type = val < 0 ? 'stress' : val > 0 ? 'resource' : 'neutral';
    const pct  = Math.round((Math.abs(val) / 3) * 100);

    const row = document.createElement('div');
    row.className = 'bf-row';
    row.innerHTML = `
      <span class="bf-name">${sphere.name}</span>
      <div class="bf-track">
        <div class="bf-bar-left ${type === 'stress' ? 'bf-stress' : ''}"
             style="width:${type === 'stress' ? pct : 0}%"></div>
        <div class="bf-center"></div>
        <div class="bf-bar-right ${type === 'resource' ? 'bf-resource' : type === 'neutral' ? 'bf-neutral' : ''}"
             style="width:${type !== 'stress' ? pct : 0}%"></div>
      </div>
      <span class="bf-score bf-score--${type}">${val > 0 ? '+' + val : val === 0 ? '0' : val}</span>
    `;
    butterflyWrap.appendChild(row);
  });

  body.appendChild(butterflyWrap);

  // ── Кнопка выбора сферы ───────────────────────────────────────────────
  const pickSection = document.createElement('div');
  pickSection.style.cssText = 'display:flex;flex-direction:column;gap:var(--space-3);padding-top:var(--space-4);border-top:1px solid var(--color-divider)';
  pickSection.innerHTML = `
    <p class="deck-hint">Выбери одну сферу — и посмотрим, что с ней можно сделать.</p>
    <button class="btn btn-primary btn-next" onclick="showPickSphere()">Выбрать одну сферу</button>
  `;
  body.appendChild(pickSection);

  showScreen('screen-results');
}

// ── Экран выбора сферы ────────────────────────────────────────────────────
function showPickSphere() {
  const spheres   = state.spheres;
  const scores    = state.scores;
  const stressors = spheres.filter(s => scores[s.id] < 0).sort((a, b) => scores[a.id] - scores[b.id]);
  const neutrals  = spheres.filter(s => scores[s.id] === 0);
  const pickable  = [...stressors, ...neutrals];

  const list = document.getElementById('pick-sphere-list');
  list.innerHTML = '';

  pickable.forEach(sphere => {
    const val  = scores[sphere.id];
    const type = val < 0 ? 'stress' : 'neutral';
    const btn  = document.createElement('button');
    btn.className = `btn-stressor ${type === 'neutral' ? 'btn-stressor-neutral' : ''}`;
    btn.innerHTML = `
      <span>${sphere.name}</span>
      <span class="sphere-row-score" style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:600">${val > 0 ? '+' + val : val}</span>
    `;
    btn.onclick = () => showOffer(sphere.id, sphere.name);
    list.appendChild(btn);
  });

  showScreen('screen-pick-sphere');
}

// ── Оффер ─────────────────────────────────────────────────────────────────
function showOffer(sphereId, sphereName) {
  state.selectedStressor = sphereId;

  const body = document.getElementById('offer-body');
  body.innerHTML = `
    <div class="offer-stressor-chip">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
      ${sphereName}
    </div>

    <p class="offer-title">Что можно сделать с этим прямо сейчас?</p>

    <!-- Сохранить результаты — сразу после заголовка -->
    <button class="btn btn-ghost" onclick="downloadResults()" style="align-self:flex-start">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Сохранить результаты
    </button>

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
        <button class="btn btn-outline" id="btn-has-game" onclick="toggleHasGame(this)">
          У меня уже есть игра
        </button>
      </div>
      <!-- Сообщение «уже есть игра» — скрыто по умолчанию -->
      <div id="has-game-msg" class="has-game-msg" style="display:none">
        <p>Отлично! Открывай ссылку на игру (в чат-боте) и начинай с колоды 2 «Предпочитаемое будущее. Как хочется?». Это не про проблему, а про то, чего ты на самом деле хочешь вместо неё.</p>
      </div>
    </div>

    <div class="final-actions">
      <div class="messenger-row">
        <a href="${LINKS.telegram}" class="btn btn-ghost" target="_blank">Telegram</a>
        <a href="${LINKS.max}" class="btn btn-ghost" target="_blank">Max</a>
      </div>
    </div>
  `;

  showScreen('screen-offer');
}

// ── Переключить сообщение "уже есть игра" ─────────────────────────────────
function toggleHasGame(btn) {
  const msg = document.getElementById('has-game-msg');
  const isOpen = msg.style.display !== 'none';
  if (isOpen) {
    msg.style.display = 'none';
    btn.classList.remove('active');
  } else {
    msg.style.display = 'block';
    btn.classList.add('active');
    // Плавный скролл к сообщению
    setTimeout(() => msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
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
    if (sp) lines.push('\nВыбранная сфера: ' + sp.name);
  }
  lines.push('', 'Записаться на сессию: ' + LINKS.session);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'balans-vesov.txt'; a.click();
  URL.revokeObjectURL(url);
}
