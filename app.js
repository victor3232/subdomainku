const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');
const app = express();
const axios = require('axios');

// Fungsi untuk escape karakter MarkdownV2 agar tidak error parsing
function escapeMarkdownV2(text) {
  // Tambahkan backslash \ untuk escape
  return text.toString().replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}


const settings = require('./config'); 
const Token = settings.token;
const owner = settings.adminId;
const premiumUsersFile = 'db/premiumUsers.json';
let premiumUsers = [];
try {
    premiumUsers = JSON.parse(fs.readFileSync(premiumUsersFile));
} catch (error) {
    console.error('Error reading premiumUsers file:', error);
}
const bot = new TelegramBot(Token, { polling: true });

const zones = {
    '95e7efc33f0a9339216b28ff2c2bce19': 'hitsssh.web.id',
    '4ba67e22b32facc02df23ba9d7c87906': '404-eror.systems',
    '75bcb44b99f8828c067cc351c41519b5': 'cjdw.me',
  'ea4a4028d893149fda5bd28b270de74d' : 'hitsssh.works',
  '3dabfe4f2f4fbec6157a673e54a25891' : 'kibiljoe.engineer',
    '13805e8d3a62151955b7a26debc88c33': 'cjdw.tech',
    'b66b7c7ff46762f0dbb1429d3f6d247f': 'slankers.web.id'
};

const apiTokens = {
    '95e7efc33f0a9339216b28ff2c2bce19': 'Kv3ypXTX_oKfTLyzdK0i_1r2b1Qg2thR9WBOU1P7',
    '4ba67e22b32facc02df23ba9d7c87906': 'WcEyJrhTEfWIaAQ6MjT0tAZSgg2UIdCUYI0pAEAX',
  '75bcb44b99f8828c067cc351c41519b5' : 'sjTpIPYFr42HthmcgrMwVvsXnJ7JD6kJnZNikHYA',
  'ea4a4028d893149fda5bd28b270de74d' : '31myyOZw4gvuY6LQxcCZVIN7bJqM7TDCPEyF8Ws-',
  '3dabfe4f2f4fbec6157a673e54a25891' : '31myyOZw4gvuY6LQxcCZVIN7bJqM7TDCPEyF8Ws-',
    '13805e8d3a62151955b7a26debc88c33': 'WcEyJrhTEfWIaAQ6MjT0tAZSgg2UIdCUYI0pAEAX',
    'b66b7c7ff46762f0dbb1429d3f6d247f': 'WcEyJrhTEfWIaAQ6MjT0tAZSgg2UIdCUYI0pAEAX'
};

// Simpan status per user
const userState = {};

// --- BARU ---
// Cache untuk menyimpan hasil DNS sementara (agar ganti halaman tidak lemot)
const dnsCache = new Map();
// Jumlah item per halaman
const SUBDOMAINS_PER_PAGE = 20; 
// --- AKHIR BARU ---

// Fungsi tombol domain
function generateDomainButtons(prefix) {
    const buttons = Object.entries(zones).map(([id, name]) => {
        return [{ text: name, callback_data: `${prefix}:${id}` }];
    });
    return { reply_markup: { inline_keyboard: buttons } };
}

const createSubdomain = async (subdomain, ipAddress, zoneId, apiToken, userId, username) => {
    try {
        const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
        const data = {
            type: 'A',
            name: `${subdomain}.${zones[zoneId]}`,
            content: ipAddress,
            ttl: 3600,
            proxied: false
        };
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiToken}`
        };

        await axios.post(url, data, { headers });
        
        // --- BARU --- (Hapus cache saat ada data baru)
        dnsCache.delete(zoneId);
        // --- AKHIR BARU ---

        // === Kirim notif ke owner ===
        const notifMsg = `📢 *Notifikasi Subdomain Baru*\n\n` +
            `👤 User ID: \`${userId}\`\n` +
            `🏷️ Username: ${username}\n` +
            `🌍 Domain: *${zones[zoneId]}*\n` +
            `🔗 Subdomain: *${subdomain}.${zones[zoneId]}*\n` +
            `📡 IP: \`${ipAddress}\``;

        bot.sendMessage(owner, notifMsg, { parse_mode: 'Markdown' });

        return { success: true, message: `✅ Subdomain *${subdomain}.${zones[zoneId]}* berhasil dibuat.` };
    } catch (error) {
        console.error('CREATE ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal membuat subdomain.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`,
            raw: error
        };
    }
};



