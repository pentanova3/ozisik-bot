const http = require('http');
const https = require('https');

const BOT_TOKEN = '8612341123:AAGReJ5tY8q0UITugt4dUVZasskPK_H8FBk';
const CHAT_ID = '-1003726991466';
const PORT = process.env.PORT || 8080;

function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const data = JSON.stringify({ chat_id: CHAT_ID, text: message });

  const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => console.log('Telegram yanıt:', res.statusCode, body));
  });
  req.on('error', (err) => console.error('Telegram hata:', err.message));
  req.write(data);
  req.end();
}

function checkAndSend() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const day = now.getDay(); // 0=Pazar, 3=Çarşamba, 6=Cumartesi
  const hour = now.getHours();
  const minute = now.getMinutes();

  if ((day === 3 || day === 6) && hour === 12 && minute === 0) {
    sendTelegram('📋 Önümüzdeki 3 gün için atama yapmayı unutma!');
    console.log('Mesaj gönderildi:', now.toLocaleString('tr-TR'));
  }
}

// Her dakika kontrol et
setInterval(checkAndSend, 60 * 1000);

// Railway health check sunucusu
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Özışık Bot çalışıyor! ✅');
});

server.listen(PORT, () => {
  console.log(`Sunucu port ${PORT} üzerinde çalışıyor`);
  console.log('Bot başlatıldı - Çarşamba ve Cumartesi 12:00 kontrol ediliyor...');
  checkAndSend(); // Başlangıçta bir kez kontrol et
}); 
