const firebaseConfig = {
  apiKey: "AIzaSyDjYZHcGo6RiPVHlZHFFoXcMoFsx4N6d5U",
  authDomain: "hatiware-ac9f4.firebaseapp.com",
  projectId: "hatiware-ac9f4",
  storageBucket: "hatiware-ac9f4.firebasestorage.app",
  messagingSenderId: "682427412458",
  appId: "1:682427412458:web:29820bcf58816565834c93"
};

// 初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const countdownText = document.getElementById("countdown-text");
const rankingBoard = document.getElementById("ranking-board");
const rankingList = document.getElementById("ranking-list");

canvas.width = 400;
canvas.height = 600;

let gameState = "STARTING";
let score = 0;
let distance = 0;
let enemySpeed = 5;

const playerImg = new Image();
playerImg.src = 'player.png'; 
const player = { x: 160, y: 480, width: 80, height: 80 }; 
let enemies = [];

// 一時停止
pauseBtn.onclick = () => {
    if (gameState === "PLAYING") {
        gameState = "PAUSED";
        pauseBtn.innerText = "RESUME";
    } else if (gameState === "PAUSED") {
        gameState = "PLAYING";
        pauseBtn.innerText = "PAUSE";
        gameLoop(); 
    }
};

startBtn.onclick = () => {
    startBtn.style.display = "none";
    startCountdown();
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

// ランキング表示（NaN対策版）
async function showRanking() {
    try {
        const snap = await db.collection("scores").orderBy("distance", "desc").limit(5).get();
        rankingList.innerHTML = "";
        
        if (snap.empty) {
            rankingList.innerHTML = "<li>ランキングデータがありません</li>";
        } else {
            snap.forEach((doc, i) => {
                const data = doc.data();
                const li = document.createElement("li");
                // NaNにならないよう、数値変換を徹底
                const d = Math.floor(Number(data.distance)) || 0;
                li.innerHTML = `<span>${i+1}. ${data.name || "匿名"}</span> <span>${d}m</span>`;
                rankingList.appendChild(li);
            });
        }
        rankingBoard.style.display = "block";
    } catch (e) {
        console.error("ランキング取得エラー:", e);
        rankingList.innerHTML = "<li>ランキングの読み込みに失敗しました</li>";
        rankingBoard.style.display = "block";
    }
}

// ゲームオーバー処理
async function handleGameOver(finalDist) {
    gameState = "GAMEOVER";
    pauseBtn.style.display = "none";
    
    // スコアを確実に数値化
    const currentDist = Math.floor(Number(finalDist)) || 0;
    
    // localStorageからベストスコアを取得。未設定なら0
    let bestScore = Math.floor(Number(localStorage.getItem("bestDistance"))) || 0;
    let playerName = localStorage.getItem("playerName") || "";

    // ハイスコア更新時（または初回）
    if (currentDist > bestScore || bestScore === 0) {
        // 名前が未設定、または更新時に名前を変えたい場合を考慮
        const newName = prompt(`新記録 ${currentDist}m！\nランキングに載せる名前を入力してください:`, playerName || "Player");
        
        if (newName) {
            playerName = newName;
            localStorage.setItem("playerName", playerName);
        } else if (!playerName) {
            playerName = "Player"; // キャンセルされた場合のデフォルト
        }

        localStorage.setItem("bestDistance", currentDist);

        try {
            // Firebaseへ保存（完了を待つ）
            await db.collection("scores").add({
                name: playerName,
                distance: currentDist,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.error("スコア保存エラー:", e);
        }
    }

    // 最新のランキングを表示
    await showRanking();
}

document.getElementById("retry-btn").onclick = () => location.reload();

function spawn() {
    if (gameState !== "PLAYING") return;
    enemies.push({ x: Math.random() * (canvas.width - 40), y: -40, w: 40, h: 40 });
}
setInterval(spawn, 500);

function gameLoop() {
    if (gameState !== "PLAYING") return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    distance += 0.2;
    const dDisplay = Math.floor(distance) || 0;
    scoreElement.innerText = `SCORE: ${score} | DIST: ${dDisplay}m`;

    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);

    for (let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        e.y += enemySpeed;
        ctx.fillStyle = "red";
        ctx.fillRect(e.x, e.y, e.w, e.h);

        if (player.x < e.x + e.w && player.x + player.width > e.x &&
            player.y < e.y + e.h && player.y + player.height > e.y) {
            handleGameOver(distance);
            return;
        }

        if (e.y > canvas.height) {
            enemies.splice(i, 1);
            i--;
            score++;
            enemySpeed += 0.05;
        }
    }
    requestAnimationFrame(gameLoop);
}

playerImg.onload = () => {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
};