const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');
const app = express();
const axios = require('axios');
const crypto = require('crypto');
const QRCode = require('qrcode');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


function escapeMarkdownV2(text) {
  return text.toString().replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
}

const settings = require('./config'); 
const Token = settings.token;
const owner = settings.adminId;
const DuitkuMerchantCode = settings.duitkuMerchantCode;
const DuitkuApiKey = settings.duitkuApiKey;
const CallbackBaseUrl = settings.callbackBaseUrl; 

const premiumUsersFile = 'db/premiumUsers.json';
const priceFile = 'db/price.json';
const ordersFile = 'db/orders.json';

if (!fs.existsSync(premiumUsersFile)) fs.writeFileSync(premiumUsersFile, '{}', 'utf8');
if (!fs.existsSync(priceFile)) fs.writeFileSync(priceFile, '{"amount":10000, "duration": 30}', 'utf8');
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, '{}', 'utf8');

// === Helper DB Premium ===
function loadPremiumUsers() {
    try {
        return JSON.parse(fs.readFileSync(premiumUsersFile, 'utf8'));
    } catch (error) {
        console.error('Error reading premiumUsers file:', error);
        return {}; 
    }
}

function savePremiumUsers(data) {
    try {
        fs.writeFileSync(premiumUsersFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("Gagal menyimpan premium users:", e);
    }
}

function isUserPremium(userId) {
    const userIdStr = String(userId);
    if (userIdStr === String(owner)) return true;
    
    const premiumUsers = loadPremiumUsers();
    const expiryTimestamp = premiumUsers[userIdStr];

    if (!expiryTimestamp) return false;
    if (expiryTimestamp === -1) return true;

    const now = Date.now();
    return expiryTimestamp > now;
}

function activatePremium(userId, durationInDays) {
    const userIdStr = String(userId);
    const premiumUsers = loadPremiumUsers();
    
    let expiryTimestamp;
    
    if (durationInDays === -1) {
        expiryTimestamp = -1; // Permanen
    } else {
        const now = Date.now();
        const currentExpiry = premiumUsers[userIdStr];
        const baseTime = (currentExpiry && currentExpiry > now) ? currentExpiry : now;
        expiryTimestamp = baseTime + (durationInDays * 24 * 60 * 60 * 1000);
    }

    premiumUsers[userIdStr] = expiryTimestamp;
    savePremiumUsers(premiumUsers);
    
    console.log(`User ${userIdStr} premium diaktifkan/diperpanjang. Exp: ${expiryTimestamp === -1 ? 'Permanent' : new Date(expiryTimestamp)}`);
    return expiryTimestamp;
}

// === Helper DB Harga ===
function loadPrice() {
    try {
        const data = fs.readFileSync(priceFile, 'utf8');
        const priceData = JSON.parse(data);
        return {
            amount: priceData.amount || 10000,
            duration: priceData.duration || 30
        };
    } catch (e) {
        console.error("Gagal memuat harga:", e);
        return { amount: 10000, duration: 30 };
    }
}

function savePrice(priceData) {
    try {
        fs.writeFileSync(priceFile, JSON.stringify(priceData), 'utf8');
        return true;
    } catch (e) {
        console.error("Gagal menyimpan harga:", e);
        return false;
    }
}

function loadOrders() {
    try {
        return JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    } catch (e) {
        console.error("Gagal memuat orders:", e);
        return {};
    }
}

function saveOrders(orders) {
    try {
        fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), 'utf8');
    } catch (e) {
        console.error("Gagal menyimpan orders:", e);
    }
}


const bot = new TelegramBot(Token, { polling: true });

// ... (SEMUA FUNGSI CLOUDFLARE ANDA: zones, apiTokens, userState, dnsCache, SUBDOMAINS_PER_PAGE, activePollers, generateDomainButtons, createSubdomain, deleteSubdomain, deleteAllSubdomains, updateSubdomainIP, toggleProxy, toggleUnderAttackMode, fetchAllDnsRecords, generateListPage) ...
const zones = {
    '95e7efc33f0a9339216b28ff2c2bce19': 'hitsssh.web.id',
    '4ba67e22b32facc02df23ba9d7c87906': '404-eror.systems',
    '75bcb44b99f8828c067cc351c41519b5': 'cjdw.me',
  'ea4a4028d893149fda5bd28b270de74d' : 'hitsssh.works',
  '3dabfe4f2f4fbec6157a673e54a25891' : 'kibiljoe.engineer',
    '13805e8d3a62151955b7a26debc88c33': 'cjdw.tech',
    'b66b7c7ff46762f0dbb1429d3f6d247f': 'slankers.web.id',
    'a39521f527e048dbc5878225b470d4bf' : 'raykey.cloud',
    'cb7bfd70ccf4ab90d5a7bd0ca89ececd' : 'yoshicloud.space'
};

