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
db.settings({ cacheSizeBytes: 0 });

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

const v = new Date().getTime();
const playerImg = new Image(); playerImg.src = 'player.png?v=' + v; 
const enemyImg = new Image(); enemyImg.src = 'gomi.png?v=' + v; 

// プレイヤー位置を元の座標 (y: 480) に戻しました
const player = { x: 160, y: 480, width: 80, height: 80 }; 
let enemies = [];

let userUUID = localStorage.getItem("userUUID") || 'u_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem("userUUID", userUUID);

startBtn.onclick = () => {
    startBtn.style.display = "none";
    startCountdown();
};

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
    } catch (e) { console.error(e); }
}

async function handleGameOver(finalDist) {
    gameState = "GAMEOVER";
    pauseBtn.style.display = "none";
    const currentDist = Math.floor(finalDist);
    let bestScore = Math.floor(Number(localStorage.getItem("bestDistance"))) || 0;
    let playerName = localStorage.getItem("playerName") || "";

    if (currentDist > bestScore || bestScore === 0) {
        const newName = prompt(`新記録！ ${currentDist}m\n名前を入力:`, playerName || "Player");
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

document.getElementById("retry-btn").onclick = () => location.reload();

function spawn() {
    if (gameState !== "PLAYING") return;
    // 当たり判定と見た目を元のサイズ (80x80) に戻しました
    enemies.push({ 
        x: Math.random() * (canvas.width - 80), 
        y: -80, w: 80, h: 80 
    });
}
setInterval(spawn, 500);

function gameLoop() {
    if (gameState !== "PLAYING") return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);

    for (let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        e.y += enemySpeed;

        ctx.drawImage(enemyImg, e.x, e.y, e.w, e.h);

        if (player.x < e.x + e.w && player.x + player.width > e.x &&
            player.y < e.y + e.h && player.y + player.height > e.y) {
            handleGameOver(distance);
            return;
        }

        if (e.y > canvas.height) {
            enemies.splice(i, 1);
            i--;
            score++;
            enemySpeed += 0.1;
        }
    }

    distance += 0.2;
    scoreElement.innerText = `SCORE: ${score} | DIST: ${Math.floor(distance)}m`;
    requestAnimationFrame(gameLoop);
}

playerImg.onload = enemyImg.onload = () => {
    if (gameState === "STARTING") {
        ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    }
};