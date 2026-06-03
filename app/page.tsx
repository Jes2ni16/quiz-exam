"use client";

import { useState, useCallback } from "react";

interface Contact {
  [key: string]: string;
}

interface Draft {
  to: string;
  subject: string;
  body: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: Contact[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows: Contact[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]).map((v) => v.trim());
    const row: Contact = {};
    headers.forEach((h, j) => {
      row[h] = vals[j] || "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

function renderTemplate(template: string, contact: Contact): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => contact[key] ?? `{{${key}}}`);
}

function findEmailColumn(headers: string[]): string | null {
  const emailCols = ["email", "Email", "EMAIL", "e-mail", "E-mail", "mail"];
  return headers.find((h) => emailCols.includes(h)) || null;
}

const SAMPLE_CSV = `name,email,company,role
Alice,alice@acme.co,Acme,CTO
Bob,bob@beta.io,Beta,PM
Carla,carla@gamma.dev,Gamma,Engineer
Dave,dave@delta.com,"Delta, Inc.",Designer`;

export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("Hey {{name}}, quick question");
  const [bodyTemplate, setBodyTemplate] = useState(
    `Hi {{name}},\n\nI noticed you work at {{company}} as a {{role}}. Loved what your team is doing.\n\nWould love to chat sometime.\n\nCheers`
  );
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setHeaders(headers);
      setContacts(rows);
      setDrafts([]);
      const emailCol = findEmailColumn(headers);
      if (!emailCol) {
        setError(`no email column found. expected one of: email, Email, EMAIL, e-mail`);
      }
    };
    reader.readAsText(file);
  }, []);

  const loadSample = () => {
    const { headers, rows } = parseCSV(SAMPLE_CSV);
    setHeaders(headers);
    setContacts(rows);
    setFileName("sample.csv");
    setError("");
    setDrafts([]);
  };

  const generateDrafts = () => {
    const emailCol = findEmailColumn(headers);
    const d: Draft[] = contacts.map((c) => ({
      to: emailCol ? c[emailCol] : "(no email column)",
      subject: renderTemplate(subjectTemplate, c),
      body: renderTemplate(bodyTemplate, c),
    }));
    setDrafts(d);
  };

  const copyDraft = (idx: number) => {
    const d = drafts[idx];
    const text = `To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`;
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyAll = () => {
    const text = drafts
      .map((d) => `To: ${d.to}\nSubject: ${d.subject}\n\n${d.body}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopied(-1);
    setTimeout(() => setCopied(null), 1500);
  };

  const openMailto = (idx: number) => {
    const d = drafts[idx];
    const url = `mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
    window.open(url, "_blank");
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditSubject(drafts[idx].subject);
    setEditBody(drafts[idx].body);
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    const updated = [...drafts];
    updated[editingIdx] = { ...updated[editingIdx], subject: editSubject, body: editBody };
    setDrafts(updated);
    setEditingIdx(null);
  };

  const reset = () => {
    setContacts([]);
    setHeaders([]);
    setFileName("");
    setDrafts([]);
    setError("");
    setEditingIdx(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="flex justify-between items-start mb-1">
        <h1 className="text-2xl font-bold">csv → email drafts</h1>
        <button
          onClick={reset}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1 rounded"
        >
          reset
        </button>
      </div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-zinc-500 text-sm">
          upload a csv, write a template with {"{{column_name}}"} placeholders, get drafts.
        </p>
        <button
          onClick={() => setShowGuide(true)}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1 rounded"
        >
          view guide
        </button>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowGuide(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">csv format guide</h2>
              <button onClick={() => setShowGuide(false)} className="text-zinc-500 hover:text-zinc-300 text-sm">close</button>
            </div>

            <div className="mb-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">column rules</h3>
              <table className="w-full text-xs border border-zinc-800 rounded overflow-hidden">
                <thead>
                  <tr className="bg-zinc-800/60">
                    <th className="text-left p-2 text-zinc-400 font-medium">column</th>
                    <th className="text-left p-2 text-zinc-400 font-medium">required</th>
                    <th className="text-left p-2 text-zinc-400 font-medium">placeholder</th>
                    <th className="text-left p-2 text-zinc-400 font-medium">example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-zinc-800">
                    <td className="p-2 text-emerald-400 font-medium">email</td>
                    <td className="p-2 text-emerald-400">yes</td>
                    <td className="p-2 text-amber-400">{"{{email}}"}</td>
                    <td className="p-2 text-zinc-400">alice@acme.co</td>
                  </tr>
                  <tr className="border-t border-zinc-800">
                    <td className="p-2 text-zinc-300">name</td>
                    <td className="p-2 text-zinc-500">no</td>
                    <td className="p-2 text-amber-400">{"{{name}}"}</td>
                    <td className="p-2 text-zinc-400">Alice</td>
                  </tr>
                  <tr className="border-t border-zinc-800">
                    <td className="p-2 text-zinc-300">company</td>
                    <td className="p-2 text-zinc-500">no</td>
                    <td className="p-2 text-amber-400">{"{{company}}"}</td>
                    <td className="p-2 text-zinc-400">Acme</td>
                  </tr>
                  <tr className="border-t border-zinc-800">
                    <td className="p-2 text-zinc-300">role</td>
                    <td className="p-2 text-zinc-500">no</td>
                    <td className="p-2 text-amber-400">{"{{role}}"}</td>
                    <td className="p-2 text-zinc-400">CTO</td>
                  </tr>
                  <tr className="border-t border-zinc-800">
                    <td className="p-2 text-zinc-300 italic">any custom</td>
                    <td className="p-2 text-zinc-500">no</td>
                    <td className="p-2 text-amber-400">{"{{column}}"}</td>
                    <td className="p-2 text-zinc-400">anything</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mb-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">notes</h3>
              <ul className="text-xs text-zinc-500 space-y-1">
                <li>email column also accepts: Email, EMAIL, e-mail</li>
                <li>use <span className="text-amber-400">{"{{column_name}}"}</span> in subject/body to personalize</li>
                <li>wrap values with commas in quotes: <span className="text-zinc-300">{"\"Smith, John\""}</span></li>
                <li>add any columns you want — they all become placeholders</li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">example csv</h3>
              <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-3 overflow-x-auto">
{`name,email,company,role
Alice,alice@acme.co,Acme,CTO
Bob,bob@beta.io,Beta,PM
Carla,carla@gamma.dev,"Gamma, Inc.",Engineer`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {headers.length > 0 && (
        <div className="mb-4 p-3 bg-zinc-900/50 border border-zinc-800 rounded text-xs text-zinc-400">
          available placeholders: {headers.map((h, i) => (
            <span key={i}>
              {i > 0 && ", "}<span className="text-amber-400">{`{{${h}}}`}</span>
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-800 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* upload */}
      <div className="mb-6 border border-zinc-800 rounded-lg p-4">
        <label className="block text-sm text-zinc-400 mb-2">
          {fileName ? `loaded: ${fileName}` : "pick a csv file"}
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="text-sm"
        />
        <button
          onClick={loadSample}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 underline"
        >
          or load sample data
        </button>
        {headers.length > 0 && (
          <div className="mt-3 text-xs text-zinc-500">
            columns found: {headers.join(", ")} &middot; {contacts.length} rows
          </div>
        )}
      </div>

      {/* templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">subject template</label>
          <input
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">body template</label>
          <textarea
            className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-sm h-40"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
          />
        </div>
      </div>

      {/* generate */}
      <button
        onClick={generateDrafts}
        disabled={contacts.length === 0}
        className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white px-5 py-2 rounded text-sm font-medium mb-6"
      >
        generate {contacts.length > 0 ? `${contacts.length} drafts` : "drafts"}
      </button>

      {drafts.length > 0 && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={copyAll}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded text-sm"
          >
            copy all {copied === -1 ? "✓" : ""}
          </button>
        </div>
      )}

      {/* drafts */}
      <div className="space-y-3">
        {drafts.map((d, i) => (
          <div
            key={i}
            className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50"
          >
            {editingIdx === i ? (
              <div className="space-y-2">
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                />
                <textarea
                  className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm h-32"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="text-xs bg-emerald-700 hover:bg-emerald-600 px-3 py-1 rounded">save</button>
                  <button onClick={() => setEditingIdx(null)} className="text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1 rounded">cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs text-zinc-500">to:</span>{" "}
                    <span className="text-sm">{d.to}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(i)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded"
                    >
                      edit
                    </button>
                    <button
                      onClick={() => openMailto(i)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded"
                    >
                      mailto
                    </button>
                    <button
                      onClick={() => copyDraft(i)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded"
                    >
                      {copied === i ? "✓ copied" : "copy"}
                    </button>
                  </div>
                </div>
                <div className="text-sm font-medium mb-2">{d.subject}</div>
                <pre className="text-xs text-zinc-400 whitespace-pre-wrap">{d.body}</pre>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}