const apiTokens = {
    '95e7efc33f0a9339216b28ff2c2bce19': 'Kv3ypXTX_oKfTLyzdK0i_1r2b1Qg2thR9WBOU1P7',
    '4ba67e22b32facc02df23ba9d7c87906': 'WcEyJrhTEfWIaAQ6MjT0tAZSgg2UIdCUYI0pAEAX',
  '75bcb44b99f8828c067cc351c41519b5' : '0Ra07Oo6vu9JnBtIMnaKiTBniJJcFSSOxmu-DcCw',
  'ea4a4028d893149fda5bd28b270de74d' : '0Ra07Oo6vu9JnBtIMnaKiTBniJJcFSSOxmu-DcCw',
  '3dabfe4f2f4fbec6157a673e54a25891' : '0Ra07Oo6vu9JnBtIMnaKiTBniJJcFSSOxmu-DcCw',
    '13805e8d3a62151955b7a26debc88c33': 'WcEyJrhTEfWIaAQ6MjT0tAZSgg2UIdCUYI0pAEAX',
    'b66b7c7ff46762f0dbb1429d3f6d247f': 'EDywGoHCCpgoIC-z4UbAicU4C0pGjVJz4kUCeDLt',
    'a39521f527e048dbc5878225b470d4bf': '67sH80f6syPOwmUKiwVnzJBU7mtbOQjxYHT4-L0E',
    'cb7bfd70ccf4ab90d5a7bd0ca89ececd': 'NynVjZxWzvR_MzoS7GhgQ-V9lC63Z9YNgeBvb_iG'
};

const userState = {};
const dnsCache = new Map();
const SUBDOMAINS_PER_PAGE = 20; 
const activePollers = new Map(); 

