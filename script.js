const firebaseConfig = {
  apiKey: "AIzaSyDjYZHcGo6RiPVHlZHFFoXcMoFsx4N6d5U",
  authDomain: "hatiware-ac9f4.firebaseapp.com",
  projectId: "hatiware-ac9f4",
  storageBucket: "hatiware-ac9f4.firebasestorage.app",
  messagingSenderId: "682427412458",
  appId: "1:682427412458:web:29820bcf58816565834c93"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

window.onload = function() {
    // --- BGM設定 (ひとりごつ) ---
    const bgm = new Audio('bgm.mp3');
    bgm.loop = true; // 基本の無限ループ
    bgm.volume = 0.5;

    // ループの確実性を上げるための処理
    bgm.addEventListener('ended', function() {
        this.currentTime = 0;
        this.play();
    }, false);

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreElement = document.getElementById("score");
    const startBtn = document.getElementById("start-btn");
    const pauseBtn = document.getElementById("pause-btn");
    const retryBtn = document.getElementById("retry-btn");
    const volumeSlider = document.getElementById("volume-slider");
    const countdownText = document.getElementById("countdown-text");
    const rankingBoard = document.getElementById("ranking-board");
    const rankingList = document.getElementById("ranking-list");

    // 音量スライダーの監視
    volumeSlider.addEventListener("input", (e) => {
        bgm.volume = e.target.value;
    });

    canvas.width = 400;
    canvas.height = 600; 

    let gameState = "STARTING";
    let score = 0;
    let distance = 0;
    let enemySpeed = 5;

    const v = new Date().getTime();
    const playerImg = new Image(); playerImg.src = 'player.png?v=' + v; 
    const enemyImg = new Image(); enemyImg.src = 'gomi.png?v=' + v; 
    const bgImg = new Image(); bgImg.src = 'haikei.png?v=' + v;

    // 当たり判定：65 (少し小さめ)
    const player = { x: 167, y: 480, width: 65, height: 65 }; 
    let enemies = [];

    // 見た目のサイズ：90 (大きすぎずちょうどいい)
    const playerVisualSize = 90; 
    const enemyVisualSize = 90;

    let userUUID = localStorage.getItem("userUUID") || 'u_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("userUUID", userUUID);

    function drawWithOutline(img, x, y, w, h) {
        ctx.save();
        ctx.shadowColor = "white"; 
        ctx.shadowBlur = 10;
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
    }

    function drawInitial() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        const offset = (playerVisualSize - player.width) / 2;
        drawWithOutline(playerImg, player.x - offset, player.y - offset, playerVisualSize, playerVisualSize);
    }

    startBtn.addEventListener("click", () => {
        bgm.play().catch(e => console.log("Audio play blocked"));
        startBtn.style.display = "none";
        startCountdown();
    });

    retryBtn.addEventListener("click", () => location.reload());

    pauseBtn.onclick = () => {
        if (gameState === "PLAYING") {
            gameState = "PAUSED";
            bgm.pause();
            pauseBtn.innerText = "RESUME";
        } else if (gameState === "PAUSED") {
            gameState = "PLAYING";
            bgm.play();
            pauseBtn.innerText = "PAUSE";
            gameLoop(); 
        }
    };

    function startCountdown() {
        gameState = "COUNTDOWN";
        let count = 3;
        countdownText.innerText = count;
        const timer = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(timer);
                countdownText.innerText = "";
                gameState = "PLAYING";
                pauseBtn.style.display = "block";
                gameLoop();
            } else {
                countdownText.innerText = count;
            }
        }, 1000);
    }

    function move(clientX) {
        if (gameState !== "PLAYING") return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const x = (clientX - rect.left) * scaleX - player.width / 2;
        player.x = Math.max(0, Math.min(canvas.width - player.width, x));
    }

    canvas.addEventListener("mousemove", (e) => move(e.clientX));
    canvas.addEventListener("touchmove", (e) => {
        move(e.touches[0].clientX);
        e.preventDefault();
    }, { passive: false });

    async function showRanking() {
        try {
            const snap = await db.collection("scores").orderBy("distance", "desc").limit(5).get();
            rankingList.innerHTML = "";
            let i = 0;
            snap.forEach((doc) => {
                const data = doc.data();
                const li = document.createElement("li");
                li.innerHTML = `<span>${i + 1}位. ${data.name || "Player"}</span> <span>${Math.floor(data.distance)}m</span>`;
                rankingList.appendChild(li);
                i++;
            });
            rankingBoard.style.display = "block";
            retryBtn.style.display = "block";
        } catch (e) { console.error(e); }
    }

    async function handleGameOver(finalDist) {
        gameState = "GAMEOVER";
        // 負けてもBGMは流したままにする
        pauseBtn.style.display = "none";
        const currentDist = Math.floor(finalDist);
        let bestScore = Math.floor(Number(localStorage.getItem("bestDistance"))) || 0;
        let playerName = localStorage.getItem("playerName") || "";

        if (currentDist > bestScore || bestScore === 0) {
            const newName = prompt(`新記録！ ${currentDist}m\n名前を入力してね！`, playerName || "Player");
            playerName = newName || playerName || "Player";
            localStorage.setItem("playerName", playerName);
            localStorage.setItem("bestDistance", currentDist);
            try {
                await db.collection("scores").doc(userUUID).set({
                    name: playerName,
                    distance: currentDist,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) { console.error(e); }
        }
        await showRanking();
    }

    function spawn() {
        if (gameState !== "PLAYING") return;
        enemies.push({ x: Math.random() * (canvas.width - 65), y: -100, w: 65, h: 65 });
    }
    setInterval(spawn, 800); // 降る間隔を少し広めに

    function gameLoop() {
        if (gameState !== "PLAYING") return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

        const pOffset = (playerVisualSize - player.width) / 2;
        drawWithOutline(playerImg, player.x - pOffset, player.y - pOffset, playerVisualSize, playerVisualSize);

        for (let i = 0; i < enemies.length; i++) {
            let e = enemies[i];
            e.y += enemySpeed;
            const eOffset = (enemyVisualSize - e.w) / 2;
            drawWithOutline(enemyImg, e.x - eOffset, e.y - eOffset, enemyVisualSize, enemyVisualSize);

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

    let loaded = 0;
    function check() {
        loaded++;
        if (loaded === 3) drawInitial();
    }
    playerImg.onload = enemyImg.onload = bgImg.onload = check;
};