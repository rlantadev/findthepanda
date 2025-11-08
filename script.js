// Başlatma ve geri butonu davranışı
document.addEventListener('DOMContentLoaded', function () {
    const startBtn = document.querySelector('.start-btn');
    const startScreen = document.querySelector('.start-screen');
    const gameScreen = document.querySelector('.game-screen');
    const backBtn = document.querySelector('.back-btn');
    const bgGif = document.querySelector('.bg-gif');
    const sign = document.querySelector('.sign');

    let currentPanda = null;

    // Proximity beep sistemi (WebAudio + zamanlama)
    let audioCtx = null;
    let lastVolume = 0;
    const PROXIMITY_SMOOTHING = 0.8;

    // Beep zamanlaması için
    let lastBeepTs = 0;
    let beepRafId = null;
    let currentProximityValue = 0; // 0..1 (1 = çok yakın)

    function setProximityVolume(target) {
        lastVolume += (target - lastVolume) * PROXIMITY_SMOOTHING;
        lastVolume = Math.max(0, Math.min(1, lastVolume));
    }

    function onMouseMoveProximity(e) {
        if (!currentPanda) return;
        const rect = currentPanda.getBoundingClientRect();
        const cx = rect.left + rect.width;
        const cy = rect.top + rect.height;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);

        // Etki alanını daraltıp eğri uygula — yakınlık hızlı artacak
        const maxDist = Math.max(window.innerWidth, window.innerHeight) * 0.60;
        let v = 1 - Math.min(dist / maxDist, 1);
        v = Math.pow(Math.max(0, v), 2); // keskin artış
        currentProximityValue = v;
        setProximityVolume(v);
    }

    function playBeep() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        // frekansı proximity'ye göre hafifçe değiştir
        osc.frequency.value = 600 + (currentProximityValue * 1000);
        // küçük başlangıç değeri ile ramp yap
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.08, 0.6 * currentProximityValue), now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    // Beep döngüsü — proximity'ye göre zamanlama hesaplar
    function beepLoop() {
        const nowMs = performance.now();
        const MIN_INTERVAL = 50;   // çok yakınken (ms)
        const MAX_INTERVAL = 800;  // çok uzakken (ms)
        const interval = MAX_INTERVAL - (currentProximityValue * (MAX_INTERVAL - MIN_INTERVAL));

        if (nowMs - lastBeepTs >= interval) {
            lastBeepTs = nowMs;
            playBeep();
        }
        beepRafId = requestAnimationFrame(beepLoop);
    }

    function initProximityAudio() {
        if (audioCtx) return;
        // AudioContext must be created/resumed on user gesture — openGame çağrısı üzerine uygun
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        document.addEventListener('mousemove', onMouseMoveProximity);
        lastBeepTs = performance.now();
        beepRafId = requestAnimationFrame(beepLoop);
    }

    function stopProximityAudio() {
        document.removeEventListener('mousemove', onMouseMoveProximity);
        if (beepRafId) {
            cancelAnimationFrame(beepRafId);
            beepRafId = null;
        }
        if (audioCtx) {
            try { audioCtx.close(); } catch (e) {}
            audioCtx = null;
        }
        lastVolume = 0;
        currentProximityValue = 0;
    }

    function spawnRandomPanda(src = 'assets/panda.png', fixedSize= 48) {
        // Önceki panda varsa kaldır
        if (currentPanda) {
            currentPanda.remove();
            currentPanda = null;
        }

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const size = fixedSize;
        const maxX = Math.max(0, vw - size);
        const maxY = Math.max(0, vh - size);
        const left = Math.floor(Math.random() * (maxX + 1));
        const top = Math.floor(Math.random() * (maxY + 1));

        const img = document.createElement('img');

        img.src = src;
        img.className = 'panda-img';
        img.alt = 'panda';
        img.style.width = size + 'px';
        img.style.height = size + 'px';
        img.style.position = 'fixed';
        img.style.zIndex = '1000';
        img.style.left = left + 'px';
        img.style.top = top + 'px';
        img.style.pointerEvents = 'auto';
        img.style.opacity = '1.0';
        img.style.cursor = 'pointer';
        img.style.transition = 'transform 450ms cubic-bezier(.2,.9,.2,1), opacity 300ms ease';
        img.style.transformOrigin = 'center center';

        let clicked = false;

        img.addEventListener('click', function () {
                          const timeInGame = gameStartTs ? (Date.now() - gameStartTs) : 0;
             if (window.gtag) {
             gtag('event', 'found_panda', { time_in_game_ms: timeInGame });
            }
            if (clicked) return;
            clicked = true;
            img.style.pointerEvents = 'none';
            img.style.opacity = '1.0';

            // hedef: ekranın ortası
            const centerX = Math.round(window.innerWidth / 2);
            const centerY = Math.round(window.innerHeight / 2);

            // img merkez koordinatı
            const imgCenterX = left + size / 2;
            const imgCenterY = top + size / 2;

            // translate mesafesi
            const deltaX = centerX - imgCenterX;
            const deltaY = centerY - imgCenterY;

            // büyütme katsayısı
            const scale = 3;

            requestAnimationFrame(() => {
                img.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
                // sesi kapat
                currentProximityValue = 0;
            });

            setTimeout(() => {
                alert('You found the panda! Congratulations!');
                closeGame();
            }, 500);
        });

        document.body.appendChild(img);

        currentPanda = img;
        return img;
    }

    function openGame() {
        if (!startScreen || !gameScreen) return;
        // gizle başlangıcı
        startScreen.style.display = 'none';
        startScreen.setAttribute('aria-hidden', 'true');

        if (bgGif) {
            bgGif.style.display = 'none';
            bgGif.setAttribute('aria-hidden', 'true');
        }

        if (sign) {
            sign.style.display = 'none';
            sign.setAttribute('aria-hidden', 'true');
        }

        // göster oyun ekranını
        gameScreen.style.display = 'flex';
        gameScreen.setAttribute('aria-hidden', 'false');
        gameScreen.querySelector('.game-content')?.focus?.();

        spawnRandomPanda();
        gameStartTs = Date.now();
        if (window.gtag) gtag('event', 'start_game', { method: 'ui_button' });
        initProximityAudio();
    }

    function closeGame() {
          const timeInGame = gameStartTs ? (Date.now() - gameStartTs) : 0;
  if (window.gtag) gtag('event', 'exit_game', { time_in_game_ms: timeInGame });
  gameStartTs = null;
        if (currentPanda) {
            currentPanda.remove();
            currentPanda = null;
        }

        stopProximityAudio();

        if (!startScreen || !gameScreen) return;
        gameScreen.style.display = 'none';
        gameScreen.setAttribute('aria-hidden', 'true');

        if (sign) {
            sign.style.display = 'block';
            sign.setAttribute('aria-hidden', 'false');
        }
        if (bgGif) {
            bgGif.style.display = 'block';
            bgGif.setAttribute('aria-hidden', 'false');
        }

        startScreen.style.display = 'block';
        startScreen.setAttribute('aria-hidden', 'false');
        startBtn.focus();
    }

    startBtn?.addEventListener('click', openGame);
    backBtn?.addEventListener('click', closeGame);
});

window.addEventListener('beforeunload', function () {
  const timeOnPage = Date.now() - pageStartTs;
  if (window.gtag) {
    // not: beforeunload içinde gtag her zaman iletilmeyebilir
    gtag('event', 'time_on_page', { time_on_page_ms: timeOnPage });
  }
});