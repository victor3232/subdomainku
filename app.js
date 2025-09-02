const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');
const app = express();
const axios = require('axios');

// Fungsi untuk escape karakter MarkdownV2 agar tidak error parsing
function escapeMarkdownV2(text) {
  return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
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

        return { success: true, message: `✅ Subdomain *${domain}* berhasil dihapus.` };
    } catch (error) {
        console.error('DELETE ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal menghapus subdomain.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};

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

        return { success: true, message: `✅ IP subdomain *${domain}* berhasil diubah ke *${newIp}*.` };
    } catch (error) {
        console.error('UPDATE IP ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal mengubah IP.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};

// START COMMAND
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
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
                [{ text: '💬 Kontak Admin', url: 'https://t.me/kibiljoe' }]
            ]
        },
        parse_mode: 'Markdown'
    };
    bot.sendMessage(chatId, welcomeText, keyboard);
});

bot.onText(/\/addprem (\d+)/, (msg, match) => {
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

// CALLBACK QUERY (domain selection)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (['create', 'hapus', 'ubahip', 'listsub'].includes(data)) {
    const isPremium = premiumUsers.includes(String(userId));
    if (!isPremium) {
        return bot.sendMessage(chatId, '❌ Fitur ini hanya untuk *pengguna Premium*.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '💬 HUBUNGI ADMIN', url: 'https://t.me/kibiljoe' }]]
            }
        });
    }

    userState[userId] = { step: data };
    return bot.sendMessage(chatId, '📡 Pilih domain yang ingin digunakan:', generateDomainButtons(data));
}


    const [action, zoneId] = data.split(':');
    if (!zones[zoneId]) return bot.sendMessage(chatId, '❗ Domain tidak ditemukan.');

    userState[userId] = { step: action, zoneId };
    const domain = zones[zoneId];

    if (action === 'create') {
        return bot.sendMessage(chatId, '✍️ Kirim format:\n`subdomain ip`\n\nContoh: `vpnuser 1.2.3.4`', { parse_mode: 'Markdown' });
    }

    if (action === 'ubahip') {
        return bot.sendMessage(chatId, '✍️ Kirim format:\n`sub.domain.tld ip`\n\nContoh: `vpn.' + domain + ' 1.2.3.4`', { parse_mode: 'Markdown' });
    }

    if (action === 'hapus') {
        return bot.sendMessage(chatId, '✍️ Kirim nama subdomain yang akan dihapus:\nContoh: `vpnuser`');
    }

    if (action === 'listsub') {
        const apiToken = apiTokens[zoneId];
        const headers = {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
        };

        try {
            const response = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A`, { headers });
            const records = response.data.result;

            if (records.length === 0) return bot.sendMessage(chatId, `Tidak ada subdomain di *${domain}*`, { parse_mode: 'Markdown' });

            const list = records.map((r, i) => `${i + 1}. ${r.name} → ${r.content}`).join('\n');
            bot.sendMessage(chatId, escapeMarkdownV2(`📝 List Subdomain (${domain}):\n\n${list}`), {
  parse_mode: 'MarkdownV2'
});
        } catch (err) {
            console.error('LIST ERROR:', err?.response?.data || err.message);
            bot.sendMessage(chatId, '❌ Gagal mengambil daftar subdomain.');
        }
    }
});

// HANDLER TEXT / INPUT PENGGUNA
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : "";
  if (!text) return; // lewati jika bukan pesan teks


    if (!userState[userId] || text.startsWith('/')) return;

    const { step, zoneId } = userState[userId];
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
                inline_keyboard: [[{ text: '💬 HUBUNGI ADMIN', url: 'https://t.me/kibiljoe' }]]
            }
        });
    }

    const parts = text.split(' ');
    if (parts.length !== 2) {
        return bot.sendMessage(chatId, '⚠️ Format salah. Gunakan:\n`subdomain ip`\nContoh: `vpnuser 1.2.3.4`', { parse_mode: 'Markdown' });
    }

    const [sub, ip] = parts;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

    // ✅ kirim juga username
    const res = await createSubdomain(sub, ip, zoneId, apiToken, userId, username);

    bot.sendMessage(chatId, res.message, { parse_mode: 'Markdown' });
}


    if (step === 'ubahip') {
        const parts = text.split(' ');
        if (parts.length !== 2) return bot.sendMessage(chatId, '⚠️ Format salah. Gunakan:\n`vpn.domain.tld ip`\nContoh: `vpn.domain.com 1.2.3.4`', { parse_mode: 'Markdown' });

        const [fullSub, ip] = parts;
        const domain = zones[zoneId];
        const sub = fullSub.replace(`.${domain}`, '');

        const res = await updateSubdomainIP(sub, ip, zoneId, apiToken);
        bot.sendMessage(chatId, res.message, { parse_mode: 'Markdown' });
    }

    if (step === 'hapus') {
        const sub = text;
        const res = await deleteSubdomain(sub, zoneId, apiToken);
        bot.sendMessage(chatId, res.message, { parse_mode: 'Markdown' });
    }

    delete userState[userId]; // reset setelah satu input
});


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