function generateDomainButtons(prefix) {
    const domainEntries = Object.entries(zones);
    const rows = []; 

    for (let i = 0; i < domainEntries.length; i += 2) {
        const row = []; 
        
        const [id1, name1] = domainEntries[i];
        row.push({ text: name1, callback_data: `${prefix}:${id1}` });

        if (i + 1 < domainEntries.length) {
            const [id2, name2] = domainEntries[i + 1];
            row.push({ text: name2, callback_data: `${prefix}:${id2}` });
        }
        
        rows.push(row);
    }

    return { reply_markup: { inline_keyboard: rows } };
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
        
        dnsCache.delete(zoneId);

        const notifMsg = `📢 *Notifikasi Subdomain Baru*\n\n` +
            `👤 User ID: \`${userId}\`\n` +
            `🏷️ Username: ${username}\n` +
            `🌍 Domain: *${zones[zoneId]}*\n` +
            `🔗 Subdomain: *${subdomain}.${zones[zoneId]}*\n` +
            `📡 IP: \`${ipAddress}\``;

        bot.sendMessage(owner, notifMsg, { parse_mode: 'Markdown' });

        const fullDomain = `${subdomain}.${zones[zoneId]}`;
        
        return { 
            success: true, 
            message: `✅ Subdomain *${fullDomain}* berhasil dibuat.\n\nKetuk 1x untuk menyalin:\n\`${fullDomain}\``,
            fullDomain: fullDomain
        };

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
        
        dnsCache.delete(zoneId);

        return { success: true, message: `✅ Subdomain *${domain}* berhasil dihapus.` };
    } catch (error) {
        console.error('DELETE ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal menghapus subdomain.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};

const deleteAllSubdomains = async (zoneId, apiToken) => {
    const headers = { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
    try {
        const allRecords = await fetchAllDnsRecords(zoneId, apiToken);
        
        if (allRecords.length === 0) {
            return { success: true, count: 0, message: '✅ Tidak ada subdomain (Tipe A) yang ditemukan untuk dihapus.' };
        }

        const deletePromises = allRecords.map(record => {
            const deleteUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`;
            return axios.delete(deleteUrl, { headers });
        });

        const results = await Promise.allSettled(deletePromises);

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.filter(r => r.status === 'rejected').length;

        dnsCache.delete(zoneId);

        return {
            success: true,
            count: successCount,
            message: `✅ Berhasil menghapus *${successCount}* subdomain.\n⚠️ Gagal menghapus: *${failedCount}*.`
        };

    } catch (error) {
        console.error('DELETE ALL ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal total saat proses hapus semua.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
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
            ttl: record.ttl, 
            proxied: record.proxied 
        }, { headers });
        
        dnsCache.delete(zoneId);

        return { success: true, message: `✅ IP subdomain *${domain}* berhasil diubah ke *${newIp}*.` };
    } catch (error) {
        console.error('UPDATE IP ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal mengubah IP.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};

const toggleProxy = async (subdomain, zoneId, apiToken) => {
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
        const newProxiedState = !record.proxied; 

        const updateUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`;
        const updateData = {
            type: 'A',
            name: record.name,
            content: record.content, 
            ttl: record.ttl, 
            proxied: newProxiedState 
        };

        await axios.put(updateUrl, updateData, { headers });
        
        dnsCache.delete(zoneId);

        const statusText = newProxiedState ? '✅ *AKTIF* (Awan Oranye ☁️)' : '✅ *MATI* (Hanya DNS 🌐)';
        return { success: true, message: `Status proxy untuk *${domain}* berhasil diubah.\n\nStatus Baru: ${statusText}` };

    } catch (error) {
        console.error('TOGGLE PROXY ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal mengubah status proxy.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};

const toggleUnderAttackMode = async (zoneId, apiToken) => {
    const headers = {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
    };
    const settingsUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/security_level`;

    try {
        const getResp = await axios.get(settingsUrl, { headers });
        const currentLevel = getResp.data.result.value; 

        const newLevel = (currentLevel === 'under_attack') ? 'medium' : 'under_attack';

        await axios.patch(settingsUrl, { value: newLevel }, { headers });

        const statusText = (newLevel === 'under_attack') 
            ? '✅ *AKTIF* (Situs Anda kini dilindungi penuh)' 
            : '✅ *MATI* (Status keamanan kembali ke normal)';
            
        return { success: true, message: `Status *'Mode Sedang Diserang'* berhasil diubah.\n\nStatus Baru: ${statusText}` };

    } catch (error) {
        console.error('TOGGLE ATTACK MODE ERROR:', error?.response?.data || error.message);
        return {
            success: false,
            message: `❌ Gagal mengubah 'Mode Sedang Diserang'.\n*${error?.response?.data?.errors?.[0]?.message || error.message}*`
        };
    }
};


async function fetchAllDnsRecords(zoneId, apiToken) {
    let allRecords = [];
    let page = 1;
    let totalPages = 1;
    const headers = { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

    do {
        try {
            const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&per_page=100&page=${page}&order=name&direction=asc`;
            const response = await axios.get(url, { headers });
            
            if (response.data.result) {
                allRecords = allRecords.concat(response.data.result);
            }
            
            totalPages = response.data.result_info.total_pages || 1;
            page++;
            
        } catch (error) {
            console.error(`Error fetching page ${page} for zone ${zoneId}:`, error.message);
            throw error;
        }
    } while (page <= totalPages);
    
    return allRecords;
}

function generateListPage(records, domain, zoneId, page = 1) {
    const totalRecords = records.length;
    const totalPages = Math.ceil(totalRecords / SUBDOMAINS_PER_PAGE);
    
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * SUBDOMAINS_PER_PAGE;
    const end = start + SUBDOMAINS_PER_PAGE;
    const pageRecords = records.slice(start, end);

    const list = pageRecords.map((r, i) => {
        const index = start + i + 1;
        const name = escapeMarkdownV2(r.name);
        const content = escapeMarkdownV2(r.content);
        const proxyStatus = r.proxied ? '☁️' : '🌐'; 
        return `${index}\\. ${proxyStatus} ${name} → \`${content}\``;
    }).join('\n');

    const domainEscaped = escapeMarkdownV2(domain);
    const messageText = `📝 *List Subdomain \\(${domainEscaped}\\)*\n\n${list}`;

    const navigationButtons = [];
    if (page > 1) {
        navigationButtons.push({ text: '◀️ Sebelumnya', callback_data: `listpage:${zoneId}:${page - 1}` });
    }
    navigationButtons.push({ text: `${page} / ${totalPages}`, callback_data: 'noop' }); 
    if (page < totalPages) {
        navigationButtons.push({ text: 'Selanjutnya ▶️', callback_data: `listpage:${zoneId}:${page + 1}` });
    }

    const menuButtonRow = [{ text: '⬅️ Kembali ke Menu', callback_data: 'start' }];

    return {
        text: messageText,
        options: {
            reply_markup: { inline_keyboard: [navigationButtons, menuButtonRow] },
            parse_mode: 'MarkdownV2'
        }
    };
}


// === MODIFIKASI: FUNGSI BARU UNTUK MEMULAI PEMBAYARAN ===
/**
 * Memulai proses pembelian premium.
 * Dipanggil oleh /buyprem dan tombol 'Lanjutkan'.
 */
async function initiatePremiumPurchase(chatId, userId, username, firstName) {
    // 1. Cek jika sudah premium
    if (isUserPremium(userId)) {
        return bot.sendMessage(chatId, "✅ Akun Anda sudah Premium.");
    }

    // 2. Cek config Duitku
    if (!DuitkuMerchantCode || !DuitkuApiKey || !CallbackBaseUrl) {
         return bot.sendMessage(chatId, "⚠️ Fitur pembelian sedang tidak tersedia. (Admin belum setting).");
    }

    const { amount, duration } = loadPrice(); 
    const productName = `Akses Premium Bot (${duration} Hari)`;
    const reff = `PREM-${userId}-${Date.now()}`;

    // 3. Buat signature Duitku
    const rawSignature = DuitkuMerchantCode + reff + amount + DuitkuApiKey;
    const signature = crypto.createHash("md5").update(rawSignature).digest("hex");

    let paymentResp;
    try {
        // 4. Request Inquiry ke Duitku
        paymentResp = await axios.post("https://passport.duitku.com/webapi/api/merchant/v2/inquiry", {
          merchantCode: DuitkuMerchantCode,
          paymentAmount: amount,
          paymentMethod: "SP", // QRIS
          merchantOrderId: reff,
          productDetails: productName,
          customerVaName: firstName || "Telegram User",
          email: `${userId}@telegram.bot`, 
          phoneNumber: "08123456789", 
          itemDetails: [{ name: productName, price: amount, quantity: 1 }],
          callbackUrl: `${CallbackBaseUrl}/duitku-callback`,
          returnUrl: `https://t.me/${(await bot.getMe()).username}`,
          signature: signature,
          expiryPeriod: 10
        }, {
          headers: { "Content-Type": "application/json" }
        });

    } catch (e) {
        console.error("Duitku inquiry error (initiatePremiumPurchase):", e.response ? e.response.data : e.message);
        return bot.sendMessage(chatId, "❌ Gagal menghubungi gateway Duitku. Coba lagi nanti.");
    }

    const result = paymentResp.data;
    
    // 5. Cek respon Duitku
    if (result.statusCode !== "00") {
        console.error("Duitku Error Response (initiatePremiumPurchase):", result);
        return bot.sendMessage(chatId, "❌ Gagal membuat transaksi Duitku: " + result.statusMessage);
    }

    const qrString = result.qrString;
    const reference = result.reference; 
    const checkoutUrl = result.paymentUrl;

    // 6. Buat QR Code
    const buffer = await QRCode.toBuffer(qrString, { width: 400 });

    // 7. Kirim QR Code ke user
    const caption = `
🧾 *INVOICE PEMBAYARAN*

Produk: \`${productName}\`
Total Tagihan: \`Rp${amount}\`
Nomor Order: \`${reff}\`

Scan QRIS di atas atau klik tombol 'Bayar di Website'.
Kadaluarsa dalam *10 menit*.

_Bot akan mengecek otomatis. Jangan kirim apapun._
    `;
    
    const sentMsg = await bot.sendPhoto(chatId, buffer, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
              [ { text: "Bayar di Website", url: checkoutUrl } ],
              [ { text: "❌ Batalkan", callback_data: `CANCEL|${reff}` } ]
            ]
        }
    });

    // 8. Simpan order ke orders.json
    const orders = loadOrders();
    orders[reff] = {
        reff,
        targetTelegramId: userId,
        buyerUsername: username || `id_${userId}`,
        status: "pending",
        created: Date.now(),
        reference,
        qrisMessageId: sentMsg.message_id,
        chatId: chatId,
        amount: amount,
        duration: duration 
    };
    saveOrders(orders);

    // 9. Mulai Polling Pembayaran
    startPaymentPolling(reff, chatId, sentMsg.message_id);
}
// === AKHIR FUNGSI BARU ===


// === MENU UTAMA & START ===
function sendStartMenu(chatId, messageId = null) {
    const isPrem = isUserPremium(chatId);
    let welcomeText = `
☁️ CLOUDFLARE - SUBDOMAIN MANAGER

🚀 Kelola & atur subdomain dengan mudah  
🌍 Tambah • Ubah IP • Hapus • Lihat
`;

    if (isPrem) {
        const premiumData = loadPremiumUsers();
        const expiry = premiumData[String(chatId)];
        if (expiry === -1) {
            welcomeText += `\n✅ Status: *Premium Permanen*`;
        } else {
            const expiryDate = new Date(expiry).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
            welcomeText += `\n✅ Status: *Premium* (Aktif s/d: ${expiryDate})`;
        }
    } else {
         welcomeText += `\n\n💸 *Upgrade ke Premium* untuk akses fitur!\nGunakan /buyprem untuk membeli.`;
    }

    // === MODIFIKASI: Keyboard 2 Kolom ===
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                // Baris 1: Buat & Ubah IP
                [
                    { text: '➕ Buat Subdomain', callback_data: 'create' },
                    { text: '✏️ Ubah IP', callback_data: 'ubahip' }
                ],
                // Baris 2: Proxy & Hapus
                [
                    { text: '🔄 Status Proxy', callback_data: 'proxy' },
                    { text: '🗑️ Hapus Subdomain', callback_data: 'hapus' }
                ],
                // Baris 3: Lihat & Mode Serang
                [
                    { text: '📝 Lihat Subdomain', callback_data: 'listsub' },
                    { text: '🛡️ Under Attack Mode', callback_data: 'attack_mode' }
                ],
                 // Baris 4: Hapus Semua (Full width - Owner only)
                [
                    { text: '🔥 Hapus Semua Subdomain', callback_data: 'deleteall' }
                ],
                // Baris 5: Beli & Kontak
                [
                    { text: '💸 Beli Premium', callback_data: 'buy_prem_info' },
                    { text: '💬 Kontak Admin', url: `https://t.me/${(settings.adminUsername || 'kibiljoe')}` }
                ]
            ]
        },
        parse_mode: 'Markdown'
    };
    // === AKHIR MODIFIKASI ===

    try {
        if (messageId) {
            bot.editMessageText(welcomeText, { chat_id: chatId, message_id: messageId, ...keyboard });
        } else {
            bot.sendMessage(chatId, welcomeText, keyboard);
        }
    } catch (error) {
        console.error("Gagal mengirim/edit menu start:", error.message);
    }
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    sendStartMenu(chatId, null);
});

