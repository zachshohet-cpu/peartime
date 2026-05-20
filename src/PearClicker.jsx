import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Upgrade Definitions ─────────────────────────────────────────────────────
const UPGRADES = [
  { id: 'pear_fingers',  name: '🍐 Pear Fingers',   desc: 'Clickier fingers, pearier results.',        baseCost: 15,    clickBonus: 1,  passiveBonus: 0    },
  { id: 'pear_press',   name: '🫳 Pear Press',      desc: 'A fancy press to squeeze more out.',        baseCost: 100,   clickBonus: 3,  passiveBonus: 0.1  },
  { id: 'juicy_pear',   name: '💦 Juicy Pear',      desc: 'Extra-juicy pears drip continuously.',      baseCost: 400,   clickBonus: 5,  passiveBonus: 0.5  },
  { id: 'pear_tree',    name: '🌳 Pear Tree',       desc: 'A whole tree, always dropping pears.',      baseCost: 1500,  clickBonus: 10, passiveBonus: 2    },
  { id: 'golden_pear',  name: '✨ Golden Pear',     desc: 'Worth its weight in PearTokens.',           baseCost: 5000,  clickBonus: 25, passiveBonus: 6    },
  { id: 'pear_orchard', name: '🏡 Pear Orchard',   desc: 'An orchard that never sleeps.',             baseCost: 15000, clickBonus: 50, passiveBonus: 15   },
  { id: 'pear_factory', name: '🏭 Pear Factory',   desc: 'Industrial-scale pear production.',         baseCost: 50000, clickBonus: 100,passiveBonus: 40   },
  { id: 'pear_empire',  name: '👑 Pear Empire',    desc: 'You rule all pears in the known universe.', baseCost: 200000,clickBonus: 250,passiveBonus: 100  },
]

// Cost scales by 1.15x per purchase of the same upgrade
function getUpgradeCost(upgrade, ownedCount) {
  return Math.floor(upgrade.baseCost * Math.pow(1.15, ownedCount))
}