const deleteSubdomain = async (subdomain, zoneId, apiToken) => {
    try {
        const domain = `${subdomain}.${zones[zoneId]}`;
        const headers = {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
        };
        const listUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${domain}`;
        const listResp = await axios.get(listUrl, { headers });

        if (listResp.data.result.length === 0) {
            return { success: false, message: '⚠️ Subdomain tidak ditemukan.' };
        }

        const recordId = listResp.data.result[0].id;
        const deleteUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`;
        await axios.delete(deleteUrl, { headers });
        
        // --- BARU --- (Hapus cache saat ada data dihapus)
        dnsCache.delete(zoneId);
        // --- AKHIR BARU ---

        return { success: true, message: `✅ Subdomain *${domain}* berhasil dihapus.` };
    } catch (error) {
        console.error('DELETE ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal menghapus subdomain.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};

// --- BARU ---
const deleteAllSubdomains = async (zoneId, apiToken) => {
    const headers = { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
    try {
        // 1. Ambil semua record dulu (fungsi ini sudah ada)
        const allRecords = await fetchAllDnsRecords(zoneId, apiToken);
        
        if (allRecords.length === 0) {
            return { success: true, count: 0, message: '✅ Tidak ada subdomain (Tipe A) yang ditemukan untuk dihapus.' };
        }

        // 2. Buat array berisi semua JANJI (Promise) untuk menghapus
        const deletePromises = allRecords.map(record => {
            const deleteUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`;
            return axios.delete(deleteUrl, { headers });
        });

        // 3. Eksekusi semua promise secara paralel dan tunggu hasilnya
        const results = await Promise.allSettled(deletePromises);

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.filter(r => r.status === 'rejected').length;

        // 4. Hapus cache karena data sudah berubah
        dnsCache.delete(zoneId);

        // 5. Kembalikan laporan
        return {
            success: true,
            count: successCount,
            message: `✅ Berhasil menghapus *${successCount}* subdomain.\n⚠️ Gagal menghapus: *${failedCount}*.`
        };

    } catch (error) {
        // Ini terjadi jika fetchAllDnsRecords gagal
        console.error('DELETE ALL ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal total saat proses hapus semua.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};
// --- AKHIR BARU ---


const updateSubdomainIP = async (subdomain, newIp, zoneId, apiToken) => {
    try {
        const domain = `${subdomain}.${zones[zoneId]}`;
        const headers = {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
        };
        const listUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${domain}`;
        const listResp = await axios.get(listUrl, { headers });

        if (listResp.data.result.length === 0) {
            return { success: false, message: '⚠️ Subdomain tidak ditemukan.' };
        }

        const record = listResp.data.result[0];
        const updateUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`;
        await axios.put(updateUrl, {
            type: 'A',
            name: record.name,
            content: newIp,
            ttl: 3600,
            proxied: record.proxied
        }, { headers });
        
        // --- BARU --- (Hapus cache saat ada data diubah)
        dnsCache.delete(zoneId);
        // --- AKHIR BARU ---

        return { success: true, message: `✅ IP subdomain *${domain}* berhasil diubah ke *${newIp}*.` };
    } catch (error) {
        console.error('UPDATE IP ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal mengubah IP.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};


// --- BARU ---
// Fungsi untuk mengambil SEMUA record DNS, tidak hanya 20 pertama
async function fetchAllDnsRecords(zoneId, apiToken) {
    let allRecords = [];
    let page = 1;
    let totalPages = 1;
    const headers = { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

    do {
        try {
            // Ambil per 100 item (maksimal Cloudflare)
            const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&per_page=100&page=${page}&order=name&direction=asc`;
            const response = await axios.get(url, { headers });
            
            if (response.data.result) {
                allRecords = allRecords.concat(response.data.result);
            }
            
            totalPages = response.data.result_info.total_pages || 1;
            page++;
            
        } catch (error) {
            console.error(`Error fetching page ${page} for zone ${zoneId}:`, error.message);
            throw error; // Hentikan jika satu halaman gagal
        }
    } while (page <= totalPages);
    
    return allRecords;
}

// --- DIUBAH ---
// Fungsi untuk membuat teks dan tombol halaman
function generateListPage(records, domain, zoneId, page = 1) {
    const totalRecords = records.length;
    const totalPages = Math.ceil(totalRecords / SUBDOMAINS_PER_PAGE);
    
    // Pastikan 'page' valid
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * SUBDOMAINS_PER_PAGE;
    const end = start + SUBDOMAINS_PER_PAGE;
    const pageRecords = records.slice(start, end);

    // Buat daftar teks untuk halaman ini
    const list = pageRecords.map((r, i) => {
        // Gunakan escapeMarkdownV2 untuk setiap bagian
        const index = start + i + 1;
        const name = escapeMarkdownV2(r.name);
        const content = escapeMarkdownV2(r.content);
        return `${index}\\. ${name} → \`${content}\``;
    }).join('\n');

    const domainEscaped = escapeMarkdownV2(domain);
    const messageText = `📝 *List Subdomain \\(${domainEscaped}\\)*\n\n${list}`;

    // Buat tombol navigasi
    const navigationButtons = [];
    if (page > 1) {
        navigationButtons.push({ text: '◀️ Sebelumnya', callback_data: `listpage:${zoneId}:${page - 1}` });
    }
    navigationButtons.push({ text: `${page} / ${totalPages}`, callback_data: 'noop' }); // Tombol info halaman
    if (page < totalPages) {
        navigationButtons.push({ text: 'Selanjutnya ▶️', callback_data: `listpage:${zoneId}:${page + 1}` });
    }

    // --- BARU ---
    // Tombol untuk kembali ke menu utama
    const menuButtonRow = [{ text: '⬅️ Kembali ke Menu', callback_data: 'start' }];
    // --- AKHIR BARU ---

    return {
        text: messageText,
        options: {
            // --- DIUBAH --- (menambahkan menuButtonRow)
            reply_markup: { inline_keyboard: [navigationButtons, menuButtonRow] },
            parse_mode: 'MarkdownV2'
        }
    };
}
// --- AKHIR PERUBAHAN ---

// --- BARU ---
function sendStartMenu(chatId, messageId = null) {
    const welcomeText = `
☁️ CLOUDFLARE - SUBDOMAIN MANAGER

🚀 Kelola & atur subdomain dengan mudah  
🌍 Tambah • Ubah IP • Hapus • Lihat

⚠️ Status: Masih dalam tahap pengembangan
`;
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ Buat Subdomain', callback_data: 'create' }],
                [{ text: '✏️ Ubah IP Subdomain', callback_data: 'ubahip' }],
                [{ text: '🗑️ Hapus Subdomain', callback_data: 'hapus' }],
                [{ text: '📝 Lihat Subdomain', callback_data: 'listsub' }],
                // === TOMBOL BARU DITAMBAHKAN DI SINI ===
                [{ text: '🔥 HAPUS SEMUA Subdomain', callback_data: 'deleteall' }],
                // =======================================
                [{ text: '💬 Kontak Admin', url: 'https://t.me/kibiljoe' }]
            ]
        },
        parse_mode: 'Markdown'
    };

    try {
        if (messageId) {
            // Edit pesan yang ada (jika kembali dari menu lain)
            bot.editMessageText(welcomeText, { chat_id: chatId, message_id: messageId, ...keyboard });
        } else {
            // Kirim pesan baru (untuk /start)
            bot.sendMessage(chatId, welcomeText, keyboard);
        }
    } catch (error) {
        console.error("Gagal mengirim/edit menu start:", error.message);
        // Fallback jika edit gagal (misal, pesan sama)
        if (messageId) {
             bot.answerCallbackQuery(query.id);
        }
    }
}
// --- AKHIR BARU ---

// --- DIUBAH ---
// START COMMAND
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    // Panggil fungsi menu start yang baru
    sendStartMenu(chatId, null);
});
// --- AKHIR PERUBAHAN ---

