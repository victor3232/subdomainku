
'use client';
import { useState } from 'react';

export default function Home() {
  const [action, setAction] = useState('create');
  const [domain, setDomain] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [ip, setIp] = useState('');
  const [result, setResult] = useState('');
  const [list, setList] = useState('');

  const handleSubmit = async () => {
    let url = '/api/' + action;
    let body: any = { domain, subdomain };
    if (action === 'create' || action === 'update') body.ip = ip;

    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (action === 'list') {
      setList(data.records?.map((r: any, i: number) => `${i + 1}. ${r.name} → ${r.content}`).join('\n') || '');
    } else {
      setResult(data.message || 'Done');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 gap-4 bg-gray-100">
      <h1 className="text-xl font-bold">Cloudflare Subdomain Manager</h1>
      <select value={action} onChange={(e) => setAction(e.target.value)} className="p-2 rounded border">
        <option value="create">Create</option>
        <option value="delete">Delete</option>
        <option value="update">Update IP</option>
        <option value="list">List Subdomains</option>
      </select>
      <input type="text" placeholder="Domain (e.g. hitsssh.web.id)" value={domain} onChange={(e) => setDomain(e.target.value)} className="p-2 rounded border w-full max-w-md" />
      <input type="text" placeholder="Subdomain (e.g. test)" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} className="p-2 rounded border w-full max-w-md" />
      {(action === 'create' || action === 'update') && (
        <input type="text" placeholder="IP Address (e.g. 1.2.3.4)" value={ip} onChange={(e) => setIp(e.target.value)} className="p-2 rounded border w-full max-w-md" />
      )}
      <button onClick={handleSubmit} className="bg-blue-500 text-white p-2 px-4 rounded">Submit</button>
      {result && <pre className="text-green-700 mt-4">{result}</pre>}
      {list && <pre className="text-gray-800 mt-4 whitespace-pre-wrap">{list}</pre>}
    </main>
  );
}