// === PERINTAH PAYMENT GATEWAY ===

bot.onText(/\/setprice (\d+) (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;
    
    if (String(senderId) !== String(owner)) {
        return bot.sendMessage(chatId, '❌ Hanya admin yang bisa menggunakan perintah ini.');
    }

    const newPrice = parseInt(match[1], 10);
    const newDuration = parseInt(match[2], 10);

    if (isNaN(newPrice) || newPrice <= 0 || isNaN(newDuration) || newDuration <= 0) {
        return bot.sendMessage(chatId, '⚠️ Format salah. Gunakan: `/setprice [harga] [hari]`\nContoh: `/setprice 10000 30`');
    }

    if (savePrice({ amount: newPrice, duration: newDuration })) {
        bot.sendMessage(chatId, `✅ Harga premium berhasil diubah:\n*Rp${newPrice}* untuk *${newDuration} hari*\\.`, { parse_mode: 'MarkdownV2' });
    } else {
        bot.sendMessage(chatId, '❌ Gagal menyimpan harga baru.');
    }
});

// === MODIFIKASI: /buyprem sekarang hanya memanggil fungsi ===
bot.onText(/\/buyprem/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;

    // Panggil fungsi yang sudah direfactor
    await initiatePremiumPurchase(chatId, userId, username, firstName);
});
// === AKHIR MODIFIKASI ===