bot.onText(/\/addprem (\d+)/, (msg, match) => {
    // ... (kode /addprem Anda tidak berubah)
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (String(senderId) !== String(owner)) {
        return bot.sendMessage(chatId, '❌ Hanya admin yang bisa menggunakan perintah ini.');
    }

    const userIdToAdd = match[1];

    if (premiumUsers.includes(userIdToAdd)) {
        return bot.sendMessage(chatId, `⚠️ User ID \`${userIdToAdd}\` sudah premium.`, { parse_mode: 'Markdown' });
    }

    premiumUsers.push(userIdToAdd);
    fs.writeFileSync(premiumUsersFile, JSON.stringify(premiumUsers, null, 2));
    bot.sendMessage(chatId, `✅ User ID \`${userIdToAdd}\` berhasil ditambahkan sebagai *Premium*.`, { parse_mode: 'Markdown' });
});

bot.onText(/\/delprem (\d+)/, (msg, match) => {
    // ... (kode /delprem Anda tidak berubah)
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (String(senderId) !== String(owner)) {
        return bot.sendMessage(chatId, '❌ Hanya admin yang bisa menggunakan perintah ini.');
    }

    const userIdToRemove = match[1];

    if (!premiumUsers.includes(userIdToRemove)) {
        return bot.sendMessage(chatId, `⚠️ User ID \`${userIdToRemove}\` tidak ditemukan di daftar premium.`, { parse_mode: 'Markdown' });
    }

    premiumUsers = premiumUsers.filter(id => id !== userIdToRemove);
    fs.writeFileSync(premiumUsersFile, JSON.stringify(premiumUsers, null, 2));
    bot.sendMessage(chatId, `✅ User ID \`${userIdToRemove}\` berhasil dihapus dari *Premium*.`, { parse_mode: 'Markdown' });
});