export default function PearClicker({ currentUser, onTokensUpdated }) {
  const [score, setScore]               = useState(0)
  const [totalEarned, setTotalEarned]   = useState(0)
  const [clickPower, setClickPower]     = useState(1)
  const [passiveRate, setPassiveRate]   = useState(0)
  const [owned, setOwned]               = useState({}) // { upgrade_id: count }
  const [tokensGained, setTokensGained] = useState(0)
  const [floatingNums, setFloatingNums] = useState([])
  const [converting, setConverting]     = useState(false)
  const passiveRef   = useRef(passiveRate)
  const scoreRef     = useRef(score)
  const totalRef     = useRef(totalEarned)
  const floatId      = useRef(0)

  // Keep refs in sync
  useEffect(() => { passiveRef.current = passiveRate }, [passiveRate])
  useEffect(() => { scoreRef.current = score },         [score])
  useEffect(() => { totalRef.current = totalEarned },   [totalEarned])

  // ── Passive income ticker ────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (passiveRef.current > 0) {
        const gain = passiveRef.current / 10 // tick 10x/sec
        setScore(s => parseFloat((s + gain).toFixed(2)))
        setTotalEarned(t => parseFloat((t + gain).toFixed(2)))
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  // ── Click handler ────────────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    const gain = clickPower
    setScore(s => parseFloat((s + gain).toFixed(2)))
    setTotalEarned(t => parseFloat((t + gain).toFixed(2)))

    // Spawn floating number
    const id = floatId.current++
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + (Math.random() * 40 - 20)
    const y = e.clientY - rect.top  - 20
    setFloatingNums(f => [...f, { id, x, y, value: `+${gain}` }])
    setTimeout(() => setFloatingNums(f => f.filter(n => n.id !== id)), 800)
  }, [clickPower])

  // ── Buy upgrade ─────────────────────────────────────────────────────────
  const buyUpgrade = (upgrade) => {
    const count = owned[upgrade.id] || 0
    const cost  = getUpgradeCost(upgrade, count)
    if (score < cost) return

    setScore(s => parseFloat((s - cost).toFixed(2)))
    const newOwned = { ...owned, [upgrade.id]: count + 1 }
    setOwned(newOwned)

    // Recalculate totals
    let newClick = 1, newPassive = 0
    UPGRADES.forEach(u => {
      const n = newOwned[u.id] || 0
      newClick   += u.clickBonus  * n
      newPassive += u.passiveBonus * n
    })
    setClickPower(newClick)
    setPassiveRate(parseFloat(newPassive.toFixed(2)))
  }

  // ── Convert score → PearTokens ───────────────────────────────────────────
  // Rule: 50,000 pears = 1 PearToken, max 4 tokens per session
  const MAX_TOKENS = 4
  const tokensLeft = MAX_TOKENS - tokensGained
  const convertibleTokens = Math.min(Math.floor(score / 50000), tokensLeft)

  const handleConvert = async () => {
    if (convertibleTokens < 1) return
    setConverting(true)
    const scoreUsed = convertibleTokens * 2

    const { data, error } = await supabase
      .from('members')
      .update({ tokens: (currentUser.tokens || 0) + convertibleTokens })
      .eq('id', currentUser.id)
      .select()
      .single()

    if (!error && data) {
      setScore(s => parseFloat((s - convertibleTokens * 50000).toFixed(2)))
      setTokensGained(t => t + convertibleTokens)
      onTokensUpdated && onTokensUpdated(data)
    }
    setConverting(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const perSecond = parseFloat(passiveRate.toFixed(1))

  return (
    <div className="clicker-wrapper">

      {/* Left: Stats + Click area */}
      <div className="clicker-left">
        <div className="clicker-stats">
          <div className="stat-box">
            <span className="stat-num">{Math.floor(score).toLocaleString()}</span>
            <span className="stat-label">Pears</span>
          </div>
          <div className="stat-box small">
            <span className="stat-num">+{clickPower}</span>
            <span className="stat-label">per click</span>
          </div>
          <div className="stat-box small">
            <span className="stat-num">{perSecond}/s</span>
            <span className="stat-label">passive</span>
          </div>
        </div>

        <div className="clicker-area" onClick={handleClick}>
          <span className="clicker-pear" role="img" aria-label="pear">🍐</span>
          {floatingNums.map(n => (
            <span key={n.id} className="float-num" style={{ left: n.x, top: n.y }}>
              {n.value}
            </span>
          ))}
        </div>

        {/* Token conversion */}
        <div className="token-convert-box">
          <p className="convert-rule">💱 <strong>50,000 pears = 1 PearToken</strong> (max 4 per session)</p>
          <p className="convert-preview">
            {tokensGained >= MAX_TOKENS
              ? '✅ You have earned the maximum 4 tokens this session!'
              : <>You can earn <strong>{convertibleTokens}</strong> more token{convertibleTokens !== 1 ? 's' : ''} right now ({tokensGained}/{MAX_TOKENS} earned)</>}
          </p>
          <button
            className={`btn-convert ${convertibleTokens < 1 || tokensGained >= MAX_TOKENS ? 'disabled' : ''}`}
            onClick={handleConvert}
            disabled={convertibleTokens < 1 || tokensGained >= MAX_TOKENS || converting}
          >
            {converting ? 'Converting…' : `Convert → +${convertibleTokens} PearToken${convertibleTokens !== 1 ? 's' : ''}`}
          </button>
          {tokensGained > 0 && (
            <p className="tokens-earned">🏆 Earned this session: <strong>{tokensGained} / {MAX_TOKENS} PT</strong></p>
          )}
        </div>
      </div>

      {/* Right: Upgrade shop */}
      <div className="clicker-shop">
        <h3 className="shop-title">🛒 Upgrade Shop</h3>
        {UPGRADES.map(upgrade => {
          const count   = owned[upgrade.id] || 0
          const cost    = getUpgradeCost(upgrade, count)
          const canBuy  = score >= cost
          return (
            <button
              key={upgrade.id}
              className={`upgrade-btn ${canBuy ? 'can-buy' : 'cant-buy'}`}
              onClick={() => buyUpgrade(upgrade)}
              title={upgrade.desc}
            >
              <div className="upgrade-top">
                <span className="upgrade-name">{upgrade.name}</span>
                <span className="upgrade-count">{count > 0 ? `×${count}` : ''}</span>
              </div>
              <div className="upgrade-bottom">
                <span className="upgrade-desc">{upgrade.desc}</span>
                <span className="upgrade-cost">🍐 {cost.toLocaleString()}</span>
              </div>
              <div className="upgrade-bonuses">
                +{upgrade.clickBonus} click
                {upgrade.passiveBonus > 0 && ` · +${upgrade.passiveBonus}/s`}
              </div>
            </button>
          )
        })}
      </div>

    </div>
  )
}