// === FUNGSI POLLING (Sama seperti sebelumnya) ===
function startPaymentPolling(reff, chatId, qrisMessageId) {
    let attempts = 0;
    const maxAttempts = 40; 

    const interval = setInterval(async () => {
        const orders = loadOrders();
        const order = orders[reff];

        if (!order || order.status !== 'pending') {
            clearInterval(interval);
            activePollers.delete(reff);
            return;
        }

        attempts++;

        if (attempts > maxAttempts) { 
            clearInterval(interval);
            activePollers.delete(reff);
            
            try {
                await bot.deleteMessage(chatId, qrisMessageId);
            } catch (e) { /* biarkan */ }
            
            delete orders[reff];
            saveOrders(orders);
            
            await bot.sendMessage(chatId, `⏳ Invoice \`${reff}\` telah kadaluarsa. Silakan /buyprem lagi.`, { parse_mode: 'Markdown' });
            return;
        }

        try {
            const sigCheck = crypto.createHash("md5")
                .update(DuitkuMerchantCode + reff + DuitkuApiKey)
                .digest("hex");

            const statusResp = await axios.post("https://passport.duitku.com/webapi/api/merchant/transactionStatus", {
                merchantCode: DuitkuMerchantCode,
                merchantOrderId: reff,
                signature: sigCheck
            }, {
                headers: { "Content-Type": "application/json" }
            });

            const status = statusResp?.data?.statusCode;

            if (status === "00") { // Sukses
                clearInterval(interval);
                activePollers.delete(reff);
                await handleSuccessfulPayment(reff);

            } else if (status === "01") {
                // Pending
            } else if (status) {
                // Gagal
                clearInterval(interval);
                activePollers.delete(reff);
                delete orders[reff];
                saveOrders(orders);
                await bot.sendMessage(chatId, `⏳ Invoice \`${reff}\` gagal atau kadaluarsa (Status: ${statusResp?.data?.statusMessage || 'N/A'}).`, { parse_mode: 'Markdown' });
            }
        } catch (e) {
            console.error(`checkPayment polling error for ${reff}:`, e.message);
        }
    }, 15000); 

    activePollers.set(reff, interval);
}