bot.onText(/^\/(broadcast|bc) (.+)/, async (msg, match) => {
  // ... (kode /bc Anda tidak berubah)
  const ownerId = "1835508209"; // Sesuaikan
  const chatId = msg.chat.id;
  const message = match[2];

  if (chatId.toString() !== ownerId) return;

  let success = 0;
  let failed = 0;

  for (let id of premiumUsers) {
    try {
      await bot.sendMessage(id, message);
      success++;
    } catch (e) {
      console.log(`Gagal kirim ke ${id}`);
      failed++;
    }
  }

  bot.sendMessage(chatId, `✅ Broadcast selesai!\nBerhasil: ${success}\nGagal: ${failed}`);
});

bot.onText(/\/listprem/, (msg) => {
    // ... (kode /listprem Anda tidak berubah)
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (String(senderId) !== String(owner)) {
        return bot.sendMessage(chatId, '❌ Hanya admin yang bisa melihat daftar Premium.');
    }

    if (premiumUsers.length === 0) {
        return bot.sendMessage(chatId, '📭 Tidak ada user yang terdaftar sebagai Premium.');
    }

    const list = premiumUsers.map((id, index) => `${index + 1}. \`${id}\``).join('\n');
    bot.sendMessage(chatId, `📋 *Daftar Premium Users:*\n\n${list}`, {
        parse_mode: 'Markdown'
    });
});

