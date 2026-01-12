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
const countdownText = document.getElementById("countdown-text");

canvas.width = 400;
canvas.height = 600;

// ゲーム状態管理
let gameState = "STARTING"; // STARTING, COUNTDOWN, PLAYING, GAMEOVER
let score = 0;
let distance = 0;
let enemySpeed = 5;
const playerImg = new Image();
playerImg.src = 'player.png'; 
const player = { x: 170, y: 510, width: 60, height: 60 };
let enemies = [];

// --- スタートボタンの処理 ---
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
            gameLoop();
        } else {
            countdownText.innerText = count;
        }
    }, 1000);
}

// --- 操作系 ---
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

// --- スコア・ランキング処理 ---
async function handleGameOver(finalDist) {
    gameState = "GAMEOVER";
    
    // 端末に保存されている過去の記録を呼び出し
    let bestScore = localStorage.getItem("bestDistance") || 0;
    let playerName = localStorage.getItem("playerName");

    if (finalDist > bestScore) {
        // ハイスコア更新時のみFirebaseに保存
        if (!playerName) {
            playerName = prompt("ハイスコア更新！お名前を入力してください:") || "Player";
            localStorage.setItem("playerName", playerName);
        } else {
            alert(`自己ベスト更新！ (${finalDist}m)`);
        }
        
        localStorage.setItem("bestDistance", finalDist);
        
        try {
            await db.collection("scores").add({
                name: playerName,
                distance: finalDist,
                date: new Date()
            });
        } catch (e) { console.error(e); }
    } else {
        alert(`GAME OVER\n今回の記録: ${finalDist}m\n(自己ベスト: ${bestScore}m)`);
    }

    // ランキング取得
    const snap = await db.collection("scores").orderBy("distance", "desc").limit(5).get();
    let list = "🏆 世界ランキング TOP 5\n";
    snap.forEach((doc, i) => {
        list += `${i+1}. ${doc.data().name}: ${doc.data().distance}m\n`;
    });
    alert(list);
    location.reload();
}

function spawn() {
    if (gameState !== "PLAYING") return;
    enemies.push({ x: Math.random() * (canvas.width - 40), y: -40, w: 40, h: 40 });
}
setInterval(spawn, 500);

function gameLoop() {
    if (gameState !== "PLAYING") return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    distance += 0.2;
    scoreElement.innerText = `SCORE: ${score} | DIST: ${Math.floor(distance)}m`;

    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);

    for (let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        e.y += enemySpeed;
        ctx.fillStyle = "red";
        ctx.fillRect(e.x, e.y, e.w, e.h);

        if (player.x < e.x + e.w && player.x + player.width > e.x &&
            player.y < e.y + e.h && player.y + player.height > e.y) {
            handleGameOver(Math.floor(distance));
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

// 初期描画（スタート前にプレイヤーだけ出しておく）
ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);