"use client";

import { useState, useEffect } from "react";

type Drafts = { draft_1: string; draft_2: string; draft_3: string };
type ChatMessage = { role: "user" | "assistant"; content: string };
type SourceItem = { title: string; snippet: string; url: string };

export default function Home() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  // Markdown to HTML renderer
  const renderMarkdown = (text: string): string => {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h4 style="margin: 1rem 0 0.5rem; color: var(--text-primary); font-size: 1rem;">$1</h4>')
      .replace(/^## (.+)$/gm, '<h3 style="margin: 1.2rem 0 0.5rem; color: var(--text-primary); font-size: 1.1rem;">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2 style="margin: 1.2rem 0 0.5rem; color: var(--text-primary); font-size: 1.2rem;">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--text-primary);">$1</strong>')
      .replace(/(?<![*])\*(?![*])(.+?)(?<![*])\*(?![*])/g, '<em>$1</em>')
      .replace(/^[*\-] (.+)$/gm, '<li style="margin: 0.25rem 0; margin-left: 1.5rem; list-style: disc;">$1</li>')
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
  const [loadingStep, setLoadingStep] = useState(0);
  
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
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("postcraft_token");
    if (saved) setToken(saved);
  }, []);

  // Cycling loading text
  useEffect(() => {
    if (loading) {
      const steps = [
        "Researching...",
        "Analyzing Patterns...",
        "Generating Drafts...",
        "Quality Check..."
      ];
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % steps.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/signup";
    
    try {
      let body, headers;
      if (isLoginMode) {
        body = new URLSearchParams();
        body.append("username", username);
        body.append("password", password);
        headers = { "Content-Type": "application/x-www-form-urlencoded" };
      } else {
        body = JSON.stringify({ username, password });
        headers = { "Content-Type": "application/json" };
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
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
      const response = await fetch(`${API_URL}/api/generations`, {
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
      setSourcesExpanded(data.sources && data.sources.length > 0);
      
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
      const response = await fetch(`${API_URL}/api/generations/${generationId}/edit`, {
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
      const response = await fetch(`${API_URL}/api/generations/${generationId}/finalize`, {
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
      <div className="login-page">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        
        <h1 className="glowing-logo">PostCraft AI</h1>
        <p className="login-tagline">AI-Powered Content That Sounds Like You</p>
        
        <form className="card login-card" onSubmit={handleAuth}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.5rem', fontWeight: '600' }}>
            {isLoginMode ? "Welcome Back" : "Join PostCraft AI"}
          </h2>
          <div className="form-group">
            <label>Username</label>
            <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" style={{ marginBottom: '1rem' }}>
            {isLoginMode ? "Log In" : "Sign Up"}
          </button>
          {authError && <div className="error-message" style={{ marginBottom: '1rem' }}>{authError}</div>}
          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <a href="#" onClick={(e) => { e.preventDefault(); setIsLoginMode(!isLoginMode); setAuthError(""); }} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: '500' }}>
              {isLoginMode ? "Sign up" : "Log in"}
            </a>
          </div>
        </form>

        <div className="features-list">
          <div className="feature-item">
            <div className="feature-icon">✨</div>
            <span>Smart Formatting</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🎯</div>
            <span>Platform specific</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">⚡</div>
            <span>Instant Drafts</span>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    "Researching...",
    "Analyzing Patterns...",
    "Generating Drafts...",
    "Quality Check..."
  ];

  return (
    <>
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      
      <div className="dashboard">
        <nav className="navbar">
          <div className="logo-area">
            <h1 className="logo-title">PostCraft AI</h1>
            <p className="logo-tagline">Transform your raw thoughts into high-performing social posts.</p>
          </div>
          <button onClick={handleLogout} className="btn-secondary">Log Out</button>
        </nav>

        <main>
          {!activeDraftIndex && (
            <form className="card" onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <label>Target Platform</label>
                <div className="pill-group">
                  <div 
                    className={`pill-btn ${platform === 'linkedin' ? 'active' : ''}`}
                    onClick={() => setPlatform('linkedin')}
                  >
                    LinkedIn
                  </div>
                  <div 
                    className={`pill-btn ${platform === 'x' ? 'active' : ''}`}
                    onClick={() => setPlatform('x')}
                  >
                    X (Twitter)
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="topic">Main Topic / Theme</label>
                <input type="text" id="topic" className="form-control" placeholder="e.g. B2B SaaS Growth Strategies" value={topic} onChange={(e) => setTopic(e.target.value)} required />
              </div>
              
              <div className="form-group">
                <label htmlFor="rawThoughts">Your Raw Thoughts (The Substance)</label>
                <textarea id="rawThoughts" className="form-control" placeholder="Brain dump your core ideas here..." value={rawThoughts} onChange={(e) => setRawThoughts(e.target.value)} required />
              </div>
              
              <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
                {loading ? (
                  <div className="progress-container">
                    <div className="morph-loader"></div>
                    <span>{steps[loadingStep]}</span>
                  </div>
                ) : (
                  "✨ Generate Drafts"
                )}
              </button>
              {error && <div className="error-message">{error}</div>}
            </form>
          )}

          {drafts && !activeDraftIndex && sources.length > 0 && (
            <div className="card sources-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div 
                className="sources-header" 
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>📎 Research Sources</h3>
                  {researchConfidence && (
                    <span className="finalized-badge" style={{
                      background: researchConfidence === 'high' ? 'rgba(34, 197, 94, 0.1)' : researchConfidence === 'medium' ? 'rgba(250, 204, 21, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: researchConfidence === 'high' ? '#22c55e' : researchConfidence === 'medium' ? '#facc15' : '#ef4444',
                    }}>
                      {researchConfidence} confidence
                    </span>
                  )}
                  {researchSource && (
                    <span className="finalized-badge" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
                      {researchSource.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <div>{sourcesExpanded ? '▲' : '▼'}</div>
              </div>
              
              {sourcesExpanded && (
                <div className="sources-content" style={{ padding: '0 1.5rem 1.5rem' }}>
                  {sources.map((src, i) => (
                    <div key={i} className="source-item">
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                        {src.title || `Source ${i + 1}`}
                      </div>
                      {src.snippet && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.4rem', lineHeight: '1.4' }}>
                          {src.snippet}
                        </div>
                      )}
                      {src.url && (
                        <a href={src.url} target="_blank" rel="noopener noreferrer" style={{
                          color: 'var(--accent-cyan)',
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
              )}
            </div>
          )}

          {drafts && !activeDraftIndex && (
            <div className="drafts-grid">
              {[1, 2, 3].map((num) => {
                const text = drafts[`draft_${num}` as keyof Drafts];
                if (!text) return null;
                return (
                  <div className="draft-card" key={num}>
                    <div className="draft-badge">0{num}</div>
                    <div className="draft-header" style={{ paddingLeft: '2rem' }}>
                      <h3 style={{ margin: 0 }}>Option {num}</h3>
                      <div className="draft-actions">
                        <button type="button" className="btn-pill-small" onClick={() => handleSelectDraft(num)}>Edit</button>
                        <button type="button" className="btn-pill-small" onClick={() => copyToClipboard(text)}>Copy</button>
                      </div>
                    </div>
                    <div className="draft-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
                  </div>
                );
              })}
            </div>
          )}

          {activeDraftIndex && drafts && (
            <>
              <div className="draft-card active">
                <div className="draft-badge">0{activeDraftIndex}</div>
                <div className="draft-header" style={{ paddingLeft: '2rem' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    Active Draft
                    {isFinalized && <span className="finalized-badge">Finalized</span>}
                  </h3>
                  <div className="draft-actions">
                    {!isFinalized && <button type="button" className="btn-pill-small" onClick={() => setActiveDraftIndex(null)}>Back</button>}
                    <button type="button" className="btn-pill-small" onClick={() => copyToClipboard(drafts[`draft_${activeDraftIndex}` as keyof Drafts])}>Copy</button>
                  </div>
                </div>
                <div className="draft-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(drafts[`draft_${activeDraftIndex}` as keyof Drafts]) }} />
                
                {!isFinalized && (
                  <button type="button" className="btn-primary" onClick={handleFinalize} disabled={loading} style={{ marginTop: '1.5rem' }}>
                    {loading ? "Finalizing..." : "🚀 Finalize & Save Preferences"}
                  </button>
                )}
              </div>

              {!isFinalized && (
                <div className="editor-container">
                  <div className="chat-history">
                    {chatHistory.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem' }}>
                        Suggest edits to this draft below...
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`chat-bubble ${msg.role}`}>
                        {msg.content}
                      </div>
                    ))}
                    {isEditing && (
                      <div className="chat-bubble assistant">
                        <div className="morph-loader" style={{ width: 12, height: 12 }}></div>
                      </div>
                    )}
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
            </>
          )}
        </main>
      </div>
    </>
  );
}