// --- DIUBAH TOTAL (PENAMBAHAN TOMBOL BATAL) ---
// CALLBACK QUERY (domain selection)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    const msgId = query.message.message_id;

    // --- Handler untuk tombol navigasi halaman ---
    if (data.startsWith('listpage:')) {
        const [_, zoneId, pageStr] = data.split(':');
        const page = parseInt(pageStr, 10);
        
        let cached = dnsCache.get(zoneId);
        if (!cached) {
            try {
                bot.answerCallbackQuery(query.id, { text: '⏳ Mengambil ulang data...' });
                const apiToken = apiTokens[zoneId];
                const allRecords = await fetchAllDnsRecords(zoneId, apiToken);
                dnsCache.set(zoneId, allRecords);
                cached = allRecords;
            } catch (err) {
                bot.answerCallbackQuery(query.id, { text: '❌ Gagal mengambil data.', show_alert: true });
                return;
            }
        }
        
        const { text, options } = generateListPage(cached, zones[zoneId], zoneId, page);
        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: msgId,
                ...options
            });
            bot.answerCallbackQuery(query.id);
        } catch (error) {
            bot.answerCallbackQuery(query.id);
        }
        return;
    }
    
    // --- Handler untuk tombol 'noop' (tombol info halaman) ---
    if (data === 'noop') {
        bot.answerCallbackQuery(query.id);
        return;
    }

    // --- Handler untuk tombol "Kembali ke Menu" / "Batal" ---
    if (data === 'start') {
        bot.answerCallbackQuery(query.id);
        sendStartMenu(chatId, msgId); // Panggil fungsi menu start (edit pesan)
        return;
    }

    // --- Handler untuk Konfirmasi Hapus Semua ---
    if (data.startsWith('deleteall_confirm:')) {
        // Cek lagi apa dia owner
        if (String(userId) !== String(owner)) {
            bot.answerCallbackQuery(query.id, { text: '❌ Anda bukan Owner!', show_alert: true });
            return;
        }

        const [_, zoneId] = data.split(':');
        const apiToken = apiTokens[zoneId];
        const domain = zones[zoneId];

        if (!apiToken) {
            bot.answerCallbackQuery(query.id, { text: 'Token API tidak ditemukan', show_alert: true });
            return;
        }
        
        bot.answerCallbackQuery(query.id, { text: 'Permintaan diterima. Memproses...' });

        // Tampilkan pesan "Loading..."
        await bot.editMessageText(`⏳ Menghapus semua subdomain dari *${escapeMarkdownV2(domain)}*\\.\\.\\. Ini mungkin butuh waktu beberapa saat\\.`, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'MarkdownV2'
        });

        // Panggil fungsi hapus semua
        const res = await deleteAllSubdomains(zoneId, apiToken);

        // Kirim laporan hasil
        await bot.editMessageText(res.message, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ Kembali ke Menu Awal', callback_data: 'start' }]
                ]
            }
        });
        return;
    }
    // --- AKHIR HANDLER HAPUS SEMUA ---


    // --- Cek Fitur & Izin ---
    if (['create', 'hapus', 'ubahip', 'listsub', 'deleteall'].includes(data)) {
        
        let hasPermission = false;

        if (data === 'deleteall') {
            // Fitur 'deleteall' HANYA untuk Owner
            if (String(userId) === String(owner)) {
                hasPermission = true;
            } else {
                bot.answerCallbackQuery(query.id);
                return bot.sendMessage(chatId, '❌ Fitur `Hapus Semua` hanya untuk *Owner Utama* bot.', {
                    parse_mode: 'Markdown'
                });
            }
        } else {
            // Fitur lain ('create', 'hapus', 'ubahip', 'listsub') untuk Premium User
            const isPremium = premiumUsers.includes(String(userId));
            if (isPremium) {
                hasPermission = true;
            } else {
                bot.answerCallbackQuery(query.id); 
                return bot.sendMessage(chatId, '❌ Fitur ini hanya untuk *pengguna Premium*.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '💬 HUBUNGI ADMIN', url: 'https.me/kibiljoe' }]]
                    }
                });
            }
        }

        // Jika punya izin, lanjutkan tampilkan menu domain
        if (hasPermission) {
            userState[userId] = { step: data };
            
            try {
                await bot.editMessageText('📡 Pilih domain yang ingin digunakan:', {
                    chat_id: chatId,
                    message_id: msgId,
                    ...generateDomainButtons(data)
                });
                bot.answerCallbackQuery(query.id);
            } catch (e) { 
                console.error("Edit msg error:", e.message);
                bot.answerCallbackQuery(query.id); 
            }
            return; 
        }
        
        return;
    }


    // --- Handler Aksi per Domain ---
    const [action, zoneId] = data.split(':');
    if (!zones[zoneId]) {
        bot.answerCallbackQuery(query.id);
        return bot.sendMessage(chatId, '❗ Domain tidak ditemukan.');
    }

    userState[userId] = { step: action, zoneId };
    const domain = zones[zoneId];
    bot.answerCallbackQuery(query.id); 

    if (action === 'create') {
        return bot.editMessageText('✍️ Kirim format:\n`subdomain ip`\n\nContoh: `vpnuser 1.2.3.4`', { 
            chat_id: chatId, 
            message_id: msgId, 
            parse_mode: 'Markdown',
            // --- BARU ---
            reply_markup: {
                inline_keyboard: [[{ text: '⬅️ Batal', callback_data: 'start' }]]
            }
            // --- AKHIR BARU ---
        });
    }

    if (action === 'ubahip') {
        return bot.editMessageText('✍️ Kirim format:\n`sub.domain.tld ip`\n\nContoh: `vpn.' + domain + ' 1.2.3.4`', { 
            chat_id: chatId, 
            message_id: msgId, 
            parse_mode: 'Markdown',
            // --- BARU ---
            reply_markup: {
                inline_keyboard: [[{ text: '⬅️ Batal', callback_data: 'start' }]]
            }
            // --- AKHIR BARU ---
        });
    }

    if (action === 'hapus') {
        return bot.editMessageText('✍️ Kirim nama subdomain yang akan dihapus:\nContoh: `vpnuser`', { 
            chat_id: chatId, 
            message_id: msgId,
            // --- BARU ---
            reply_markup: {
                inline_keyboard: [[{ text: '⬅️ Batal', callback_data: 'start' }]]
            }
            // --- AKHIR BARU ---
        });
    }

    // --- Handler untuk menampilkan konfirmasi Hapus Semua ---
    if (action === 'deleteall') {
         if (String(userId) !== String(owner)) {
            bot.answerCallbackQuery(query.id);
            return bot.editMessageText('❌ Fitur `Hapus Semua` hanya untuk *Owner Utama* bot.', {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown'
            });
        }
        
        const domainEscaped = escapeMarkdownV2(domain);
        
        await bot.editMessageText(
            `🚨 *PERINGATAN SERIUS* 🚨\n\n` +
            `Anda akan menghapus *SEMUA* subdomain \\(Tipe A\\) dari domain *${domainEscaped}*\\.\n\n` +
            `Tindakan ini **TIDAK BISA DIBATALKAN**\\.\n\n` +
            `Apakah Anda benar\\-benar yakin ingin melanjutkan?`,
            {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '❌ TIDAK, BATALKAN', callback_data: 'start' }
                        ],
                        [
                            { text: '✅ YA, SAYA YAKIN HAPUS SEMUA', callback_data: `deleteall_confirm:${zoneId}` }
                        ]
                    ]
                }
            }
        );
        return;
    }
    // --- AKHIR HANDLER 'deleteall' ---

    if (action === 'listsub') {
        const apiToken = apiTokens[zoneId];
        
        try {
            const domainEscaped = escapeMarkdownV2(domain); 
            await bot.editMessageText(`⏳ Mengambil daftar subdomain untuk *${domainEscaped}*\\.\\.\\.\nHarap tunggu sebentar\\.`, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'MarkdownV2'
            });

            const allRecords = await fetchAllDnsRecords(zoneId, apiToken);
            dnsCache.set(zoneId, allRecords);

            if (allRecords.length === 0) {
                return bot.editMessageText(`Tidak ada subdomain di *${domain}*`, { 
                    chat_id: chatId, 
                    message_id: msgId, 
                    parse_mode: 'Markdown' 
                });
            }

            const { text, options } = generateListPage(allRecords, domain, zoneId, 1);
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: msgId, 
                ...options
            });

        } catch (err) {
            console.error('LIST ERROR:', err?.response?.data || err.message);
            bot.editMessageText('❌ Gagal mengambil daftar subdomain.', {
                chat_id: chatId,
                message_id: msgId
            });
        }
    }
});
// --- AKHIR PERUBAHAN TOTAL ---

