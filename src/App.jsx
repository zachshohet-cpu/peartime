import React, { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './index.css'

function App() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getMembers() {
      const { data, error } = await supabase.from('members').select('*').order('id')
      if (data) setMembers(data)
      setLoading(false)
    }
    getMembers()
  }, [])

  return (
    <div className="container">
      <header className="header">
        <h1>🍐 PearTime</h1>
        <p className="subtitle">Official VIP Membership & 3D Printing Platform</p>
      </header>
      
      <main className="main-content">
        <div className="card">
          <h2>Member Directory</h2>
          {loading ? (
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
      </main>
    </div>
  )
}

export default App
