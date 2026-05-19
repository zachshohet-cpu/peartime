import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './index.css'

function App() {
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  
  const [trades, setTrades] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  
  const [offering, setOffering] = useState('')
  const [wanting, setWanting] = useState('')

  useEffect(() => {
    async function loadData() {
      // 1. Load Members
      const { data: mData } = await supabase.from('members').select('*').order('id')
      if (mData) setMembers(mData)
      setLoadingMembers(false)
      
      // 2. Load Trades
      const { data: tData } = await supabase.from('trades').select('*').order('created_at', { ascending: false })
      if (tData) setTrades(tData)
    }
    loadData()
  }, [])

  const handleProfileSelect = (e) => {
    if (e.target.value === "") {
        setCurrentUser(null)
        return
    }
    const member = members.find(m => String(m.id) === e.target.value)
    setCurrentUser(member)
  }

  const handleCreateTrade = async (e) => {
    e.preventDefault()
    if (!currentUser) return alert('Please set your profile at the top first!')
    if (!offering || !wanting) return alert('Please enter both offering and wanting fields.')
    
    const newTrade = {
      requester_name: currentUser.name,
      offering,
      wanting
    }
    
    const { data, error } = await supabase.from('trades').insert([newTrade]).select()
    if (data && data.length > 0) {
       setTrades([data[0], ...trades])
       setOffering('')
       setWanting('')
    } else {
        alert("Wait, failed to create trade! Did you accept the warning on Supabase about RLS for the trades table? You must run it without RLS!")
    }
  }

  const handleUpdateStatus = async (id, newStatus) => {
    const { error } = await supabase.from('trades').update({ status: newStatus }).eq('id', id)
    if (!error) {
       setTrades(trades.map(t => t.id === id ? { ...t, status: newStatus } : t))
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-top">
            <h1>🍐 PearTime</h1>
            <div className="profile-switcher">
                <label>Login As:</label>
                <select onChange={handleProfileSelect} defaultValue="">
                    <option value="">-- Choose Profile --</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {currentUser && <span className="profile-badge badge-green">Logged in as {currentUser.name}</span>}
                {currentUser?.name === 'Zach' && <span className="profile-badge badge-gold">👑 Founder Mode Active</span>}
            </div>
        </div>
        <p className="subtitle">Official VIP Membership & 3D Printing Platform</p>
      </header>
      
      <main className="main-content">
        
        {/* MEMBERS DIRECTORY */}
        <div className="card">
          <h2>Member Directory</h2>
          {loadingMembers ? (
            <p>Loading members from Supabase...</p>
          ) : members.length === 0 ? (
            <p>No members yet (or database is empty).</p>
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

        {/* TRADE BOARD */}
        <div className="card mt-2">
            <h2>Trade Board</h2>
            
            {/* Create Trade Form */}
            {currentUser && (
                <form className="trade-form" onSubmit={handleCreateTrade}>
                    <h3>Propose a new trade:</h3>
                    <div className="form-group">
                        <input type="text" placeholder="I am offering..." value={offering} onChange={e => setOffering(e.target.value)} />
                        <span className="trade-arrows">⇄</span>
                        <input type="text" placeholder="I want..." value={wanting} onChange={e => setWanting(e.target.value)} />
                        <button type="submit">Submit Trade</button>
                    </div>
                </form>
            )}
            
            {!currentUser && (
                <p className="trade-warning">⚠️ You must select your Profile at the top to propose trades.</p>
            )}

            {/* List of Trades */}
            <div className="trades-list">
                {trades.length === 0 ? (
                    <p>No trades have been proposed yet.</p>
                ) : (
                    trades.map(trade => (
                        <div key={trade.id} className="trade-item">
                            <div className="trade-details">
                                <span className="trade-author"><strong>{trade.requester_name}</strong> proposed a trade:</span>
                                <div><span className="badge-offer">Offering:</span> {trade.offering}</div>
                                <div className="mt-1"><span className="badge-want">Wanting:</span> {trade.wanting}</div>
                            </div>
                            
                            <div className="trade-actions">
                                <span className={`status-badge status-${trade.status}`}>{trade.status.toUpperCase()}</span>
                                
                                {/* Founder Admin Controls */}
                                {currentUser?.name === 'Zach' && trade.status === 'pending' && (
                                    <div className="admin-controls">
                                        <button className="btn-accept" onClick={() => handleUpdateStatus(trade.id, 'accepted')}>Accept</button>
                                        <button className="btn-decline" onClick={() => handleUpdateStatus(trade.id, 'declined')}>Decline</button>
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