// === FUNGSI SUKSES (Sama seperti sebelumnya) ===
async function handleSuccessfulPayment(merchantOrderId) {
    const orders = loadOrders();
    const order = orders[merchantOrderId];

    if (!order || order.status === "paid") {
        console.log(`[Payment] Order ${merchantOrderId} tidak ditemukan atau sudah dibayar.`);
        return; 
    }

    order.status = "paid";
    saveOrders(orders);
    
    const expiryTimestamp = activatePremium(order.targetTelegramId, order.duration);

    try {
        await bot.deleteMessage(order.chatId, order.qrisMessageId);
    } catch (e) {
        console.warn(`[Payment] Gagal hapus pesan QRIS ${order.qrisMessageId}: ${e.message}`);
    }

    const expiryDate = new Date(expiryTimestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    try {
        await bot.sendMessage(order.chatId, `
✅ *TRANSAKSI BERHASIL*
Nomor Order: \`${order.reff}\`
Produk: \`Akses Premium (${order.duration} Hari)\`
Total: \`Rp${order.amount}\`

🎉 Selamat! Akun Anda telah di-upgrade menjadi *Premium*.
Status aktif sampai: *${expiryDate}*
`, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error(`[Payment] Gagal kirim pesan sukses ke user ${order.chatId}: ${e.message}`);
    }

    try {
        await bot.sendMessage(owner, `
✅ *PENJUALAN PREMIUM BARU*
User: @${order.buyerUsername} (ID: \`${order.targetTelegramId}\`)
Nomor Order: \`${order.reff}\`
Total: \`Rp${order.amount}\` (${order.duration} Hari)
`, { parse_mode: 'Markdown' });
    } catch (e) {
         console.error(`[Payment] Gagal kirim log ke owner ${owner}: ${e.message}`);
    }
}


// === PERINTAH ADMIN (Sama seperti sebelumnya) ===
bot.onText(/\/addprem (\d+)(?: (\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (String(senderId) !== String(owner)) {
        return bot.sendMessage(chatId, '❌ Hanya admin yang bisa menggunakan perintah ini.');
    }

    const userIdToAdd = match[1];
    const duration = match[2] ? parseInt(match[2], 10) : -1; 
    
    const expiryTimestamp = activatePremium(userIdToAdd, duration);
    
    let replyMsg;
    if (expiryTimestamp === -1) {
        replyMsg = `✅ User ID \`${userIdToAdd}\` berhasil ditambahkan sebagai *Premium Permanen*.`;
    } else {
        const expiryDate = new Date(expiryTimestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        replyMsg = `✅ User ID \`${userIdToAdd}\` berhasil ditambahkan sebagai *Premium*.\nAktif sampai: *${expiryDate}*`;
    }
    
    bot.sendMessage(chatId, replyMsg, { parse_mode: 'Markdown' });
});

bot.onText(/\/delprem (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (String(senderId) !== String(owner)) {
        return bot.sendMessage(chatId, '❌ Hanya admin yang bisa menggunakan perintah ini.');
    }

    const userIdToRemove = match[1];
    const premiumUsers = loadPremiumUsers();

    if (!premiumUsers[userIdToRemove]) {
        return bot.sendMessage(chatId, `⚠️ User ID \`${userIdToRemove}\` tidak ditemukan di daftar premium.`, { parse_mode: 'Markdown' });
    }

    delete premiumUsers[userIdToRemove]; 
    savePremiumUsers(premiumUsers);
    bot.sendMessage(chatId, `✅ User ID \`${userIdToRemove}\` berhasil dihapus dari *Premium*.`, { parse_mode: 'Markdown' });
});

bot.onText(/^\/(broadcast|bc) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const message = match[2];

  if (String(msg.from.id) !== String(owner)) return;

  let success = 0;
  let failed = 0;

  const premiumUsers = loadPremiumUsers();
  const allUserIds = Object.keys(premiumUsers);
  
  const allUsers = [...new Set([owner, ...allUserIds])]; 

  for (let id of allUsers) {
    if (isUserPremium(id)) { 
        try {
          await bot.sendMessage(id, message);
          success++;
        } catch (e) {
          console.log(`Gagal kirim ke ${id}`);
          failed++;
        }
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

    const premiumUsers = loadPremiumUsers();
    const entries = Object.entries(premiumUsers);

    if (entries.length === 0) {
        return bot.sendMessage(chatId, '📭 Tidak ada user yang terdaftar sebagai Premium.');
    }
    
    const list = entries.map(([id, timestamp], index) => {
        let expiryText;
        if (timestamp === -1) {
            expiryText = '*Permanen*';
        } else {
            const date = new Date(timestamp);
            if (date.getTime() <= Date.now()) {
                expiryText = `_(Kedaluwarsa)_`;
            } else {
                expiryText = date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
            }
        }
        return `${index + 1}. \`${id}\` - ${expiryText}`;
    }).join('\n');
    
    bot.sendMessage(chatId, `📋 *Daftar Premium Users:*\n\n${list}`, {
        parse_mode: 'Markdown'
    });
});


// === CALLBACK QUERY HANDLER ===
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    const msgId = query.message.message_id;

    // Handler Batal Pembayaran
    if (data.startsWith('CANCEL|')) {
        const reff = data.split('|')[1];
        const orders = loadOrders();
        const order = orders[reff];

        if (order && String(order.targetTelegramId) === String(userId)) {
            const interval = activePollers.get(reff);
            if (interval) {
                clearInterval(interval);
                activePollers.delete(reff);
            }
            
            delete orders[reff];
            saveOrders(orders);
            try {
                await bot.deleteMessage(chatId, msgId);
            } catch(e) {}
            
            bot.sendMessage(chatId, "Pesanan telah dibatalkan.");
            
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Ini bukan pesanan Anda!' });
        }
        return;
    }
    
    // === MODIFIKASI: Handler Tombol Info Beli (tambah tombol Lanjutkan/Kembali) ===
    if (data === 'buy_prem_info') {
        const { amount, duration } = loadPrice();
        bot.answerCallbackQuery(query.id);
        
        try {
            await bot.editMessageText(
                `💸 *Beli Akses Premium*\n\nHarga: *Rp${amount}*\nMasa Aktif: *${duration} hari*\n\nTekan "Lanjutkan" untuk membuat invoice pembayaran QRIS.`,
                {
                    chat_id: chatId,
                    message_id: msgId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '⬅️ Kembali', callback_data: 'start' },
                                { text: 'Lanjutkan ➡️', callback_data: 'buy_prem_confirm' } // <-- Tombol Lanjutkan
                            ]
                        ]
                    }
                }
            );
        } catch (e) { /* Gagal edit, mungkin pesan tidak berubah */ }
        return;
    }
    // === AKHIR MODIFIKASI ===

    // === BARU: Handler Tombol "Lanjutkan" Pembelian ===
    if (data === 'buy_prem_confirm') {
        bot.answerCallbackQuery(query.id, { text: 'Membuat invoice...' });
        
        // Hapus pesan "Lanjutkan" agar bersih
        try {
            await bot.deleteMessage(chatId, msgId);
        } catch(e) {}

        // Ambil data user dari `query`
        const userId = query.from.id;
        const username = query.from.username;
        const firstName = query.from.first_name;

        // Panggil fungsi utama
        await initiatePremiumPurchase(chatId, userId, username, firstName);
        
        return;
    }
    // === AKHIR HANDLER BARU ===


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
    
    if (data === 'noop') {
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (data === 'start') {
        bot.answerCallbackQuery(query.id);
        sendStartMenu(chatId, msgId); 
        return;
    }

    if (data.startsWith('deleteall_confirm:')) {
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

        await bot.editMessageText(`⏳ Menghapus semua subdomain dari *${escapeMarkdownV2(domain)}*\\.\\.\\. Ini mungkin butuh waktu beberapa saat\\.`, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'MarkdownV2'
        });

        const res = await deleteAllSubdomains(zoneId, apiToken);

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

    // Cek Izin
    if (['create', 'hapus', 'ubahip', 'listsub', 'deleteall', 'proxy', 'attack_mode'].includes(data)) {
        
        let hasPermission = false;

        if (data === 'deleteall' || data === 'attack_mode') {
            if (String(userId) === String(owner)) {
                hasPermission = true;
            } else {
                bot.answerCallbackQuery(query.id);
                return bot.sendMessage(chatId, '❌ Fitur ini hanya untuk *Owner Utama* bot.', {
                    parse_mode: 'Markdown'
                });
            }
        } else {
            if (isUserPremium(userId)) {
                hasPermission = true;
            } else {
                bot.answerCallbackQuery(query.id); 
                return bot.sendMessage(chatId, '❌ Fitur ini hanya untuk *pengguna Premium*.\nStatus Anda tidak aktif. Silahkan Beli Akses Premium Dulu.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '💸 Beli Premium', callback_data: 'buy_prem_info' }]]
                    }
                });
            }
        }

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


    // Handler Aksi per Domain
    const [action, zoneId] = data.split(':');
    if (!zones[zoneId]) {
        bot.answerCallbackQuery(query.id);
        return bot.sendMessage(chatId, '❗ Domain tidak ditemukan.');
    }

    const apiToken = apiTokens[zoneId];
    if (!apiToken) {
        bot.answerCallbackQuery(query.id);
        return bot.sendMessage(chatId, '⚠️ Token API tidak ditemukan untuk domain ini.');
    }

    userState[userId] = { step: action, zoneId };
    const domain = zones[zoneId];
    bot.answerCallbackQuery(query.id); 

    if (action === 'create') {
        return bot.editMessageText('✍️ Kirim format:\n`subdomain ip`\n\nContoh: `vpnuser 1.2.3.4`', { 
            chat_id: chatId, 
            message_id: msgId, 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '⬅️ Batal', callback_data: 'start' }]]
            }
        });
    }

    if (action === 'ubahip') {
        return bot.editMessageText('✍️ Kirim format:\n`sub.domain.tld ip`\n\nContoh: `vpn.' + domain + ' 1.2.3.4`', { 
            chat_id: chatId, 
            message_id: msgId, 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '⬅️ Batal', callback_data: 'start' }]]
            }
        });
    }

    if (action === 'proxy') {
        return bot.editMessageText('✍️ Kirim nama subdomain yang ingin diubah status proxynya:\n\nContoh: `vpnuser` atau `vpn.' + domain + '`', { 
            chat_id: chatId, 
            message_id: msgId, 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '⬅️ Batal', callback_data: 'start' }]]
            }
        });
    }

    if (action === 'hapus') {
        return bot.editMessageText('✍️ Kirim nama subdomain yang akan dihapus:\nContoh: `vpnuser`', { 
            chat_id: chatId, 
            message_id: msgId,
            reply_markup: {
                inline_keyboard: [[{ text: '⬅️ Batal', callback_data: 'start' }]]
            }
        });
    }

    if (action === 'attack_mode') {
        const domainEscaped = escapeMarkdownV2(domain);

        await bot.editMessageText(`⏳ Mengubah status 'Mode Diserang' untuk *${domainEscaped}*\\.\\.\\.`, { 
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'MarkdownV2'
        });

        const res = await toggleUnderAttackMode(zoneId, apiToken);

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

    if (action === 'deleteall') {
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
                        [ { text: '❌ TIDAK, BATALKAN', callback_data: 'start' } ],
                        [ { text: '✅ YA, SAYA YAKIN HAPUS SEMUA', callback_data: `deleteall_confirm:${zoneId}` } ]
                    ]
                }
            }
        );
        return;
    }

    if (action === 'listsub') {
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

// === MESSAGE HANDLER ===
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : "";
    if (!text) return; 
    if (text.startsWith('/')) return; 

    if (!userState[userId] || !userState[userId].step) return;

    const backToMenuKeyboard = {
        reply_markup: {
            inline_keyboard: [[{ text: '⬅️ Kembali ke Menu', callback_data: 'start' }]]
        }
    };

    const { step, zoneId } = userState[userId];
    
    if (!zoneId) {
        delete userState[userId];
        return;
    }

    const apiToken = apiTokens[zoneId];

    if (!apiToken) {
        delete userState[userId];
        return bot.sendMessage(chatId, '⚠️ Token API tidak ditemukan.');
    }

    const domain = zones[zoneId]; 

    if (!isUserPremium(userId)) {
         delete userState[userId];
         return bot.sendMessage(chatId, '❌ Fitur ini hanya untuk *pengguna Premium*.\nStatus Anda tidak aktif.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '💸 Beli Premium', callback_data: 'buy_prem_info' }]]
            }
        });
    }

    if (step === 'create') {
        const parts = text.split(' ');
        if (parts.length !== 2) {
            return bot.sendMessage(chatId, '⚠️ Format salah. Gunakan:\n`subdomain ip`\nContoh: `vpnuser 1.2.3.4`', { 
                parse_mode: 'Markdown', 
                ...backToMenuKeyboard
            });
        }

        const [sub, ip] = parts;
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

        const res = await createSubdomain(sub, ip, zoneId, apiToken, userId, username);

        bot.sendMessage(chatId, res.message, {
            parse_mode: 'Markdown',
            ...backToMenuKeyboard 
        });
    }


    if (step === 'ubahip') {
        const parts = text.split(' ');
        if (parts.length !== 2) return bot.sendMessage(chatId, '⚠️ Format salah. Gunakan:\n`vpn.domain.tld ip`\nContoh: `vpn.domain.com 1.2.3.4`', { 
            parse_mode: 'Markdown',
            ...backToMenuKeyboard 
        });

        const [fullSub, ip] = parts;
        const sub = fullSub.includes(domain) ? fullSub.replace(`.${domain}`, '') : fullSub;

        const res = await updateSubdomainIP(sub, ip, zoneId, apiToken);
        bot.sendMessage(chatId, res.message, { 
            parse_mode: 'Markdown',
            ...backToMenuKeyboard
        });
    }

    if (step === 'hapus') {
        const sub = text.includes(domain) ? text.replace(`.${domain}`, '') : text;
        const res = await deleteSubdomain(sub, zoneId, apiToken);
        bot.sendMessage(chatId, res.message, { 
            parse_mode: 'Markdown',
            ...backToMenuKeyboard
        });
    }

    if (step === 'proxy') {
        const sub = text.includes(domain) ? text.replace(`.${domain}`, '') : text;
        
        const res = await toggleProxy(sub, zoneId, apiToken);
        bot.sendMessage(chatId, res.message, { 
            parse_mode: 'Markdown',
            ...backToMenuKeyboard
        });
    }
    
    delete userState[userId]; 
});


