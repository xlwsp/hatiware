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
    { id: 'tiikawa', name: 'ちいかわ', rarity: 'common' },
    { id: 'hatiware', name: 'ハチワレ', rarity: 'common' },
    { id: 'usagi', name: 'うさぎ', rarity: 'common' },
    { id: 'kurimanju', name: 'くりまんじゅう', rarity: 'common' },
    { id: 'rakko', name: 'ラッコ', rarity: 'common' },
    { id: 'momonga', name: 'モモンガ', rarity: 'common' },
    { id: 'kani', name: 'カニ', rarity: 'common' },
    { id: 'si-sa-', name: 'シーサー', rarity: 'common' }
];

const GACHA_COST = 500;
const PLAYER_RENDER_SIZE = 160; 
const ENEMY_RENDER_SIZE = 80;

window.onload = function() {
    // 初期化
    if (!localStorage.getItem('totalPoints')) localStorage.setItem('totalPoints', '0');
    if (!localStorage.getItem('unlockedCharacters')) localStorage.setItem('unlockedCharacters', JSON.stringify(['tiikawa']));
    if (!localStorage.getItem('selectedCharacter')) localStorage.setItem('selectedCharacter', 'tiikawa');
    if (!localStorage.getItem('claimedGifts')) localStorage.setItem('claimedGifts', JSON.stringify([]));
    if (!localStorage.getItem('characterLevels')) {
        const initialLevels = {};
        CHARACTERS.forEach(char => { initialLevels[char.id] = 0; });
        initialLevels['tiikawa'] = 20;
        localStorage.setItem('characterLevels', JSON.stringify(initialLevels));
    }
    if (!localStorage.getItem('playerName')) {
        localStorage.setItem('playerName', 'Player');
    }

    const bgm = new Audio('bgm.mp3');
    bgm.loop = true;
    bgm.volume = 0.5;

    const lobbyScreen = document.getElementById('lobby-screen');
    const gachaScreen = document.getElementById('gacha-screen');
    const lockerScreen = document.getElementById('locker-screen');
    const gameScreen = document.getElementById('game-screen');
    const pauseMenu = document.getElementById('pause-menu');
    const totalPointsDisplay = document.getElementById('total-points');
    const gachaPointsDisplay = document.getElementById('gacha-points-display');
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreElement = document.getElementById("score");
    const startBtn = document.getElementById("start-btn");
    const pullGachaBtn = document.getElementById("pull-gacha-btn");
    const pauseBtn = document.getElementById("pause-btn");
    const resumeBtn = document.getElementById("resume-btn");
    const exitBtn = document.getElementById("exit-btn");
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

    // ギフト受け取り機能
    async function checkMyGifts() {
        try {
            const snapshot = await db.collection("scores").doc(userUUID).collection("pointDistribution").get();
            
            let currentPoints = parseInt(localStorage.getItem('totalPoints')) || 0;
            let claimedGifts = JSON.parse(localStorage.getItem('claimedGifts')) || [];
            let newlyClaimed = false;

            snapshot.forEach((doc) => {
                const giftId = doc.id;
                if (!claimedGifts.includes(giftId)) {
                    const data = doc.data();
                    const addedPoints = data.points || 0;
                    
                    currentPoints += addedPoints;
                    claimedGifts.push(giftId);
                    newlyClaimed = true;
                    
                    alert(`🎁 プレゼントが届いています！\n【${giftId}】から ${addedPoints}P 受け取りました！`);
                }
            });

            if (newlyClaimed) {
                localStorage.setItem('totalPoints', currentPoints.toString());
                localStorage.setItem('claimedGifts', JSON.stringify(claimedGifts));
                updatePointsDisplay();
            }
        } catch (e) {
            console.error("ギフト確認中にエラーが発生しました:", e);
        }
    }

    // キャラの現在の「段階(1,2,3)」と「その段階内での%」を取得
    function getCharacterLevel(charId) {
        const levels = JSON.parse(localStorage.getItem('characterLevels')) || {};
        const totalAmount = levels[charId] || 0;
        
        let stage = 1;
        let percent = 0;

        if (totalAmount >= 200) {
            stage = 3; // 完凸
            percent = 100;
        } else if (totalAmount >= 100) {
            stage = 2;
            percent = totalAmount - 100;
        } else {
            stage = 1;
            percent = totalAmount;
        }
        return { stage, percent, totalAmount };
    }

    // 画像の段階（1, 2, 3）を返す
    function getCharacterImage(charId, totalAmount) {
        let stage = 1;
        if (totalAmount >= 200) stage = 3;
        else if (totalAmount >= 100) stage = 2;
        return `images/${charId}${stage}.png?v=${v}`;
    }

    function addCharacterLevel(charId, amount = 20) {
        const levels = JSON.parse(localStorage.getItem('characterLevels')) || {};
        levels[charId] = Math.min(200, (levels[charId] || 0) + amount);
        localStorage.setItem('characterLevels', JSON.stringify(levels));
        return levels[charId];
    }

    
    

    function updatePointsDisplay() {
        const points = parseInt(localStorage.getItem('totalPoints')) || 0;
        if (totalPointsDisplay) totalPointsDisplay.innerHTML = `🌟 ポイント: ${points}P`;
        if (gachaPointsDisplay) gachaPointsDisplay.innerHTML = `🌟 保有: ${points}P`;
    }

    function updateNameDisplay() {
        const nameElement = document.getElementById('current-name');
        const playerName = localStorage.getItem('playerName') || 'Player';
        if (nameElement) nameElement.textContent = playerName;
    }

    function showLobby() {
        gameState = "LOBBY";
        lobbyScreen.classList.remove('hidden');
        gachaScreen.classList.add('hidden');
        lockerScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');

        // PAUSEボタンの設定
        if (pauseBtn) {
            pauseBtn.onclick = () => {
                if (gameState === "PLAYING") {
                    gameState = "PAUSED";
                    if (pauseMenu) pauseMenu.classList.remove('hidden');
                }
            };
        }
if (exitBtn) {
    exitBtn.onclick = () => {
        if (pauseMenu) pauseMenu.classList.add('hidden');
        showLobby();
    };
}
        // つづけるボタンの設定
        if (resumeBtn) {
            resumeBtn.onclick = () => {
                if (gameState === "PAUSED") {
                    gameState = "PLAYING";
                    if (pauseMenu) pauseMenu.classList.add('hidden');
                    gameLoop();
                }
            };
        }

        // BGMや表示の更新
        bgm.pause();
        bgm.currentTime = 0;
        updatePointsDisplay();
        updateNameDisplay();
        checkMyGifts();
    } // ← ここで showLobby をしっかり閉じる

    // --- ボタン設定 ---
    document.getElementById('play-btn').onclick = () => {
        lobbyScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        gameState = "STARTING";
        resetGame();
    };

    // 1. ロビーにある「ガチャ画面へ行く」ボタン
    document.getElementById('gacha-btn').onclick = () => {
        lobbyScreen.classList.add('hidden');
        gachaScreen.classList.remove('hidden');
        document.getElementById('gacha-result').classList.add('hidden');
        updatePointsDisplay();
    };

    // 2. ガチャ画面にある「実際に引く」ボタン
    if (pullGachaBtn) {
        pullGachaBtn.onclick = () => {
            let currentPoints = parseInt(localStorage.getItem('totalPoints')) || 0;
            if (currentPoints < GACHA_COST) {
                alert("ポイントが足りないよ！");
                return;
            }

            // --- ここが重要：レベル3（合計200ポイント以上）以外のキャラを抽出 ---
            const levels = JSON.parse(localStorage.getItem('characterLevels')) || {};
            const availablePool = CHARACTERS.filter(c => (levels[c.id] || 0) < 200);

            if (availablePool.length === 0) {
                alert("すべてのキャラが完凸（レベル3）になりました！");
                return;
            }

            // ポイント消費
            currentPoints -= GACHA_COST;
            localStorage.setItem('totalPoints', currentPoints.toString());
            updatePointsDisplay();

            // 利用可能なプールからレアリティ別に抽選
            const rand = Math.random();
            let targetRarity = rand < 0.1 ? 'epic' : (rand < 0.3 ? 'rare' : 'common');
            
            let pool = availablePool.filter(c => c.rarity === targetRarity);
            // もしそのレアリティに空きがなければ、全利用可能キャラから選ぶ
            if (pool.length === 0) pool = availablePool;

            const result = pool[Math.floor(Math.random() * pool.length)];

            // 解放とポイント加算（1回のガチャで+20%）
            let unlocked = JSON.parse(localStorage.getItem('unlockedCharacters')) || ['tiikawa'];
            if (!unlocked.includes(result.id)) unlocked.push(result.id);
            localStorage.setItem('unlockedCharacters', JSON.stringify(unlocked));
            
            // レベルアップ処理（最大200まで）
            levels[result.id] = Math.min(200, (levels[result.id] || 0) + 20);
            localStorage.setItem('characterLevels', JSON.stringify(levels));

            // 結果表示
            // 結果表示
            const status = getCharacterLevel(result.id);
            const resultImgPath = getCharacterImage(result.id, status.totalAmount);

            const resultDiv = document.getElementById('gacha-result');
            const resultImgElement = document.getElementById('gacha-result-img');
            const resultNameElement = document.getElementById('gacha-result-name');
            
            if (resultDiv && resultImgElement && resultNameElement) {
                resultImgElement.src = resultImgPath;
                resultNameElement.innerText = `${result.name} (Lv.${status.stage} ${status.percent}%)`;
                resultDiv.classList.remove('hidden');
            }
            
        };
    }

    document.getElementById('locker-btn').onclick = () => {
        lobbyScreen.classList.add('hidden');
        lockerScreen.classList.remove('hidden');
        renderLocker();
    };

    // 戻るボタン（存在をチェックしてから設定）
    const btnBackGacha = document.getElementById('back-from-gacha-btn');
    if (btnBackGacha) btnBackGacha.onclick = showLobby;

    const btnBackLocker = document.getElementById('back-from-locker-btn');
    if (btnBackLocker) btnBackLocker.onclick = showLobby;

    const btnBackLobby = document.getElementById('back-to-lobby-btn');
    if (btnBackLobby) btnBackLobby.onclick = showLobby;

    // 名前変更ボタン（HTMLにないので、エラーが出ないようにチェックを入れる）
    const btnChangeName = document.getElementById('change-name-btn');
    if (btnChangeName) {
        btnChangeName.onclick = () => {
            const currentName = localStorage.getItem('playerName') || 'Player';
            const newName = prompt('新しい名前を入力してね！', currentName);
            if (newName && newName.trim() !== '') {
                localStorage.setItem('playerName', newName.trim());
                updateNameDisplay();
            }
        };
    }
    // --- ボタン設定の書き換え（ここまで） ---

    function renderLocker() {
        const grid = document.getElementById('character-grid');
        grid.innerHTML = '';
        const unlocked = JSON.parse(localStorage.getItem('unlockedCharacters')) || ['tiikawa'];
        const selected = localStorage.getItem('selectedCharacter');
        const levels = JSON.parse(localStorage.getItem('characterLevels')) || {};
        
        CHARACTERS.forEach(char => {
            const card = document.createElement('div');
            const isUnlocked = unlocked.includes(char.id);
            
            // ★修正ポイント：新しく作った getCharacterLevel 関数を使って状態を取得
            const status = getCharacterLevel(char.id); 
            const isSelected = char.id === selected;
            
            card.className = `character-card ${isUnlocked ? '' : 'locked'} ${isSelected ? 'selected' : ''}`;
            
            let nameDisplay = isUnlocked ? char.name : '???';
            // 未解放キャラの画像にも images/ をつける
            const imgSrc = isUnlocked ? getCharacterImage(char.id, status.totalAmount) : `images/${char.id}1.png?v=${v}`;
            
            // ★修正ポイント：表示テキストを Lv と % に分ける
            // 完凸(stage 3)なら MAX、それ以外は現在の段階の % を表示
            const percentText = status.stage === 3 ? "MAX ✨" : `${status.percent}%`;

            card.innerHTML = `
                <img src="${imgSrc}">
                <span>${nameDisplay}</span>
                ${isUnlocked ? `
                    <div class="level-gauge-small">
                        <div class="level-gauge-fill-small" style="width: ${status.percent}%"></div>
                    </div>
                    <span class="level-percent">Lv.${status.stage} : ${percentText}</span>
                ` : ''}
            `;
            
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
        if (pauseBtn) pauseBtn.style.display = "none";
        
        const selectedId = localStorage.getItem('selectedCharacter');
        const selectedChar = CHARACTERS.find(c => c.id === selectedId);
        const level = getCharacterLevel(selectedId);
        playerImg = new Image();
        playerImg.src = getCharacterImage(selectedId, level);
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
            if (gameState !== "COUNTDOWN") return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (bgImg.complete) {
                ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
            }
            
            if (playerImg.complete) {
                const selectedId = localStorage.getItem('selectedCharacter');
                const level = getCharacterLevel(selectedId);
                const isMaxed = level >= 100;
                
                ctx.save();
                
                if (isMaxed) {
                    const time = Date.now() / 1000;
                    ctx.shadowColor = `hsl(${(time * 180) % 360}, 100%, 70%)`;
                    ctx.shadowBlur = 30;
                } else {
                    ctx.shadowColor = "white";
                    ctx.shadowBlur = 10;
                }
                
                const offset = (PLAYER_RENDER_SIZE - player.width) / 2;
                ctx.drawImage(playerImg, player.x - offset, player.y - offset, PLAYER_RENDER_SIZE, PLAYER_RENDER_SIZE);
                ctx.restore();
            }
            
            requestAnimationFrame(drawPreGame);
        }
        
        drawPreGame();
        countdownText.innerText = count;
        
        const timer = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(timer);
                countdownText.innerText = "";
                gameState = "PLAYING";
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
        if (pauseBtn) pauseBtn.style.display = "none";
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
            alert(`おつかれさま！！\n📏 距離: ${currentDistFloor}m\n✨ ${score}P 獲得！`);
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
            const selectedId = localStorage.getItem('selectedCharacter');
            const level = getCharacterLevel(selectedId);
            const isMaxed = level >= 100;
            
            ctx.save();
            
            if (isMaxed) {
                const time = Date.now() / 1000;
                ctx.shadowColor = `hsl(${(time * 180) % 360}, 100%, 70%)`;
                ctx.shadowBlur = 30;
            } else {
                ctx.shadowColor = "white";
                ctx.shadowBlur = 10;
            }
            
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