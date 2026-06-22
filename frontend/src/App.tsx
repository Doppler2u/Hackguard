import { useState, useMemo, useCallback } from 'react';
import { Shield, Activity, PlusCircle, AlertTriangle, CheckCircle, ExternalLink, RefreshCw, Zap, Wallet, HelpCircle } from 'lucide-react';
import { createGenlayerClient, connectWallet, shortAddress, switchToGenlayer } from './lib/genlayer';

const CONTRACT_ADDRESS = "0x7bE320E42784A3581cf5c9B29C1BB7E33Bb828B3";
import { Card, CardHeader, CardContent } from './components/Card';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { EXAMPLE_POLICIES, EXAMPLE_CLAIMS } from './lib/examples';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'register' | 'claim'>('dashboard');
  const [walletAddress, setWalletAddress] = useState('');
  const [stats, setStats] = useState({ policies: 0, claims: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [statusText, setStatusText] = useState('Connect your wallet to get started.');
  const [txHistory, setTxHistory] = useState<Array<{ hash: string; label: string; time: string }>>([]);

  // Recent items state
  const [recentClaims, setRecentClaims] = useState<any[]>([]);

  const [regForm, setRegForm] = useState({ name: '', url: '', coverage: '' });
  const [claimForm, setClaimForm] = useState({ policyId: '', evidenceUrl: '', explorerUrl: '', description: '' });

  // Example data for quick testing
  // Form states

  const [selectedPolicyExample, setSelectedPolicyExample] = useState(0);
  const [selectedClaimExample, setSelectedClaimExample] = useState(0);

  const loadPolicyExample = () => {
    const ex = EXAMPLE_POLICIES[selectedPolicyExample];
    setRegForm({ name: ex.name, url: ex.url, coverage: ex.coverage });
    setSelectedPolicyExample((selectedPolicyExample + 1) % EXAMPLE_POLICIES.length);
  };

  const loadClaimExample = () => {
    const ex = EXAMPLE_CLAIMS[selectedClaimExample];
    setClaimForm({ policyId: ex.policyId, evidenceUrl: ex.evidenceUrl, explorerUrl: ex.explorerUrl, description: ex.description });
    setSelectedClaimExample((selectedClaimExample + 1) % EXAMPLE_CLAIMS.length);
  };

  // Create genlayer client from wallet address
  const client = useMemo(() => {
    if (!walletAddress) return null;
    return createGenlayerClient(walletAddress);
  }, [walletAddress]);

  const addTx = (hash: string, label: string) => {
    setTxHistory(prev => [{ hash, label, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const handleConnect = useCallback(async () => {
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      setStatusText(`Connected ${shortAddress(address)}. Approve transactions in MetaMask.`);
      showToast('Wallet connected!');
    } catch (err: any) {
      setStatusText(err.message || 'Wallet connection failed');
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setWalletAddress('');
    setStats({ policies: 0, claims: 0 });
    setRecentClaims([]);
    setTxHistory([]);
    setStatusText('Wallet disconnected. Connect again to continue.');
    showToast('Wallet disconnected');
  }, []);

  const loadData = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      const pCount = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_policy_count",
        args: [],
      });
      const cCount = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_claim_count",
        args: [],
      });
      const policyNum = Number(pCount);
      const claimNum = Number(cCount);
      setStats({ policies: policyNum, claims: claimNum });

      // Fetch last 5 claims
      const claims = [];
      const start = Math.max(0, claimNum - 5);
      for (let i = claimNum - 1; i >= start; i--) {
        try {
          const claim = await client.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            functionName: "get_claim",
            args: [i],
          });
          if (claim) claims.push(claim);
        } catch { /* skip */ }
      }
      setRecentClaims(claims);
      setStatusText(`Loaded ${policyNum} policies, ${claimNum} claims.`);
    } catch (err) {
      console.error(err);
      setStatusText('Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return showToast('Connect your wallet first');
    setIsSubmitting(true);
    setStatusText('Submitting policy registration… Approve in MetaMask.');
    try {
      const date = new Date().toISOString().split('T')[0];
      await switchToGenlayer();
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "register_policy",
        args: [regForm.name, regForm.url, Number(regForm.coverage), date],
        value: 0n,
      });
      addTx(hash, 'register_policy');
      setStatusText(`TX sent: ${hash.slice(0, 12)}… Waiting for ACCEPTED…`);
      await client.waitForTransactionReceipt({ hash, status: "ACCEPTED" as any, retries: 200 });
      showToast('Policy registered successfully!');
      setStatusText('✅ Policy registered and accepted.');
      setRegForm({ name: '', url: '', coverage: '' });
      setActiveTab('dashboard');
      loadData();
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.shortMessage || err?.message || JSON.stringify(err);
      setStatusText(`Error: ${errMsg}`);
      showToast('Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return showToast('Connect your wallet first');
    setIsSubmitting(true);
    setStatusText('Submitting claim… Approve in MetaMask. AI analysis may take 1-2 min.');
    try {
      await switchToGenlayer();
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "file_claim",
        args: [Number(claimForm.policyId), claimForm.evidenceUrl, claimForm.explorerUrl, claimForm.description],
        value: 0n,
      });
      addTx(hash, 'file_claim');
      setStatusText(`TX sent: ${hash.slice(0, 12)}… Validators running AI analysis…`);
      await client.waitForTransactionReceipt({ hash, status: "ACCEPTED" as any, retries: 200 });
      showToast('Claim filed and AI analysis complete!');
      setStatusText('✅ Claim analyzed. Check Dashboard for results.');
      setClaimForm({ policyId: '', evidenceUrl: '', explorerUrl: '', description: '' });
      setActiveTab('dashboard');
      loadData();
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.shortMessage || err?.message || JSON.stringify(err);
      setStatusText(`Error: ${errMsg}`);
      showToast('Claim filing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'badge-error';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-info';
      case 'LOW': return 'badge-success';
      default: return 'badge-neutral';
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="container header-content">
          <div className="logo">
            <Shield className="logo-icon" size={28} />
            <span>HackGuard</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {walletAddress && (
              <Button variant="secondary" onClick={loadData} disabled={isLoading} aria-label="Refresh Data">
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </Button>
            )}
            <Button 
              variant={walletAddress ? 'secondary' : 'primary'} 
              onClick={walletAddress ? handleDisconnect : handleConnect}
            >
              <Wallet size={16} />
              {walletAddress ? shortAddress(walletAddress) : 'Connect Wallet'}
            </Button>
          </div>
        </div>
      </header>

      <main className="app-main container">
        {/* Status bar */}
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{statusText}</span>
          <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            Contract: {shortAddress(CONTRACT_ADDRESS)}
          </span>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <Button 
            variant={activeTab === 'dashboard' ? 'primary' : 'secondary'} 
            onClick={() => { setActiveTab('dashboard'); if (client) loadData(); }}
          >
            <Activity size={16} /> Dashboard
          </Button>
          <Button 
            variant={activeTab === 'register' ? 'primary' : 'secondary'} 
            onClick={() => setActiveTab('register')}
          >
            <PlusCircle size={16} /> Register Policy
          </Button>
          <Button 
            variant={activeTab === 'claim' ? 'primary' : 'secondary'} 
            onClick={() => setActiveTab('claim')}
          >
            <AlertTriangle size={16} /> File Claim
          </Button>
        </div>

        {/* Transaction history */}
        {txHistory.length > 0 && (
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Transaction Log</h4>
            {txHistory.map((tx, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0', borderTop: i > 0 ? '1px solid var(--bg-glass-border)' : 'none', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--accent-primary)' }}>{tx.label}</span>
                <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{tx.time}</span>
                <a 
                  href={`https://explorer-studio.genlayer.com/transactions/${tx.hash}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  {tx.hash.slice(0, 10)}…{tx.hash.slice(-8)} <ExternalLink size={12} />
                </a>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="fade-in">
            <h1 style={{ marginBottom: '1.5rem' }}>Protocol Overview</h1>
            
            {!walletAddress && (
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>
                <Wallet size={40} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                <h3 style={{ marginBottom: '0.5rem' }}>Connect Your Wallet</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Connect MetaMask to interact with HackGuard on GenLayer Studionet
                </p>
                <Button onClick={handleConnect}>
                  <Wallet size={16} /> Connect MetaMask
                </Button>
              </div>
            )}

            <div className="grid-cols-2" style={{ marginBottom: '2rem' }}>
              <Card>
                <CardContent>
                  <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Active Policies</h3>
                  <div className="tabular-nums" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                    {isLoading ? <span className="loading-text"></span> : stats.policies}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Claims Analyzed</h3>
                  <div className="tabular-nums" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                    {isLoading ? <span className="loading-text"></span> : stats.claims}
                  </div>
                </CardContent>
              </Card>
            </div>

            <h2 style={{ marginBottom: '1rem', marginTop: '3rem' }}>Recent Claims Analysis</h2>
            {recentClaims.length === 0 && !isLoading ? (
              <p style={{ color: 'var(--text-secondary)' }}>No claims filed yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentClaims.map((claim) => (
                  <Card key={Number(claim.claim_id)} hoverable>
                    <CardHeader>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 'bold' }}>Claim #{Number(claim.claim_id)}</span>
                          <span className={`badge ${claim.status === 'APPROVED' ? 'badge-success' : 'badge-error'}`}>
                            {claim.status}
                          </span>
                          {claim.status === 'APPROVED' && (
                            <span className={`badge ${getSeverityBadge(claim.severity)}`}>
                              {claim.severity} SEVERITY
                            </span>
                          )}
                        </div>
                        <span className="tabular-nums badge badge-neutral">Policy ID: {Number(claim.policy_id)}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }} className="line-clamp-2">
                        <strong>Description:</strong> {claim.description}
                      </p>
                      
                      <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-primary)' }}>
                        <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Shield size={16} className="logo-icon" /> AI Consensus Verdict
                        </h4>
                        <p style={{ marginBottom: '0.5rem' }}>{claim.analysis_summary}</p>
                        
                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.875rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Confidence</span>
                            <span className="tabular-nums" style={{ fontWeight: 'bold' }}>{Number(claim.confidence)}%</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Attack Vector</span>
                            <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{claim.attack_vector.replace('_', ' ')}</span>
                          </div>
                          {claim.status === 'APPROVED' && (
                            <div>
                              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Est. Loss</span>
                              <span className="tabular-nums" style={{ fontWeight: 'bold', color: 'var(--status-error)' }}>
                                ${Number(claim.loss_estimated_usd).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {claim.red_flags && claim.red_flags !== 'None' && (
                          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--bg-glass-border)' }}>
                            <span style={{ color: 'var(--status-warning)', fontSize: '0.875rem', fontWeight: '500' }}>
                              Red Flags Detected: 
                            </span>
                            <span style={{ fontSize: '0.875rem', marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
                              {claim.red_flags}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                        <a href={claim.evidence_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          View Evidence <ExternalLink size={14} />
                        </a>
                        <a href={claim.explorer_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          View Explorer <ExternalLink size={14} />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'register' && (
          <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h1>Register Protocol Policy</h1>
              <Button variant="secondary" onClick={loadPolicyExample} type="button">
                <Zap size={16} /> Try Example
              </Button>
            </div>
            <Card>
              <CardContent>
                <form onSubmit={handleRegister}>
                  <Input 
                    label="Protocol Name" 
                    placeholder="e.g. Curve Finance" 
                    value={regForm.name}
                    onChange={e => setRegForm({...regForm, name: e.target.value})}
                    required
                    autoComplete="off"
                    tooltip="The public name of the DeFi protocol being insured."
                  />
                  <Input 
                    label="Protocol Website URL" 
                    type="url"
                    placeholder="https://…" 
                    value={regForm.url}
                    onChange={e => setRegForm({...regForm, url: e.target.value})}
                    required
                    autoComplete="off"
                    tooltip="The primary official website URL for the protocol."
                  />
                  <Input 
                    label="Coverage Amount (USD)" 
                    type="number"
                    min="1000"
                    placeholder="50000000" 
                    value={regForm.coverage}
                    onChange={e => setRegForm({...regForm, coverage: e.target.value})}
                    required
                    autoComplete="off"
                    tooltip="The maximum payout amount in USD if a valid claim is filed."
                  />
                  <div style={{ marginTop: '2rem' }}>
                    <Button type="submit" isLoading={isSubmitting} style={{ width: '100%' }}>
                      <CheckCircle size={16} /> Initialize Policy
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'claim' && (
          <div className="fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h1>File Exploit Claim</h1>
              <Button variant="secondary" onClick={loadClaimExample} type="button">
                <Zap size={16} /> Try Example
              </Button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Submitting a claim triggers the GenLayer AI consensus network. Validators will independently fetch the evidence, analyze the exploit, and reach consensus on the payout.
            </p>
            <Card>
              <CardContent>
                <form onSubmit={handleClaim}>
                  <Input 
                    label="Policy ID" 
                    type="number"
                    min="0"
                    placeholder="0" 
                    value={claimForm.policyId}
                    onChange={e => setClaimForm({...claimForm, policyId: e.target.value})}
                    required
                    autoComplete="off"
                    tooltip="The numeric ID of the active policy on the blockchain."
                  />
                  <Input 
                    label="Evidence URL (News/Report)" 
                    type="url"
                    placeholder="https://rekt.news/…" 
                    value={claimForm.evidenceUrl}
                    onChange={e => setClaimForm({...claimForm, evidenceUrl: e.target.value})}
                    required
                    autoComplete="off"
                    tooltip="A link to a news article, post-mortem, or tweet describing the exploit."
                  />
                  <Input 
                    label="Block Explorer Tx/Address URL" 
                    type="url"
                    placeholder="https://etherscan.io/…" 
                    value={claimForm.explorerUrl}
                    onChange={e => setClaimForm({...claimForm, explorerUrl: e.target.value})}
                    required
                    autoComplete="off"
                    tooltip="The primary block explorer link showing the malicious transactions."
                  />
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <label htmlFor="claim-desc" className="form-label" style={{ marginBottom: 0 }}>Incident Description</label>
                      <span className="has-tooltip" style={{ color: 'var(--text-tertiary)', cursor: 'help' }}>
                        <HelpCircle size={14} />
                        <span className="tooltip">A short summary of what happened. This is sent to the LLM to help guide the investigation.</span>
                      </span>
                    </div>
                    <textarea 
                      id="claim-desc"
                      className="form-input"
                      rows={4}
                      placeholder="Briefly describe what happened…"
                      value={claimForm.description}
                      onChange={e => setClaimForm({...claimForm, description: e.target.value})}
                      required
                    />
                  </div>
                  <div style={{ marginTop: '2rem' }}>
                    <Button type="submit" variant="primary" isLoading={isSubmitting} style={{ width: '100%' }}>
                      <AlertTriangle size={16} /> Initiate AI Investigation
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <div aria-live="polite" style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 100 }}>
        {toastMessage && (
          <div className="glass-panel fade-in" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
            <CheckCircle size={18} color="var(--accent-primary)" />
            {toastMessage}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