// === WEB SERVER & CALLBACK ===

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.get('/ping', (req, res) => {
  res.status(200).send('Pong!');
});

app.post('/duitku-callback', async (req, res) => {
    const { merchantCode, amount, merchantOrderId, productDetail, additionalParam, paymentCode, resultCode, signature } = req.body;

    console.log('[Callback Duitku] Menerima callback:', req.body);

    if (!merchantCode || !merchantOrderId || !resultCode || !signature) {
        console.error('[Callback Duitku] Data callback tidak lengkap.');
        return res.status(400).json({ status: 'error', message: 'Bad Request: Missing parameters' });
    }

    const calculatedSignature = crypto.createHash('md5')
        .update(merchantCode + amount + merchantOrderId + DuitkuApiKey)
        .digest('hex');
    
    if (signature !== calculatedSignature) {
        console.error(`[Callback Duitku] Signature mismatch for ${merchantOrderId}.`);
        return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }

    if (resultCode === '00') {
        console.log(`[Callback Duitku] Pembayaran sukses untuk ${merchantOrderId}.`);
        await handleSuccessfulPayment(merchantOrderId);
        res.status(200).json({ status: 'success', message: 'Callback processed' });

    } else {
        console.log(`[Callback Duitku] Pembayaran GAGAL/PENDING untuk ${merchantOrderId} (Code: ${resultCode}).`);
        
        const orders = loadOrders();
        if (orders[merchantOrderId] && orders[merchantOrderId].status === 'pending') {
            const interval = activePollers.get(merchantOrderId);
            if (interval) {
                clearInterval(interval);
                activePollers.delete(merchantOrderId);
            }
            delete orders[merchantOrderId];
            saveOrders(orders);
            console.log(`[Callback Duitku] Order ${merchantOrderId} dihapus karena gagal.`);
        }
        
        res.status(200).json({ status: 'success', message: 'Callback for failure processed' });
    }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT} dan siap menerima callback Duitku di /duitku-callback`);
});

process.on('uncaughtException', (err) => {
  console.error('Error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});