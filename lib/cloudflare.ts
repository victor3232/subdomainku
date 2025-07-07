
import { zones, apiTokens } from '@/data/config';
import axios from 'axios';

export async function createSubdomain(subdomain: string, ip: string, domain: string) {
  const zoneId = Object.keys(zones).find(z => zones[z] === domain);
  if (!zoneId) return { success: false, message: 'Invalid domain' };
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
  const headers = {
    'Authorization': `Bearer ${apiTokens[zoneId]}`,
    'Content-Type': 'application/json'
  };
  try {
    const res = await axios.post(url, {
      type: 'A',
      name: `${subdomain}.${domain}`,
      content: ip,
      ttl: 3600,
      proxied: false
    }, { headers });
    return { success: true, message: `✅ Subdomain ${subdomain}.${domain} berhasil dibuat.` };
  } catch (e) {
    return { success: false, message: '❌ Gagal membuat subdomain.' };
  }
}

export async function deleteSubdomain(subdomain: string, domain: string) {
  const zoneId = Object.keys(zones).find(z => zones[z] === domain);
  if (!zoneId) return { success: false, message: 'Invalid domain' };
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${subdomain}.${domain}`;
  const headers = {
    'Authorization': `Bearer ${apiTokens[zoneId]}`,
    'Content-Type': 'application/json'
  };
  try {
    const res = await axios.get(url, { headers });
    if (!res.data.result.length) return { success: false, message: 'Subdomain tidak ditemukan' };
    const recordId = res.data.result[0].id;
    await axios.delete(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, { headers });
    return { success: true, message: `🗑️ Subdomain ${subdomain}.${domain} berhasil dihapus.` };
  } catch (e) {
    return { success: false, message: '❌ Gagal menghapus subdomain.' };
  }
}

export async function updateSubdomainIP(subdomain: string, ip: string, domain: string) {
  const zoneId = Object.keys(zones).find(z => zones[z] === domain);
  if (!zoneId) return { success: false, message: 'Invalid domain' };
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${subdomain}.${domain}`;
  const headers = {
    'Authorization': `Bearer ${apiTokens[zoneId]}`,
    'Content-Type': 'application/json'
  };
  try {
    const res = await axios.get(url, { headers });
    if (!res.data.result.length) return { success: false, message: 'Subdomain tidak ditemukan' };
    const record = res.data.result[0];
    await axios.put(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`, {
      type: 'A',
      name: `${subdomain}.${domain}`,
      content: ip,
      ttl: 3600,
      proxied: false
    }, { headers });
    return { success: true, message: `🔁 IP berhasil diubah ke ${ip}.` };
  } catch (e) {
    return { success: false, message: '❌ Gagal ubah IP.' };
  }
}

export async function listSubdomains(domain: string) {
  const zoneId = Object.keys(zones).find(z => zones[z] === domain);
  if (!zoneId) return { success: false, message: 'Invalid domain' };
  const headers = {
    'Authorization': `Bearer ${apiTokens[zoneId]}`,
    'Content-Type': 'application/json'
  };
  try {
    const res = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A`, { headers });
    return { success: true, records: res.data.result };
  } catch (e) {
    return { success: false, message: '❌ Gagal mengambil data.' };
  }
}