// --- DIUBAH TOTAL (PENAMBAHAN TOMBOL KEMBALI DI HASIL) ---
// HANDLER TEXT / INPUT PENGGUNA
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : "";
    if (!text) return; // lewati jika bukan pesan teks
    if (text.startsWith('/')) return; // Abaikan jika ini perintah

    // Cek userState[userId] lebih aman
    if (!userState[userId] || !userState[userId].step) return;

    // --- BARU ---
    // Definisikan tombol kembali di sini agar bisa dipakai ulang
    const backToMenuKeyboard = {
        reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Kembali ke Menu', callback_data: 'start' }]]
        }
    };
    // --- AKHIR BARU ---

    const { step, zoneId } = userState[userId];
    
    // Pastikan zoneId ada sebelum ambil token
    if (!zoneId) {
        delete userState[userId];
        return;
    }

    const apiToken = apiTokens[zoneId];

    if (!apiToken) {
        delete userState[userId];
        return bot.sendMessage(chatId, '⚠️ Token API tidak ditemukan.');
    }

    if (step === 'create') {
        const isPremium = premiumUsers.includes(String(userId));
        if (!isPremium) {
            delete userState[userId];
            return bot.sendMessage(chatId, '❌ Perintah hanya untuk *pengguna Premium*.', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '💬 HUBUNGI ADMIN', url: 'https.me/kibiljoe' }]]
                }
            });
        }

        const parts = text.split(' ');
        if (parts.length !== 2) {
            return bot.sendMessage(chatId, '⚠️ Format salah. Gunakan:\n`subdomain ip`\nContoh: `vpnuser 1.2.3.4`', { 
                parse_mode: 'Markdown', 
                ...backToMenuKeyboard // Tambahkan tombol batal jika format salah
            });
        }

        const [sub, ip] = parts;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

        // ✅ kirim juga username
        const res = await createSubdomain(sub, ip, zoneId, apiToken, userId, username);

        // --- DIUBAH --- (Tambahkan tombol kembali)
        bot.sendMessage(chatId, res.message, { 
            parse_mode: 'Markdown',
            ...backToMenuKeyboard
        });
    }


    if (step === 'ubahip') {
        const parts = text.split(' ');
        if (parts.length !== 2) return bot.sendMessage(chatId, '⚠️ Format salah. Gunakan:\n`vpn.domain.tld ip`\nContoh: `vpn.domain.com 1.2.3.4`', { 
            parse_mode: 'Markdown',
            ...backToMenuKeyboard // Tambahkan tombol batal jika format salah
        });

        const [fullSub, ip] = parts;
        const domain = zones[zoneId];
        // Tambahkan cek jika user tidak menyertakan domain
        const sub = fullSub.includes(domain) ? fullSub.replace(`.${domain}`, '') : fullSub;

        const res = await updateSubdomainIP(sub, ip, zoneId, apiToken);
        // --- DIUBAH --- (Tambahkan tombol kembali)
        bot.sendMessage(chatId, res.message, { 
            parse_mode: 'Markdown',
            ...backToMenuKeyboard
        });
    }

    if (step === 'hapus') {
        const sub = text;
        const res = await deleteSubdomain(sub, zoneId, apiToken);
        // --- DIUBAH --- (Tambahkan tombol kembali)
        bot.sendMessage(chatId, res.message, { 
            parse_mode: 'Markdown',
            ...backToMenuKeyboard
        });
    }

    delete userState[userId]; // reset setelah satu input
});
// --- AKHIR PERUBAHAN TOTAL ---


// Root endpoint untuk UptimeRobot
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Endpoint khusus ping
app.get('/ping', (req, res) => {
  res.status(200).send('Pong!');
});

// Port wajib 8080 untuk Replit
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});

// Handle error tak terduga
process.on('uncaughtException', (err) => {
  console.error('Error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Anda bisa tambahkan logging di sini
});