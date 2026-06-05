import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Word Pool (200 words) ────────────────────────────────────────────────────
const WORD_POOL = [
  // Common English
  'the', 'be', 'to', 'of', 'and', 'that', 'have', 'it', 'for', 'not',
  'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his',
  'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will',
  'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
  'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can',
  'like', 'time', 'no', 'just', 'him', 'know', 'take', 'into', 'year', 'your',
  'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look',
  'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
  'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'any',
  'these', 'give', 'day', 'most', 'us', 'great', 'between', 'need', 'large', 'often', 'hello', 'zach cooks',
  // Tech words
  'code', 'data', 'file', 'loop', 'test', 'build', 'push', 'pull', 'merge', 'clone',
  'debug', 'error', 'stack', 'array', 'query', 'index', 'cache', 'token', 'fetch', 'async',
  'await', 'render', 'state', 'props', 'event', 'click', 'input', 'value', 'type', 'class',
  'import', 'export', 'module', 'deploy', 'server', 'client', 'socket', 'buffer', 'kernel', 'syntax',
  'pixel', 'vector', 'frame', 'branch', 'commit', 'revert', 'patch', 'config', 'parse', 'compile',
  // 3D Printing terms
  'filament', 'layer', 'infill', 'nozzle', 'slicer', 'resin', 'extrude', 'support', 'raft', 'brim',
  'skirt', 'gcode', 'hotend', 'retract', 'overhang', 'bridge', 'mesh', 'boolean', 'axis', 'print',
  'model', 'stitch', 'mirror', 'hollow', 'solid', 'shell', 'draft', 'scale', 'orient', 'slice',
  'plate', 'purge', 'prime', 'warp', 'crack', 'fuse', 'melt', 'cool', 'speed', 'travel',
  'extruder', 'bed', 'adhesion', 'calibrate', 'firmware', 'sensor', 'stepper', 'belt', 'rail', 'frame', 'filament'
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTodayString() {
  return new Date().toLocaleDateString('en-CA') // "2026-06-05"
}

function getDailyTypingTokens() {
  try {
    const stored = JSON.parse(localStorage.getItem('typing_daily') || '{}')
    return stored.date === getTodayString() ? (stored.tokens || 0) : 0
  } catch {
    return 0
  }
}

function saveDailyTypingTokens(count) {
  localStorage.setItem('typing_daily', JSON.stringify({ date: getTodayString(), tokens: count }))
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateText() {
  return shuffleArray(WORD_POOL).slice(0, 60).join(' ')
}

const GAME_DURATION = 30
const MAX_DAILY_TOKENS = 20
const AWARD_AMOUNT = 2
const MIN_WPM = 45
const MIN_ACCURACY = 95

// ─── Component ────────────────────────────────────────────────────────────────
export default function TypingGame({ currentUser, onTokensUpdated }) {
  const [phase, setPhase] = useState('idle')
  const [fullText, setFullText] = useState(() => generateText())
  const [typed, setTyped] = useState('')
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [tokensEarned, setTokensEarned] = useState(() => getDailyTypingTokens())
  const [awarding, setAwarding] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  // Refs that always hold the latest values — safe to read inside intervals
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const typedRef = useRef('')
  const fullTextRef = useRef(fullText)
  const awardingRef = useRef(false)

  // Keep refs in sync
  useEffect(() => { typedRef.current = typed }, [typed])
  useEffect(() => { fullTextRef.current = fullText }, [fullText])
  useEffect(() => { awardingRef.current = awarding }, [awarding])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // ── Award tokens (standalone, no stale closure risks) ──────────────────────
  const awardTokens = useCallback(async () => {
    if (awardingRef.current) return         // already running
    const currentDailyTokens = getDailyTypingTokens()
    const tokensLeft = MAX_DAILY_TOKENS - currentDailyTokens
    if (tokensLeft <= 0) return

    const toAward = Math.min(AWARD_AMOUNT, tokensLeft)
    setAwarding(true)
    awardingRef.current = true

    const { data, error } = await supabase
      .from('members')
      .update({ tokens: (currentUser.tokens || 0) + toAward })
      .eq('id', currentUser.id)
      .select()
      .single()

    if (!error && data) {
      const newDailyTotal = currentDailyTokens + toAward
      saveDailyTypingTokens(newDailyTotal)
      setTokensEarned(newDailyTotal)
      onTokensUpdated && onTokensUpdated(data)
    }
    setAwarding(false)
    awardingRef.current = false
  }, [currentUser, onTokensUpdated])

  // ── Finish game — reads from refs, never from stale closures ───────────────
  const finishGame = useCallback(() => {
    const currentTyped = typedRef.current
    const text = fullTextRef.current

    let correct = 0
    const total = currentTyped.length
    for (let i = 0; i < currentTyped.length; i++) {
      if (currentTyped[i] === text[i]) correct++
    }

    const wpm = Math.round((correct / 5) / (GAME_DURATION / 60))
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    const won = wpm >= MIN_WPM && accuracy >= MIN_ACCURACY

    setPhase('finished')
    setLastResult({ wpm, accuracy, won })

    if (won) awardTokens()
  }, [awardTokens])

  // ── Start countdown — uses a ref to finishGame so it's never stale ─────────
  const finishGameRef = useRef(finishGame)
  useEffect(() => { finishGameRef.current = finishGame }, [finishGame])

  const startTimer = useCallback(() => {
    if (timerRef.current) return // guard: already running
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          // Use ref so we always call the latest finishGame
          finishGameRef.current()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }, []) // intentionally empty — reads from refs only

  // ── Handle input change ────────────────────────────────────────────────────
  const handleChange = useCallback((e) => {
    if (phase === 'finished') return

    const newVal = e.target.value

    // Block typing past end of text
    if (newVal.length > fullTextRef.current.length) return

    // First keystroke → start timer and transition phase
    if (typedRef.current.length === 0 && newVal.length === 1) {
      setPhase('typing')
      startTimer()
    }

    setTyped(newVal)
    typedRef.current = newVal
  }, [phase, startTimer])

  // ── Reset game ─────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const fresh = generateText()
    setPhase('idle')
    setFullText(fresh)
    fullTextRef.current = fresh
    setTyped('')
    typedRef.current = ''
    setTimeLeft(GAME_DURATION)
    setLastResult(null)
    setTokensEarned(getDailyTypingTokens())
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // ── Derived values for render ──────────────────────────────────────────────
  const dailyMax = tokensEarned >= MAX_DAILY_TOKENS
  const elapsedSeconds = GAME_DURATION - timeLeft
  const chars = fullText.split('')

  // Live WPM / accuracy during game
  let liveWPM = 0, liveAccuracy = 100
  if (phase === 'typing' && elapsedSeconds > 0) {
    let liveCorrect = 0
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === fullText[i]) liveCorrect++
    }
    liveWPM = Math.round((liveCorrect / 5) / (elapsedSeconds / 60))
    liveAccuracy = typed.length > 0 ? Math.round((liveCorrect / typed.length) * 100) : 100
  }

  const focusInput = () => inputRef.current?.focus()

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="typing-game-wrapper">

      {/* Header */}
      <div className="typing-game-header">
        <div className="typing-game-title-row">
          <h3 className="typing-game-title">⌨️ Typing Challenge</h3>
          <span className="typing-daily-badge">
            📅 {tokensEarned} / {MAX_DAILY_TOKENS} tokens today
          </span>
        </div>
        <p className="typing-game-desc">
          Type the words below. Hit <strong>≥45 WPM</strong> with <strong>≥95% accuracy</strong> in 30 seconds → earn <strong>2 PearTokens</strong>.
        </p>
      </div>

      {/* Timer bar */}
      <div className="typing-timer-row">
        <span className={`typing-timer${timeLeft <= 5 && phase === 'typing' ? ' danger' : ''}`}>
          {phase === 'idle' ? '30' : timeLeft}s
        </span>
        <div className="typing-timer-bar-bg">
          <div
            className={`typing-timer-bar${timeLeft <= 5 && phase === 'typing' ? ' danger' : ''}`}
            style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
          />
        </div>
        {phase === 'typing' && (
          <div className="typing-live-stats">
            <span className={liveWPM >= MIN_WPM ? 'stat-good' : 'stat-bad'}>{liveWPM} WPM</span>
            <span className="stat-sep">·</span>
            <span className={liveAccuracy >= MIN_ACCURACY ? 'stat-good' : 'stat-bad'}>{liveAccuracy}%</span>
          </div>
        )}
      </div>

      {/* Word display */}
      {phase !== 'finished' && (
        <div className="typing-display" onClick={focusInput}>
          {phase === 'idle' && (
            <div className="typing-idle-hint">Click here or start typing to begin ↓</div>
          )}
          <div className="typing-text">
            {chars.map((char, i) => {
              let cls = 'char-pending'
              if (i < typed.length) {
                cls = typed[i] === char ? 'char-correct' : 'char-wrong'
              } else if (i === typed.length) {
                cls = 'char-cursor'
              }
              return (
                <span key={i} className={cls}>
                  {char === ' ' ? '\u00A0' : char}
                </span>
              )
            })}
          </div>
          {/* Hidden input — captures all keystrokes, invisible to user */}
          <input
            ref={inputRef}
            className="typing-hidden-input"
            value={typed}
            onChange={handleChange}
            disabled={phase === 'finished' || dailyMax}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Type here"
          />
        </div>
      )}

      {/* Daily cap warning (idle state) */}
      {phase === 'idle' && dailyMax && (
        <div className="typing-cap-banner">
          ✅ You've hit the daily limit of {MAX_DAILY_TOKENS} tokens. Resets at midnight!
        </div>
      )}

      {/* Results card */}
      {phase === 'finished' && lastResult && (
        <div className={`typing-result-card ${lastResult.won ? 'win' : 'lose'}`}>
          <div className="result-icon">{lastResult.won ? '🏆' : '😅'}</div>
          <h3 className="result-title">
            {lastResult.won ? 'You earned 2 PearTokens!' : 'Not quite — try again!'}
          </h3>
          <div className="result-stats">
            <div className={`result-stat ${lastResult.wpm >= MIN_WPM ? 'pass' : 'fail'}`}>
              <span className="result-stat-num">{lastResult.wpm}</span>
              <span className="result-stat-label">WPM {lastResult.wpm >= MIN_WPM ? '✅' : `❌ need ${MIN_WPM}`}</span>
            </div>
            <div className={`result-stat ${lastResult.accuracy >= MIN_ACCURACY ? 'pass' : 'fail'}`}>
              <span className="result-stat-num">{lastResult.accuracy}%</span>
              <span className="result-stat-label">Accuracy {lastResult.accuracy >= MIN_ACCURACY ? '✅' : `❌ need ${MIN_ACCURACY}%`}</span>
            </div>
          </div>
          {lastResult.won && awarding && (
            <p className="result-awarding">Awarding tokens…</p>
          )}
          {dailyMax ? (
            <p className="result-cap-msg">
              ✅ You've reached the 20 token daily limit. Come back tomorrow!
            </p>
          ) : (
            <button className="btn-try-again" onClick={resetGame}>
              🔄 Try Again
            </button>
          )}
          <p className="result-daily-info">
            Tokens earned today: <strong>{tokensEarned} / {MAX_DAILY_TOKENS}</strong>
          </p>
        </div>
      )}
    </div>
  )
}
