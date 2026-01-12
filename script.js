import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjYZHcGo6RiPVHlZHFFoXcMoFsx4N6d5U",
  authDomain: "hatiware-ac9f4.firebaseapp.com",
  projectId: "hatiware-ac9f4",
  storageBucket: "hatiware-ac9f4.firebasestorage.app",
  messagingSenderId: "682427412458",
  appId: "1:682427412458:web:29820bcf58816565834c93"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");

// 縦長の解像度
canvas.width = 400;
canvas.height = 600;

let score = 0;
let distance = 0;
let gameOver = false;
let enemySpeed = 5;

// 自機画像
const playerImg = new Image();
playerImg.src = 'player.png'; 
const player = { x: 170, y: 500, width: 60, height: 60 };

const enemies = [];

// 操作を一本化
function movePlayer(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (clientX - rect.left) * scaleX - player.width / 2;
    player.x = Math.max(0, Math.min(canvas.width - player.width, x));
}

canvas.addEventListener("mousemove", (e) => movePlayer(e.clientX));
canvas.addEventListener("touchmove", (e) => {
    movePlayer(e.touches[0].clientX);
    e.preventDefault();
}, { passive: false });

async function saveScore(dist) {
    const name = prompt(`GAME OVER!\n距離: ${dist}m\nランキング用ネーム:`) || "Player";
    try {
        await addDoc(collection(db, "scores"), { name: name, distance: dist, date: new Date() });
        const q = query(collection(db, "scores"), orderBy("distance", "desc"), limit(5));
        const snap = await getDocs(q);
        let msg = "🏆 TOP 5 🏆\n";
        snap.forEach((doc, i) => msg += `${i+1}. ${doc.data().name}: ${doc.data().distance}m\n`);
        alert(msg);
    } catch (e) { console.error(e); }
    location.reload();
}

function spawn() {
    if (gameOver) return;
    enemies.push({ x: Math.random() * (canvas.width - 35), y: -40, w: 35, h: 35 });
}

function loop() {
    if (gameOver) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    distance += 0.2;
    scoreElement.innerText = `SCORE: ${score} | DIST: ${Math.floor(distance)}m`;

    // 自機描画
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);

    // 敵描画
    for (let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        e.y += enemySpeed;
        ctx.fillStyle = "#FF4500";
        ctx.fillRect(e.x, e.y, e.w, e.h);

        // 判定
        if (player.x < e.x + e.w && player.x + player.width > e.x &&
            player.y < e.y + e.h && player.y + player.height > e.y) {
            gameOver = true;
            saveScore(Math.floor(distance));
        }

        if (e.y > canvas.height) {
            enemies.splice(i, 1);
            i--;
            score++;
            enemySpeed += 0.05;
        }
    }
    requestAnimationFrame(loop);
}

setInterval(spawn, 500);
loop();