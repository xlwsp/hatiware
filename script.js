// Firebaseの設定
const firebaseConfig = {
    apiKey: "AIzaSyDjYZHcGo6RiPVHlZHFFoXcMoFsx4N6d5U",
    authDomain: "hatiware-ac9f4.firebaseapp.com",
    projectId: "hatiware-ac9f4",
    storageBucket: "hatiware-ac9f4.firebasestorage.app",
    messagingSenderId: "682427412458",
    appId: "1:682427412458:web:29820bcf58816565834c93"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const CHARACTERS = [
    { id: 'tiikawa', name: 'ちいかわ', file: 'tiikawa.png', rarity: 'common' },
    { id: 'hatiware', name: 'ハチワレ', file: 'hatiware.png', rarity: 'common' },
    { id: 'usagi', name: 'うさぎ', file: 'usagi.png', rarity: 'rare' },
    { id: 'kurimanju', name: 'くりまんじゅう', file: 'kurimanju.png', rarity: 'common' },
    { id: 'rakko', name: 'ラッコ', file: 'rakko.png', rarity: 'rare' },
    { id: 'momonga', name: 'モモンガ', file: 'momonga.png', rarity: 'epic' },
    { id: 'kani', name: 'カニ', file: 'kani.png', rarity: 'common' },
    { id: 'si-sa', name: 'シーサー', file: 'si-sa-.png', rarity: 'epic' }
];

const GACHA_COST = 500;
const PLAYER_RENDER_SIZE = 160; 
const ENEMY_RENDER_SIZE = 80;

window.onload = function() {
    if (!localStorage.getItem('totalPoints')) localStorage.setItem('totalPoints', '0');
    if (!localStorage.getItem('unlockedCharacters')) localStorage.setItem('unlockedCharacters', JSON.stringify(['tiikawa']));
    if (!localStorage.getItem('selectedCharacter')) localStorage.setItem('selectedCharacter', 'tiikawa');

    const bgm = new Audio('bgm.mp3');
    bgm.loop = true;
    bgm.volume = 0.5;

    const lobbyScreen = document.getElementById('lobby-screen');
    const gachaScreen = document.getElementById('gacha-screen');
    const lockerScreen = document.getElementById('locker-screen');
    const gameScreen = document.getElementById('game-screen');
    const pauseMenu = document.getElementById('pause-menu'); // 一時停止メニュー
    const totalPointsDisplay = document.getElementById('total-points');
    const gachaPointsDisplay = document.getElementById('gacha-points-display');
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreElement = document.getElementById("score");
    const startBtn = document.getElementById("start-btn");
    const pauseBtn = document.getElementById("pause-btn");
    const resumeBtn = document.getElementById("resume-btn"); // 追加
    const exitBtn = document.getElementById("exit-btn"); // 追加
    const backToLobbyBtn = document.getElementById("back-to-lobby-btn");
    const volumeSlider = document.getElementById("volume-slider");
    const countdownText = document.getElementById("countdown-text");
    const rankingBoard = document.getElementById("ranking-board");
    const rankingList = document.getElementById("ranking-list");

    const retryBtn = document.getElementById("retry-btn");

    canvas.width = 400;
    canvas.height = 600;

    let gameState = "LOBBY";
    let score = 0;
    let distance = 0;
    let enemySpeed = 5;
    let enemies = [];
    let playerImg = new Image();

    const v = new Date().getTime();
    const enemyImg = new Image(); 
    enemyImg.src = 'gomi.png?v=' + v;
    const bgImg = new Image(); 
    bgImg.src = 'haikei.png?v=' + v;

    const player = { x: 160, y: 480, width: 60, height: 60 };

    let userUUID = localStorage.getItem("userUUID") || 'u_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("userUUID", userUUID);

    function updatePointsDisplay() {
        const points = parseInt(localStorage.getItem('totalPoints')) || 0;
        if (totalPointsDisplay) totalPointsDisplay.innerHTML = `🌟 ポイント: ${points}P`;
        if (gachaPointsDisplay) gachaPointsDisplay.innerHTML = `🌟 保有: ${points}P`;
    }

    function showLobby() {
        gameState = "LOBBY";
        lobbyScreen.classList.remove('hidden');
        gachaScreen.classList.add('hidden');
        lockerScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        if (pauseMenu) pauseMenu.classList.add('hidden'); // メニューを隠す
        bgm.pause();
        bgm.currentTime = 0;
        updatePointsDisplay();
    }

    document.getElementById('play-btn').addEventListener('click', () => {
        lobbyScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        gameState = "STARTING";
        resetGame();
    });

    // --- PAUSEボタンの動作 ---
    if (pauseBtn) {
        pauseBtn.onclick = () => {
            if (gameState === "PLAYING") {
                gameState = "PAUSED";
                if (pauseMenu) pauseMenu.classList.remove('hidden');
            }
        };
    }

    // --- メニュー内の「つづける」 ---
    if (resumeBtn) {
        resumeBtn.onclick = () => {
            gameState = "PLAYING";
            if (pauseMenu) pauseMenu.classList.add('hidden');
            gameLoop(); // 再開
        };
    }

    // --- メニュー内の「ロビーへ戻る」 ---
    if (exitBtn) {
        exitBtn.onclick = showLobby;
    }

    document.getElementById('gacha-btn').addEventListener('click', () => {
        lobbyScreen.classList.add('hidden');
        gachaScreen.classList.remove('hidden');
        document.getElementById('gacha-result').classList.add('hidden');
        updatePointsDisplay();
    });

    document.getElementById('locker-btn').addEventListener('click', () => {
        lobbyScreen.classList.add('hidden');
        lockerScreen.classList.remove('hidden');
        renderLocker();
    });

    document.getElementById('pull-gacha-btn').addEventListener('click', () => {
        const points = parseInt(localStorage.getItem('totalPoints')) || 0;
        if (points < GACHA_COST) {
            alert('ポイントが足りないよ！'); return;
        }
        localStorage.setItem('totalPoints', (points - GACHA_COST).toString());
        updatePointsDisplay();

        const roll = Math.random() * 100;
        let rarity = roll < 10 ? 'epic' : (roll < 40 ? 'rare' : 'common');
        const pool = CHARACTERS.filter(c => c.rarity === rarity);
        const result = pool[Math.floor(Math.random() * pool.length)];

        const unlocked = JSON.parse(localStorage.getItem('unlockedCharacters')) || ['tiikawa'];
        const isNew = !unlocked.includes(result.id);
        if (isNew) {
            unlocked.push(result.id);
            localStorage.setItem('unlockedCharacters', JSON.stringify(unlocked));
        }

        document.getElementById('gacha-result-img').src = result.file + '?v=' + v;
        document.getElementById('gacha-result-name').textContent = result.name + (isNew ? ' (NEW!)' : '');
        document.getElementById('gacha-result').classList.remove('hidden');
    });

    document.getElementById('back-from-gacha-btn').onclick = showLobby;
    document.getElementById('back-from-locker-btn').onclick = showLobby;

    function renderLocker() {
        const grid = document.getElementById('character-grid');
        grid.innerHTML = '';
        const unlocked = JSON.parse(localStorage.getItem('unlockedCharacters')) || ['tiikawa'];
        const selected = localStorage.getItem('selectedCharacter');
        
        CHARACTERS.forEach(char => {
            const card = document.createElement('div');
            const isUnlocked = unlocked.includes(char.id);
            card.className = `character-card ${isUnlocked ? '' : 'locked'} ${char.id === selected ? 'selected' : ''}`;
            card.innerHTML = `<img src="${char.file}?v=${v}"><span>${isUnlocked ? char.name : '???'}</span>`;
            if (isUnlocked) {
                card.onclick = () => {
                    localStorage.setItem('selectedCharacter', char.id);
                    renderLocker();
                };
            }
            grid.appendChild(card);
        });
    }

    function resetGame() {
        score = 0; distance = 0; enemySpeed = 5; enemies = []; player.x = 160;
        scoreElement.innerText = `SCORE: 0 | DIST: 0m`;
        rankingBoard.style.display = 'none';
        if (retryBtn) retryBtn.style.display = 'none';
        backToLobbyBtn.style.display = 'none';
        if (pauseMenu) pauseMenu.classList.add('hidden');
        if (pauseBtn) pauseBtn.style.display = "none"; // 最初は隠す
        
        const selectedId = localStorage.getItem('selectedCharacter');
        const selectedChar = CHARACTERS.find(c => c.id === selectedId);
        playerImg = new Image();
        playerImg.src = selectedChar.file + '?v=' + v;
        startBtn.style.display = "block";
    }

    startBtn.onclick = () => {
        bgm.play().catch(() => {});
        startBtn.style.display = "none";
        startCountdown();
    };

    if (retryBtn) {
        retryBtn.onclick = () => { resetGame(); };
    }

    backToLobbyBtn.onclick = showLobby;
    volumeSlider.oninput = (e) => { bgm.volume = e.target.value; };

    function startCountdown() {
        gameState = "COUNTDOWN";
        let count = 3;
function drawPreGame() {
            if (gameState !== "COUNTDOWN") return; // カウントダウンが終わったら終了
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 背景を描く
            if (bgImg.complete) {
                ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
            }
            
            // プレイヤーを描く（サイズ160の設定を維持）
            if (playerImg.complete) {
                ctx.save();
                ctx.shadowColor = "white";
                ctx.shadowBlur = 10;
                const offset = (PLAYER_RENDER_SIZE - player.width) / 2;
                ctx.drawImage(playerImg, player.x - offset, player.y - offset, PLAYER_RENDER_SIZE, PLAYER_RENDER_SIZE);
                ctx.restore();
            }
            
            requestAnimationFrame(drawPreGame);
        }
        drawPreGame(); // 描画開始
        countdownText.innerText = count;
        const timer = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(timer);
                countdownText.innerText = "";
                gameState = "PLAYING";
                
                // --- ここでPAUSEボタンを確実に表示する ---
                if (pauseBtn) pauseBtn.style.display = "block"; 
                
                gameLoop();
            } else {
                countdownText.innerText = count;
            }
        }, 1000);
    }

    function move(clientX) {
        if (gameState !== "PLAYING") return;
        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * (canvas.width / rect.width) - player.width / 2;
        player.x = Math.max(0, Math.min(canvas.width - player.width, x));
    }

    canvas.addEventListener("mousemove", (e) => move(e.clientX));
    canvas.addEventListener("touchmove", (e) => {
        move(e.touches[0].clientX);
        e.preventDefault();
    }, { passive: false });

    async function showRanking() {
        try {
            const snap = await db.collection("scores").orderBy("distance", "desc").get();
            rankingList.innerHTML = "";
            let i = 1;
            snap.forEach(doc => {
                const data = doc.data();
                const li = document.createElement("li");
                li.innerHTML = `<span>${i}位. ${data.name || "Player"}</span> <span>${Math.floor(data.distance)}m</span>`;
                rankingList.appendChild(li);
                i++;
            });
            rankingBoard.style.display = "block";
            if (retryBtn) retryBtn.style.display = "block";
            backToLobbyBtn.style.display = "block";
        } catch (e) {
            console.error(e);
            if (retryBtn) retryBtn.style.display = "block";
            backToLobbyBtn.style.display = "block";
        }
    }

    async function handleGameOver(finalDist) {
        gameState = "GAMEOVER";
        if (pauseBtn) pauseBtn.style.display = "none"; // 終了時は隠す
        const currentPoints = parseInt(localStorage.getItem('totalPoints')) || 0;
        localStorage.setItem('totalPoints', (currentPoints + score).toString());
        
        const best = Number(localStorage.getItem("bestDistance")) || 0;
        const currentDistFloor = Math.floor(finalDist);

        if (currentDistFloor > best) {
            const name = prompt(`🎉 新記録！ ${currentDistFloor}m\n✨ ${score}P 獲得！`, localStorage.getItem("playerName") || "Player");
            const finalName = name || "Player";
            localStorage.setItem("playerName", finalName);
            localStorage.setItem("bestDistance", currentDistFloor);
            try {
                await db.collection("scores").doc(userUUID).set({
                    name: finalName,
                    distance: currentDistFloor,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch(e) { console.error(e); }
        } else {
            alert(`討伐失敗！\n📏 距離: ${currentDistFloor}m\n✨ ${score}P 獲得！`);
        }
        showRanking();
    }

    function gameLoop() {
        if (gameState !== "PLAYING") return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (bgImg.complete) {
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        }

        if (playerImg && playerImg.complete) {
            ctx.save();
            ctx.shadowColor = "white";
            ctx.shadowBlur = 10;
            const offset = (PLAYER_RENDER_SIZE - player.width) / 2;
            ctx.drawImage(playerImg, player.x - offset, player.y - offset, PLAYER_RENDER_SIZE, PLAYER_RENDER_SIZE);
            ctx.restore();
        }

        for (let i = 0; i < enemies.length; i++) {
            let e = enemies[i];
            e.y += enemySpeed;
            if (enemyImg.complete) {
                ctx.save();
                ctx.shadowColor = "white";
                ctx.shadowBlur = 10;
                const eOffset = (ENEMY_RENDER_SIZE - e.w) / 2;
                ctx.drawImage(enemyImg, e.x - eOffset, e.y - eOffset, ENEMY_RENDER_SIZE, ENEMY_RENDER_SIZE);
                ctx.restore();
            }

            if (player.x < e.x + e.w && player.x + player.width > e.x &&
                player.y < e.y + e.h && player.y + player.height > e.y) {
                handleGameOver(distance);
                return;
            }

            if (e.y > canvas.height + 100) {
                enemies.splice(i, 1);
                i--;
                score++;
                enemySpeed += 0.08;
            }
        }
        distance += 0.2;
        scoreElement.innerText = `SCORE: ${score} | DIST: ${Math.floor(distance)}m`;
        requestAnimationFrame(gameLoop);
    }

    setInterval(() => {
        if (gameState === "PLAYING") {
            enemies.push({ x: Math.random() * (canvas.width - 60), y: -100, w: 60, h: 60 });
        }
    }, 800);

    updatePointsDisplay();
    showLobby();
};