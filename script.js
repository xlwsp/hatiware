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

// --- ランキング表示用の共通関数 ---
async function updateRankingDisplay() {
    try {
        const snap = await db.collection("scores").orderBy("distance", "desc").limit(5).get();
        rankingList.innerHTML = "";
        if (snap.empty) {
            rankingList.innerHTML = "<li>データがありません</li>";
        }
        snap.forEach((doc, i) => {
            const d = doc.data();
            const li = document.createElement("li");
            const dScore = isNaN(parseInt(d.distance)) ? 0 : parseInt(d.distance);
            li.innerHTML = `<span>${i+1}. ${d.name || "Unknown"}</span> <span>${dScore}m</span>`;
            rankingList.appendChild(li);
        });
    } catch (e) { console.error("Ranking Fetch Error:", e); }
}

async function handleGameOver(finalDist) {
    gameState = "GAMEOVER";
    pauseBtn.style.display = "none";
    
    // 現在のスコアを確実に数値化
    let currentDist = Math.floor(finalDist) || 0;
    if (isNaN(currentDist)) currentDist = 0;

    // 過去のベストを数値化
    let bestScore = parseInt(localStorage.getItem("bestDistance"));
    if (isNaN(bestScore)) bestScore = -1; // 初回は確実にハイスコアにするため -1

    let playerName = localStorage.getItem("playerName");

    // スコアが0より大きければハイスコア判定（初回含む）
    if (currentDist > bestScore) {
        if (!playerName) {
            playerName = prompt("初記録・ハイスコア更新！名前を入力:") || "Player";
            localStorage.setItem("playerName", playerName);
        }
        localStorage.setItem("bestDistance", currentDist);
        try {
            // 保存が終わるまで待つ (await)
            await db.collection("scores").add({
                name: playerName,
                distance: currentDist,
                date: new Date()
            });
        } catch (e) { console.error("Firebase Save Error:", e); }
    }

    // 最新のランキングを取得して表示
    await updateRankingDisplay();
    rankingBoard.style.display = "block";
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
    let displayDist = Math.floor(distance) || 0;
    scoreElement.innerText = `SCORE: ${score} | DIST: ${displayDist}m`;

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