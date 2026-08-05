"use client";

import { useState, useEffect } from "react";

type Drafts = { draft_1: string; draft_2: string; draft_3: string };
type ChatMessage = { role: "user" | "assistant"; content: string };
type SourceItem = { title: string; snippet: string; url: string };

export default function Home() {
  // Markdown to HTML renderer
  const renderMarkdown = (text: string): string => {
    if (!text) return '';
    let html = text
      // Escape HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headings (### h3, ## h2, # h1)
      .replace(/^### (.+)$/gm, '<h4 style="margin: 1rem 0 0.5rem; color: var(--text-primary); font-size: 1rem;">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 style="margin: 1.2rem 0 0.5rem; color: var(--text-primary); font-size: 1.1rem;">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 style="margin: 1.2rem 0 0.5rem; color: var(--text-primary); font-size: 1.2rem;">$1</h2>')
      // Bold: **text**
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>')
      // Italic: *text*
      .replace(/(?<![*])\*(?![*])(.+?)(?<![*])\*(?![*])/g, '<em>$1</em>')
      // Bullet points: * item or - item
      .replace(/^[*\-] (.+)$/gm, '<li style="margin: 0.25rem 0; margin-left: 1.5rem; list-style: disc;">$1</li>')
      // Line breaks
      .replace(/\n/g, '<br/>');
    return html;
  };
  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Generation State
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  const [rawThoughts, setRawThoughts] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  
  // Editor State
  const [activeDraftIndex, setActiveDraftIndex] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [editInstruction, setEditInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  // Sources State
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [researchConfidence, setResearchConfidence] = useState<string | null>(null);
  const [researchSource, setResearchSource] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("postcraft_token");
    if (saved) setToken(saved);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/signup";
    
    try {
      let body, headers;
      if (isLoginMode) {
        // OAuth2PasswordRequestForm requires x-www-form-urlencoded
        body = new URLSearchParams();
        body.append("username", username);
        body.append("password", password);
        headers = { "Content-Type": "application/x-www-form-urlencoded" };
      } else {
        body = JSON.stringify({ username, password });
        headers = { "Content-Type": "application/json" };
      }

      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: "POST",
        headers,
        body
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");
      
      localStorage.setItem("postcraft_token", data.access_token);
      setToken(data.access_token);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("postcraft_token");
    setToken(null);
    setGenerationId(null);
    setDrafts(null);
    setActiveDraftIndex(null);
  };

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDrafts(null);
    setActiveDraftIndex(null);
    setChatHistory([]);
    setIsFinalized(false);
    setSources([]);
    setResearchConfidence(null);
    setResearchSource(null);

    try {
      const response = await fetch("http://localhost:8000/api/generations", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ topic, platform, raw_thoughts: rawThoughts }),
      });

      if (response.status === 401) {
        handleLogout();
        throw new Error("Session expired. Please log in again.");
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `API Error: ${response.statusText}`);
      if (data.status === "failed") throw new Error(data.error || "Generation failed in the pipeline.");
      if (data.status === "needs_review") setError("Note: The quality checker flagged these drafts. They may need manual editing.");

      setGenerationId(data.generation_id);
      setDrafts({
        draft_1: data.draft_1,
        draft_2: data.draft_2,
        draft_3: data.draft_3,
      });
      setSources(data.sources || []);
      setResearchConfidence(data.research_confidence || null);
      setResearchSource(data.research_source || null);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDraft = (index: number) => {
    setActiveDraftIndex(index);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim() || !generationId || activeDraftIndex === null) return;
    
    setIsEditing(true);
    const newInstruction = editInstruction;
    setEditInstruction("");
    setChatHistory(prev => [...prev, { role: "user", content: newInstruction }]);

    try {
      const response = await fetch(`http://localhost:8000/api/generations/${generationId}/edit`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ instruction: newInstruction, draft_index: activeDraftIndex }),
      });

      if (!response.ok) throw new Error("Failed to edit draft");
      const data = await response.json();
      
      setChatHistory(prev => [...prev, { role: "assistant", content: "Draft revised successfully." }]);
      
      setDrafts(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          [`draft_${activeDraftIndex}`]: data.revised_draft
        };
      });
    } catch (err: any) {
      setError(err.message);
      setChatHistory(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setIsEditing(false);
    }
  };

  const handleFinalize = async () => {
    if (!generationId || activeDraftIndex === null) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/generations/${generationId}/finalize`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ final_draft_index: activeDraftIndex }),
      });
      if (!response.ok) throw new Error("Failed to finalize draft");
      setIsFinalized(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!token) {
    return (
      <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
        <div className="header">
          <h1>PostCraft AI</h1>
          <p>{isLoginMode ? "Log in to your account" : "Create a new account"}</p>
        </div>
        <form className="card" onSubmit={handleAuth}>
          <div className="form-group">
            <label>Username</label>
            <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
            {isLoginMode ? "Log In" : "Sign Up"}
          </button>
          {authError && <div className="error-message" style={{ marginBottom: '1rem' }}>{authError}</div>}
          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <a href="#" onClick={(e) => { e.preventDefault(); setIsLoginMode(!isLoginMode); setAuthError(""); }} style={{ color: 'var(--accent-primary)' }}>
              {isLoginMode ? "Sign up" : "Log in"}
            </a>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>PostCraft AI</h1>
          <p>Transform your raw thoughts into high-performing social posts.</p>
        </div>
        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Log Out</button>
      </div>

      <div className="main-content">
        {!activeDraftIndex && (
          <form className="card" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="platform">Target Platform</label>
              <select id="platform" className="form-control" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X (Twitter)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="topic">Main Topic / Theme</label>
              <input type="text" id="topic" className="form-control" placeholder="e.g. B2B SaaS Growth Strategies" value={topic} onChange={(e) => setTopic(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="rawThoughts">Your Raw Thoughts (The Substance)</label>
              <textarea id="rawThoughts" className="form-control" placeholder="Brain dump your core ideas here..." value={rawThoughts} onChange={(e) => setRawThoughts(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><div className="spinner"></div>Crafting Posts...</> : "Generate Drafts"}
            </button>
            {error && <div className="error-message">{error}</div>}
          </form>
        )}

        {drafts && !activeDraftIndex && sources.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>📎 Research Sources</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {researchConfidence && (
                  <span className="finalized-badge" style={{
                    background: researchConfidence === 'high' ? 'rgba(34, 197, 94, 0.2)' : researchConfidence === 'medium' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: researchConfidence === 'high' ? '#22c55e' : researchConfidence === 'medium' ? '#facc15' : '#ef4444',
                  }}>
                    {researchConfidence} confidence
                  </span>
                )}
                {researchSource && (
                  <span className="finalized-badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
                    {researchSource.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sources.map((src, i) => (
                <div key={i} style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  borderLeft: '3px solid var(--accent-primary)',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                    {src.title || `Source ${i + 1}`}
                  </div>
                  {src.snippet && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem', lineHeight: '1.4' }}>
                      {src.snippet}
                    </div>
                  )}
                  {src.url && (
                    <a href={src.url} target="_blank" rel="noopener noreferrer" style={{
                      color: 'var(--accent-primary)',
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      wordBreak: 'break-all',
                    }}>
                      {src.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {drafts && !activeDraftIndex && (
          <div className="results-container">
            {[1, 2, 3].map((num) => {
              const text = drafts[`draft_${num}` as keyof Drafts];
              if (!text) return null;
              return (
                <div className="draft-card" key={num}>
                  <div className="draft-header">
                    <h3>Draft Variation {num}</h3>
                    <div>
                      <button type="button" className="btn-copy" onClick={() => handleSelectDraft(num)} style={{ marginRight: "0.5rem" }}>Select & Edit</button>
                      <button type="button" className="btn-copy" onClick={() => copyToClipboard(text)}>Copy</button>
                    </div>
                  </div>
                  <div className="draft-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
                </div>
              );
            })}
          </div>
        )}

        {activeDraftIndex && drafts && (
          <div className="results-container">
             <div className="draft-card" style={{ borderColor: 'var(--accent-primary)', borderWidth: '2px' }}>
                <div className="draft-header">
                  <h3>
                    Active Draft (Variation {activeDraftIndex})
                    {isFinalized && <span className="finalized-badge">Finalized</span>}
                  </h3>
                  <div>
                    {!isFinalized && <button type="button" className="btn-copy" onClick={() => setActiveDraftIndex(null)} style={{ marginRight: "0.5rem" }}>Back to Options</button>}
                    <button type="button" className="btn-copy" onClick={() => copyToClipboard(drafts[`draft_${activeDraftIndex}` as keyof Drafts])}>Copy</button>
                  </div>
                </div>
                <div className="draft-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(drafts[`draft_${activeDraftIndex}` as keyof Drafts]) }} />
                
                {!isFinalized && (
                  <button type="button" className="btn-success" onClick={handleFinalize} disabled={loading}>
                    {loading ? "Finalizing..." : "Finalize & Save Preferences"}
                  </button>
                )}
             </div>

             {!isFinalized && (
               <div className="editor-container">
                  <div className="chat-history">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`chat-bubble ${msg.role}`}>
                        {msg.content}
                      </div>
                    ))}
                    {isEditing && <div className="chat-bubble assistant"><div className="spinner" style={{width: 15, height: 15, borderWidth: 2}}></div></div>}
                  </div>
                  
                  <form onSubmit={handleEditSubmit} className="chat-input-group">
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Make the intro punchier..." 
                      value={editInstruction} 
                      onChange={e => setEditInstruction(e.target.value)} 
                      disabled={isEditing}
                    />
                    <button type="submit" className="btn-secondary" disabled={isEditing || !editInstruction.trim()}>Send</button>
                  </form>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
