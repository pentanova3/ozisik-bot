const admin = require('firebase-admin');
const cron = require('node-cron');
const fetch = require('node-fetch');

// ===== CONFIG =====
const TELEGRAM_BOT_TOKEN = '8612341123:AAGReJ5tY8q0UITugt4dUVZasskPK_H8FBk';
const TELEGRAM_CHAT_ID = '-1003726991466';

// Firebase Admin SDK - Firestore erişimi
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (serviceAccount.project_id) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    // Fallback: Environment variable ile
    admin.initializeApp({
        projectId: 'ozisik-paketleme'
    });
}

const db = admin.firestore();

// ===== TELEGRAM =====
async function sendTelegram(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        const data = await resp.json();
        if (data.ok) {
            console.log('Telegram mesajı gönderildi');
        } else {
            console.error('Telegram hatası:', data);
        }
    } catch (e) {
        console.error('Telegram gönderim hatası:', e.message);
    }
}

// ===== ATAMA ALGORİTMASI =====
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function runAutoAssign() {
    console.log('Otomatik atama başlıyor...');

    try {
        // Firestore'dan mevcut veriyi çek
        const doc = await db.collection('appData').doc('beyazPeynir').get();
        if (!doc.exists) {
            console.log('Veri bulunamadı');
            await sendTelegram('⚠️ Otomatik atama yapılamadı - veri bulunamadı.');
            return;
        }

        const S = doc.data();
        const personnel = S.personnel || [];
        const machines = S.machines || [];
        const mcfg = S.mcfg || {};
        const cleaning = S.cleaning || {};

        // Bugünün tarihini al
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Pazar, 1=Pzt... 6=Cmt

        // Çarşamba(3) = 1.Grup, Cumartesi(6) = 2.Grup
        let group, groupLabel;
        if (dayOfWeek === 3) {
            group = '1';
            groupLabel = '1. Grup (Pzt-Sal-Çar)';
        } else if (dayOfWeek === 6) {
            group = '2';
            groupLabel = '2. Grup (Per-Cum-Cmt)';
        } else {
            console.log('Bugün Çarşamba veya Cumartesi değil, atama yapılmıyor.');
            return;
        }

        // Hafta başlangıcını bul (Pazartesi)
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);
        const weekStart = monday.toISOString().split('T')[0];

        // Grup tarihlerini hesapla
        const groupDates = [];
        const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const startOffset = group === '1' ? 0 : 3;
        const dayCount = group === '2' && true ? 3 : 3; // Cmt dahil

        for (let i = 0; i < dayCount; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + startOffset + i);
            groupDates.push(d);
        }

        const dateFrom = groupDates[0].toISOString().split('T')[0];
        const dateTo = groupDates[groupDates.length - 1].toISOString().split('T')[0];
        const groupDays = groupDates.map(d => ({
            day: gunler[d.getDay()],
            date: d.toISOString().split('T')[0]
        }));

        // Mevcut aktif personeli filtrele
        const avail = personnel.filter(p => p.status === 'active' && !p.role && !p.fixedRole);
        const fixedPersonnel = personnel.filter(p => p.status === 'active' && p.fixedRole && !p.role);

        if (!avail.length) {
            await sendTelegram('⚠️ Otomatik atama yapılamadı - aktif personel yok.');
            return;
        }

        // CLEAN_ITEMS tanımı
        const CLEAN_ITEMS = [
            { id: 'c1', label: 'Vakum Makine İçi' },
            { id: 'c2', label: 'Vakum Makine Dışı' },
            { id: 'c3', label: 'Terazi Temizliği' },
            { id: 'c4', label: 'Zemin Temizliği' },
            { id: 'c5', label: 'Tartı & Bıçak Temizliği' },
            { id: 'c6', label: 'Koli Alanı' },
            { id: 'c7', label: 'Teneke Alanı' },
            { id: 'c8', label: 'Genel Alan' },
            { id: 'c9', label: 'Masa Temizliği' }
        ];

        // Toplam ihtiyaç hesapla
        let totalNeeded = 0;
        machines.forEach(m => {
            const c = mcfg[m.id] || { gramaj: 10, etiket: 1, kontrol: 1, koli: 1, makKoyma: 0 };
            totalNeeded += c.gramaj + c.etiket + c.kontrol + c.koli + (c.makKoyma || 0);
        });
        if (S.dilimEnabled) totalNeeded += S.dilimCount || 2;
        if (S.tarihMakEnabled) totalNeeded += S.tarihMakCount || 1;

        // Temizlik
        const cleanTasks = [];
        CLEAN_ITEMS.forEach(c => {
            const cfg = cleaning[c.id];
            if (cfg && cfg.on) {
                for (let i = 0; i < (cfg.count || 1); i++) {
                    cleanTasks.push(c.label);
                }
            }
        });
        totalNeeded += cleanTasks.length;

        // Personeli karıştır
        shuffle(avail);

        // ATAMA
        let idx = 0;
        const pick = (n) => {
            const result = [];
            for (let i = 0; i < n && idx < avail.length; i++) {
                result.push(avail[idx++]);
            }
            return result;
        };

        const assignment = {
            dateFrom, dateTo, weekStart, group,
            groupLabel, shift: 'sabah',
            groupDays,
            machineAssignments: [],
            tasks: { dilimleme: [], tarihMakinesi: [], temizlik: [] },
            fixedRoles: fixedPersonnel.map(p => ({ id: p.id, name: p.name, role: p.fixedRole })),
            createdAt: new Date().toISOString(),
            autoGenerated: true
        };

        // Makine atamaları
        machines.forEach(m => {
            const c = mcfg[m.id] || { gramaj: 10, etiket: 1, kontrol: 1, koli: 1, makKoyma: 0 };
            const mAssign = {
                machineId: m.id, machineName: m.name,
                desks: [], makKoyma: [], etiket: [], kontrol: [], koli: []
            };

            // Gramajlama
            const gramajP = pick(c.gramaj);
            const desks = m.desks || [{ name: 'Sol' }, { name: 'Sağ' }];
            const deskArrays = desks.map(() => []);

            gramajP.forEach((p, i) => {
                const di = i % desks.length;
                deskArrays[di].push(p);
            });

            desks.forEach((desk, i) => {
                mAssign.desks.push({
                    name: desk.name,
                    persons: (deskArrays[i] || []).map(p => ({ id: p.id, name: p.name, scaleNo: null }))
                });
            });

            // Diğer görevler
            pick(c.makKoyma || 0).forEach(p => mAssign.makKoyma.push({ id: p.id, name: p.name }));
            pick(c.etiket).forEach(p => mAssign.etiket.push({ id: p.id, name: p.name }));
            pick(c.kontrol).forEach(p => mAssign.kontrol.push({ id: p.id, name: p.name }));
            pick(c.koli).forEach(p => mAssign.koli.push({ id: p.id, name: p.name }));

            // İstatistik güncelle
            gramajP.forEach(p => { p.gC = (p.gC || 0) + 1; });
            [...mAssign.makKoyma, ...mAssign.etiket, ...mAssign.kontrol, ...mAssign.koli].forEach(pp => {
                const pr = personnel.find(x => x.id === pp.id);
                if (pr) pr.oC = (pr.oC || 0) + 1;
            });

            assignment.machineAssignments.push(mAssign);
        });

        // Dilimleme
        if (S.dilimEnabled) {
            pick(S.dilimCount || 2).forEach(p => assignment.tasks.dilimleme.push({ id: p.id, name: p.name }));
        }

        // Tarih Makinesi
        if (S.tarihMakEnabled) {
            pick(S.tarihMakCount || 1).forEach(p => assignment.tasks.tarihMakinesi.push({ id: p.id, name: p.name }));
        }

        // Temizlik
        const activeCleanItems = CLEAN_ITEMS.filter(c => cleaning[c.id] && cleaning[c.id].on);
        const cleanPool = [...avail.slice(0, idx)]; // atanmış personelden seç
        let cIdx = 0;

        activeCleanItems.forEach(cItem => {
            const cnt = (cleaning[cItem.id] || {}).count || 1;
            for (let i = 0; i < cnt; i++) {
                if (cIdx < cleanPool.length) {
                    const p = cleanPool[cIdx % cleanPool.length];
                    assignment.tasks.temizlik.push({ id: p.id, name: p.name, area: cItem.label, areaId: cItem.id });
                    cIdx++;
                }
            }
        });

        // History'ye ekle ve kaydet
        const history = S.history || [];
        // Aynı dönem varsa kaldır
        const existingIdx = history.findIndex(h => h.dateFrom === dateFrom && h.group === group);
        if (existingIdx >= 0) history.splice(existingIdx, 1);

        history.unshift(assignment);

        // Firestore'a kaydet
        await db.collection('appData').doc('beyazPeynir').update({
            personnel: personnel,
            history: history,
            cur: assignment
        });

        console.log('Atama Firestore\'a kaydedildi');

        // ===== TELEGRAM MESAJI OLUŞTUR =====
        let msg = `📋 <b>ÖZIŞIK SÜT ÜRÜNLERİ</b>\n`;
        msg += `🧀 <b>Beyaz Peynir Paketleme Atama</b>\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📅 <b>${groupLabel}</b>\n`;
        msg += `📆 ${groupDays.map(d => d.day + ' ' + d.date.substring(5).replace('-', '/')).join(' · ')}\n`;
        msg += `☀️ Sabah Vardiyası\n\n`;

        // Makine atamaları
        assignment.machineAssignments.forEach(ma => {
            msg += `🏭 <b>${ma.machineName}</b>\n`;
            ma.desks.forEach(desk => {
                if (desk.persons.length) {
                    msg += `  📊 <b>${desk.name} Masa:</b>\n`;
                    desk.persons.forEach(p => msg += `    • ${p.name}\n`);
                }
            });
            if (ma.makKoyma && ma.makKoyma.length) {
                msg += `  🏗️ Mak.Koyma: ${ma.makKoyma.map(p => p.name).join(', ')}\n`;
            }
            if (ma.etiket.length) {
                msg += `  🏷️ Etiket: ${ma.etiket.map(p => p.name).join(', ')}\n`;
            }
            if (ma.kontrol.length) {
                msg += `  🔍 Kontrol: ${ma.kontrol.map(p => p.name).join(', ')}\n`;
            }
            if (ma.koli.length) {
                msg += `  📦 Koli: ${ma.koli.map(p => p.name).join(', ')}\n`;
            }
            msg += `\n`;
        });

        // Sabit görevliler
        if (assignment.fixedRoles && assignment.fixedRoles.length) {
            msg += `🪣 <b>Sabit Görevliler:</b>\n`;
            assignment.fixedRoles.forEach(p => {
                const label = p.role === 'teneke' ? 'Teneke Açma' : p.role;
                msg += `  • ${p.name} → ${label}\n`;
            });
            msg += `\n`;
        }

        // Dilimleme
        if (assignment.tasks.dilimleme.length) {
            msg += `🧀 <b>Dilimleme:</b> ${assignment.tasks.dilimleme.map(p => p.name).join(', ')}\n`;
        }

        // Tarih Makinesi
        if (assignment.tasks.tarihMakinesi.length) {
            msg += `📅 <b>Tarih Makinesi:</b> ${assignment.tasks.tarihMakinesi.map(p => p.name).join(', ')}\n`;
        }

        // Temizlik
        if (assignment.tasks.temizlik.length) {
            msg += `\n🧹 <b>Temizlik Görevleri:</b>\n`;
            const cleanByArea = {};
            assignment.tasks.temizlik.forEach(p => {
                if (!cleanByArea[p.area]) cleanByArea[p.area] = [];
                cleanByArea[p.area].push(p.name);
            });
            Object.entries(cleanByArea).forEach(([area, names]) => {
                msg += `  🧹 ${area}: ${names.join(', ')}\n`;
            });
        }

        msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `✅ <i>Otomatik atama - ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</i>`;

        await sendTelegram(msg);
        console.log('Telegram mesajı gönderildi');

    } catch (e) {
        console.error('Otomatik atama hatası:', e);
        await sendTelegram('❌ Otomatik atama sırasında hata oluştu: ' + e.message);
    }
}

// ===== CRON ZAMANLAYICI =====
// Her Çarşamba ve Cumartesi saat 17:00 (Türkiye saati UTC+3 = 14:00 UTC)
cron.schedule('0 14 * * 3,6', () => {
    console.log('Cron tetiklendi:', new Date().toISOString());
    runAutoAssign();
}, { timezone: 'Europe/Istanbul' });

console.log('🤖 Özışık Paketleme Bot başlatıldı');
console.log('⏰ Zamanlama: Her Çarşamba ve Cumartesi 17:00 (TR)');
console.log('📱 Telegram Grup: ' + TELEGRAM_CHAT_ID);

// Railway'in servisi canlı tutması için basit HTTP sunucu
const http = require('http');
const server = http.createServer((req, res) => {
    if (req.url === '/test') {
        runAutoAssign();
        res.writeHead(200);
        res.end('Test atama tetiklendi');
    } else {
        res.writeHead(200);
        res.end('Ozisik Paketleme Bot aktif | Sonraki atama: Car/Cmt 17:00');
    }
});
server.listen(process.env.PORT || 3000, () => {
    console.log('HTTP sunucu port', process.env.PORT || 3000, 'dinleniyor');
});
