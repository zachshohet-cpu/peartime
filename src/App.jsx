import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './index.css'

function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState(null)
  const [page, setPage] = useState('start') // start, login, signup, home, pending

  // Data state
  const [members, setMembers] = useState([])
  const [trades, setTrades] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)

  // Raffle State
  const [raffleWinnerId, setRaffleWinnerId] = useState(null)
  const [availableColors, setAvailableColors] = useState([])
  const [newColor, setNewColor] = useState('')

  // Admin / Feedback state
  const [decliningId, setDecliningId] = useState(null)
  const [tempDeclineReason, setTempDeclineReason] = useState('')

  // Form state
  const [loginName, setLoginName] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [offering, setOffering] = useState('')
  const [wanting, setWanting] = useState('')
  const [prizeDescription, setPrizeDescription] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Load data when user reaches the home screen
  useEffect(() => {
    if (page === 'home') {
      loadData()
    }
  }, [page])

  async function loadData() {
    const { data: mData } = await supabase.from('members').select('*').eq('approved', true).order('id')
    if (mData) setMembers(mData)
    setLoadingMembers(false)

    const { data: tData } = await supabase.from('trades').select('*').order('created_at', { ascending: false })
    if (tData) setTrades(tData)

    const { data: cData } = await supabase.from('site_config').select('*')
    if (cData) {
      const winner = cData.find(c => c.key === 'raffle_winner_id')
      if (winner) setRaffleWinnerId(JSON.parse(winner.value))
      
      const colors = cData.find(c => c.key === 'available_colors')
      if (colors) setAvailableColors(JSON.parse(colors.value))
    }
  }

  // ====== RAFFLE ADMIN ======
  const handleSelectWinner = async (memberId) => {
    const val = memberId ? String(memberId) : 'null'
    await supabase.from('site_config').upsert({ key: 'raffle_winner_id', value: val })
    setRaffleWinnerId(memberId)
  }

  const handleAddColor = async () => {
    if (!newColor) return
    const updated = [...availableColors, newColor]
    await supabase.from('site_config').upsert({ key: 'available_colors', value: JSON.stringify(updated) })
    setAvailableColors(updated)
    setNewColor('')
  }

  const handleRemoveColor = async (color) => {
    const updated = availableColors.filter(c => c !== color)
    await supabase.from('site_config').upsert({ key: 'available_colors', value: JSON.stringify(updated) })
    setAvailableColors(updated)
  }

  // ====== PRIZE CLAIM ======
  const handleClaimPrize = async (e) => {
    e.preventDefault()
    if (!prizeDescription || !selectedColor) return alert('Please enter a description and pick a color!')

    const { data, error } = await supabase.from('trades').insert([{
      requester_name: currentUser.name,
      offering: '🎁 Raffle Prize Request',
      wanting: `${prizeDescription} (Color: ${selectedColor})`,
      status: 'pending',
      request_type: 'raffle'
    }]).select()

    if (data) {
      setTrades([data[0], ...trades])
      setPrizeDescription('')
      setSelectedColor('')
      alert('Your prize request has been sent to Zach!')
    }
  }

  // ====== LOGIN ======
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('name', loginName)
      .eq('password', loginPassword)
      .single()

    if (error || !data) {
      setErrorMsg('Wrong name or password. Try again!')
      return
    }
    if (!data.approved) {
      setPage('pending')
      return
    }
    setCurrentUser(data)
    setPage('home')
  }

  // ====== SIGNUP ======
  const handleSignup = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!signupName || !signupPassword) {
      setErrorMsg('Please fill in both your name and a password!')
      return
    }
    if (signupPassword.length < 4) {
      setErrorMsg('Password must be at least 4 characters!')
      return
    }

    const { data: existing } = await supabase.from('members').select('id').eq('name', signupName)
    if (existing && existing.length > 0) {
      setErrorMsg('That name is already taken! Try a different one.')
      return
    }

    const { data: newMember, error: memberError } = await supabase
      .from('members')
      .insert([{ name: signupName, password: signupPassword, approved: false, rank: 'Level 0', tokens: 0 }])
      .select()

    if (memberError) {
      setErrorMsg('Something went wrong. Try again!')
      return
    }

    await supabase.from('trades').insert([{
      requester_name: signupName,
      offering: 'New member signup request',
      wanting: 'Account approval',
      status: 'pending',
      request_type: 'signup'
    }])

    setPage('pending')
  }

  // ====== TRADE ======
  const handleCreateTrade = async (e) => {
    e.preventDefault()
    if (!offering || !wanting) return alert('Please fill in both fields.')

    const { data, error } = await supabase.from('trades').insert([{
      requester_name: currentUser.name,
      offering,
      wanting,
      request_type: 'trade'
    }]).select()

    if (data && data.length > 0) {
      setTrades([data[0], ...trades])
      setOffering('')
      setWanting('')
    }
  }

  // ====== APPROVE / DECLINE ======
  const handleUpdateStatus = async (trade, newStatus, reason = '') => {
    await supabase.from('trades').update({ status: newStatus, decline_reason: reason }).eq('id', trade.id)

    if (trade.request_type === 'signup' && newStatus === 'accepted') {
      await supabase.from('members').update({ approved: true }).eq('name', trade.requester_name)
    }

    setTrades(trades.map(t => t.id === trade.id ? { ...t, status: newStatus, decline_reason: reason } : t))
    setDecliningId(null)
    setTempDeclineReason('')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setPage('start')
    setLoginName('')
    setLoginPassword('')
    setSignupName('')
    setSignupPassword('')
    setErrorMsg('')
  }

  const winnerMember = members.find(m => String(m.id) === String(raffleWinnerId))

  // =============================================
  // START PAGE
  // =============================================
  if (page === 'start') {
    return (
      <div className="start-screen">
        <div className="start-card">
          <img src="/pear-logo.png" alt="PearTime Logo" className="start-logo" />
          <h1 className="start-title">PearTime</h1>
          <p className="start-subtitle">Official VIP Membership & 3D Printing Platform</p>
          <div className="start-buttons">
            <button className="btn-primary" onClick={() => { setPage('login'); setErrorMsg('') }}>Log In</button>
            <button className="btn-secondary" onClick={() => { setPage('signup'); setErrorMsg('') }}>Sign Up</button>
          </div>
        </div>
      </div>
    )
  }

  // =============================================
  // LOGIN PAGE
  // =============================================
  if (page === 'login') {
    return (
      <div className="start-screen">
        <div className="start-card">
          <img src="/pear-logo.png" alt="PearTime Logo" className="start-logo small" />
          <h2>Log In</h2>
          <form className="auth-form" onSubmit={handleLogin}>
            <input type="text" placeholder="Your full name" value={loginName} onChange={e => setLoginName(e.target.value)} />
            <input type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
            {errorMsg && <p className="error-msg">{errorMsg}</p>}
            <button type="submit" className="btn-primary">Log In</button>
          </form>
          <button className="btn-link" onClick={() => { setPage('start'); setErrorMsg('') }}>← Back</button>
        </div>
      </div>
    )
  }

  // =============================================
  // SIGNUP PAGE
  // =============================================
  if (page === 'signup') {
    return (
      <div className="start-screen">
        <div className="start-card">
          <img src="/pear-logo.png" alt="PearTime Logo" className="start-logo small" />
          <h2>Create Your Profile</h2>
          <form className="auth-form" onSubmit={handleSignup}>
            <input type="text" placeholder="Your real full name (e.g. John Smith)" value={signupName} onChange={e => setSignupName(e.target.value)} />
            <input type="password" placeholder="Create a password (4+ characters)" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
            {errorMsg && <p className="error-msg">{errorMsg}</p>}
            <button type="submit" className="btn-primary">Create Profile</button>
          </form>
          <p className="info-text">Your request will be sent to the Founder for approval.</p>
          <button className="btn-link" onClick={() => { setPage('start'); setErrorMsg('') }}>← Back</button>
        </div>
      </div>
    )
  }

  // =============================================
  // PENDING APPROVAL PAGE
  // =============================================
  if (page === 'pending') {
    return (
      <div className="start-screen">
        <div className="start-card">
          <img src="/pear-logo.png" alt="PearTime Logo" className="start-logo small" />
          <h2>⏳ Waiting for Approval</h2>
          <p>Your signup request has been sent to the Founder (Zach).</p>
          <p>Once he accepts, you can log in!</p>
          <button className="btn-link" onClick={() => setPage('start')}>← Back to Start</button>
        </div>
      </div>
    )
  }

  // =============================================
  // HOME SCREEN (after login)
  // =============================================
  return (
    <div className="container">
      <header className="header">
        <div className="header-top">
          <h1>🍐 PearTime</h1>
          <div className="profile-switcher">
            <span className="profile-badge badge-green">Logged in as {currentUser.name}</span>
            {currentUser?.name === 'Zach' && <span className="profile-badge badge-gold">👑 Founder Mode</span>}
            <button className="btn-logout" onClick={handleLogout}>Log Out</button>
          </div>
        </div>
        <p className="subtitle">Official VIP Membership & 3D Printing Platform</p>
      </header>

      {/* RAFFLE ANNOUNCEMENT */}
      {winnerMember && (
        <div className="raffle-banner">
          <span className="raffle-icon">🏆</span>
          <div className="raffle-text">
            <strong>Raffle Winner:</strong> {winnerMember.name} is today's lucky member!
          </div>
        </div>
      )}

      <main className="main-content">

        {/* FOUNDER ADMIN PANEL */}
        {currentUser?.name === 'Zach' && (
          <div className="card founder-panel">
            <h2>Founder Admin Panel</h2>
            <div className="admin-grid">
              <div className="admin-section">
                <h3>Select Raffle Winner:</h3>
                <select onChange={(e) => handleSelectWinner(e.target.value)} value={raffleWinnerId || ''}>
                  <option value="">-- No Current Winner --</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="admin-section">
                <h3>Available Print Colors:</h3>
                <div className="color-editor">
                  <input type="text" placeholder="Add color..." value={newColor} onChange={e => setNewColor(e.target.value)} />
                  <button onClick={handleAddColor}>Add</button>
                </div>
                <div className="color-list">
                  {availableColors.map(c => (
                    <span key={c} className="color-tag">{c} <button onClick={() => handleRemoveColor(c)}>×</button></span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MEMBERS DIRECTORY */}
        <div className="card mt-2">
          <h2>Member Directory</h2>
          {loadingMembers ? (
            <p>Loading members...</p>
          ) : members.length === 0 ? (
            <p>No members yet.</p>
          ) : (
            <ul className="member-list">
              {members.map(member => (
                <li key={member.id} className="member-item">
                  <div className="member-info">
                    <strong>{member.name}</strong>
                    <span className="member-rank">{member.rank}</span>
                  </div>
                  <span className="token-badge">{member.tokens} PT</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* REQUESTS BOARD */}
        <div className="card mt-2">
          <h2>Requests Board</h2>

          {/* Winner Prize Form */}
          {String(currentUser?.id) === String(raffleWinnerId) && (
            <div className="raffle-prize-form">
              <h3>🎁 Claim Your Raffle Prize!</h3>
              <form onSubmit={handleClaimPrize}>
                <div className="form-group">
                  <input type="text" placeholder="What would you like for your prize?" value={prizeDescription} onChange={e => setPrizeDescription(e.target.value)} />
                  <select value={selectedColor} onChange={e => setSelectedColor(e.target.value)}>
                    <option value="">-- Choose Color --</option>
                    {availableColors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="submit" className="btn-claim">Request Prize</button>
                </div>
              </form>
            </div>
          )}

          {/* Create Trade Form */}
          <form className="trade-form" onSubmit={handleCreateTrade}>
            <h3>Propose a Trade:</h3>
            <div className="form-group">
              <input type="text" placeholder="I am offering..." value={offering} onChange={e => setOffering(e.target.value)} />
              <span className="trade-arrows">⇄</span>
              <input type="text" placeholder="I want..." value={wanting} onChange={e => setWanting(e.target.value)} />
              <button type="submit">Submit</button>
            </div>
          </form>

          {/* List of all Requests */}
          <div className="trades-list">
            {trades.length === 0 ? (
              <p>No requests yet.</p>
            ) : (
              trades.map(trade => (
                <div key={trade.id} className={`trade-item ${trade.request_type === 'signup' ? 'signup-request' : ''} ${trade.request_type === 'raffle' ? 'raffle-request' : ''}`}>
                  <div className="trade-details">
                    {trade.request_type === 'signup' ? (
                      <span className="trade-author"><span className="badge-signup">🆕 SIGNUP</span> <strong>{trade.requester_name}</strong> wants to join</span>
                    ) : trade.request_type === 'raffle' ? (
                      <>
                        <span className="trade-author"><span className="badge-raffle">🎁 RAFFLE</span> <strong>{trade.requester_name}</strong> claimed their prize:</span>
                        <div className="prize-content">{trade.wanting}</div>
                      </>
                    ) : (
                      <>
                        <span className="trade-author"><strong>{trade.requester_name}</strong> proposed a trade:</span>
                        <div><span className="badge-offer">Offering:</span> {trade.offering}</div>
                        <div className="mt-1"><span className="badge-want">Wanting:</span> {trade.wanting}</div>
                      </>
                    )}

                    {trade.status === 'declined' && trade.decline_reason && (
                      <div className="feedback-box">
                        <strong>Founder Feedback:</strong> {trade.decline_reason}
                      </div>
                    )}
                  </div>

                  <div className="trade-actions">
                    <span className={`status-badge status-${trade.status}`}>{trade.status.toUpperCase()}</span>

                    {currentUser?.name === 'Zach' && trade.status === 'pending' && (
                      <div className="admin-controls">
                        {decliningId === trade.id ? (
                          <div className="decline-prompt">
                            <input 
                              type="text" 
                              placeholder="Why are you declining?" 
                              value={tempDeclineReason} 
                              onChange={e => setTempDeclineReason(e.target.value)}
                              autoFocus 
                            />
                            <div className="prompt-buttons">
                              <button onClick={() => handleUpdateStatus(trade, 'declined', tempDeclineReason)}>Confirm Decline</button>
                              <button className="btn-cancel" onClick={() => { setDecliningId(null); setTempDeclineReason(''); }}>×</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button className="btn-accept" onClick={() => handleUpdateStatus(trade, 'accepted')}>Accept</button>
                            <button className="btn-decline" onClick={() => setDecliningId(trade.id)}>Decline</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  )
}

export default App
