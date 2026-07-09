import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Board,
  FLEET,
  GamePhase,
  Orientation,
  ShipConfig,
  ShotOutcome,
  Winner,
} from './game/types'
import {
  createEmptyBoard,
  placeShip,
  placeFleetRandomly,
  processShot,
  canPlaceShip,
  hiddenBoard,
} from './game/board'
import {
  AIState,
  AIDifficulty,
  createAIState,
  chooseShot,
  updateAIAfterShot,
} from './game/ai'
import { computeHeatmap, HeatmapGrid } from './game/heatmap'
import BoardGrid from './components/BoardGrid'
import ShipRoster from './components/ShipRoster'
import GameStatus from './components/GameStatus'
import GameOverScreen from './components/GameOverScreen'
import './App.css'

const AI_DELAY_MS = 700

export default function App() {
  // ── Difficulty selection ──────────────────────────────────────────────────
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium')
  const [gameStarted, setGameStarted] = useState(false)

  // ── Game core state ───────────────────────────────────────────────────────
  const [phase, setPhase] = useState<GamePhase>('setup')
  const [playerBoard, setPlayerBoard] = useState<Board>(createEmptyBoard())
  const [aiBoard, setAiBoard] = useState<Board>(createEmptyBoard())
  const [aiState, setAiState] = useState<AIState>(createAIState('medium'))
  const [winner, setWinner] = useState<Winner>(null)
  const [message, setMessage] = useState('Place your ships to begin!')
  const [lastPlayerShot, setLastPlayerShot] = useState<{ row: number; col: number } | null>(null)
  const [lastAiShot, setLastAiShot] = useState<{ row: number; col: number } | null>(null)
  const [playerShotCount, setPlayerShotCount] = useState(0)
  const [aiShotCount, setAiShotCount] = useState(0)

  // ── Placement state ───────────────────────────────────────────────────────
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null)

  // ── Admiral's Heatmap ─────────────────────────────────────────────────────
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [heatmap, setHeatmap] = useState<HeatmapGrid | null>(null)

  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recompute heatmap whenever AI board changes and heatmap is shown
  useEffect(() => {
    if (showHeatmap && phase === 'player_turn') {
      setHeatmap(computeHeatmap(hiddenBoard(aiBoard)))
    } else if (!showHeatmap) {
      setHeatmap(null)
    }
  }, [aiBoard, showHeatmap, phase])

  // Keyboard shortcut: R = rotate ship
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'r' || e.key === 'R') {
        if (phase === 'setup') setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  // ── Placement handlers ────────────────────────────────────────────────────
  const handleSelectShip = useCallback((shipId: string) => {
    setSelectedShipId(shipId)
  }, [])

  const handlePlacementClick = useCallback((row: number, col: number) => {
    if (!selectedShipId) return
    const ship = FLEET.find(s => s.id === selectedShipId)
    if (!ship) return
    if (!canPlaceShip(playerBoard, row, col, ship.size, orientation)) return

    const newBoard = placeShip(playerBoard, ship, row, col, orientation)
    setPlayerBoard(newBoard)

    // Select next unplaced ship
    const placedIds = new Set(newBoard.ships.map(s => s.id))
    const nextShip = FLEET.find(s => !placedIds.has(s.id))
    setSelectedShipId(nextShip?.id ?? null)
  }, [selectedShipId, playerBoard, orientation])

  const handleRandomizePlacement = useCallback(() => {
    const board = placeFleetRandomly()
    setPlayerBoard(board)
    setSelectedShipId(null)
  }, [])

  const handleConfirmPlacement = useCallback(() => {
    const newAiBoard = placeFleetRandomly()
    setAiBoard(newAiBoard)
    setAiState(createAIState(difficulty))
    setPhase('player_turn')
    setMessage('Your turn — click the enemy grid to fire!')
  }, [difficulty])

  // ── Player shot ───────────────────────────────────────────────────────────
  const handlePlayerShot = useCallback((row: number, col: number) => {
    if (phase !== 'player_turn') return

    const { board: newAiBoard, outcome } = processShot(aiBoard, row, col)
    if (outcome.result === 'already_shot' || outcome.result === 'invalid') {
      setMessage('Already fired there! Choose another target.')
      return
    }

    setLastPlayerShot({ row, col })
    setPlayerShotCount(c => c + 1)

    const msg = buildMessage(outcome, 'player')
    setAiBoard(newAiBoard)

    if (outcome.won) {
      setWinner('player')
      setPhase('game_over')
      setMessage('🎉 You sank the entire fleet! Victory!')
      return
    }

    setMessage(msg + ' — Enemy is aiming…')
    setPhase('ai_turn')
  }, [phase, aiBoard])

  // ── AI turn ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ai_turn') return

    aiTimerRef.current = setTimeout(() => {
      const { row, col, nextState } = chooseShot(aiState, playerBoard)
      const { board: newPlayerBoard, outcome } = processShot(playerBoard, row, col)

      const updatedAI = (() => {
        if (outcome.result === 'hit' || outcome.result === 'sunk') {
          return updateAIAfterShot(nextState, row, col, outcome.result === 'sunk' ? 'sunk' : 'hit')
        }
        return updateAIAfterShot(nextState, row, col, 'miss')
      })()

      setAiState(updatedAI)
      setPlayerBoard(newPlayerBoard)
      setLastAiShot({ row, col })
      setAiShotCount(c => c + 1)

      if (outcome.won) {
        setWinner('ai')
        setPhase('game_over')
        setMessage('💀 Your fleet was destroyed!')
        return
      }

      const msg = buildMessage(outcome, 'ai')
      setMessage(msg + ' — Your turn!')
      setPhase('player_turn')
    }, AI_DELAY_MS)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restart ───────────────────────────────────────────────────────────────
  const handlePlayAgain = useCallback(() => {
    setPhase('setup')
    setPlayerBoard(createEmptyBoard())
    setAiBoard(createEmptyBoard())
    setAiState(createAIState(difficulty))
    setWinner(null)
    setMessage('Place your ships to begin!')
    setLastPlayerShot(null)
    setLastAiShot(null)
    setPlayerShotCount(0)
    setAiShotCount(0)
    setSelectedShipId(null)
    setHoverCell(null)
    setShowHeatmap(false)
    setHeatmap(null)
    setGameStarted(false)
  }, [difficulty])

  // ── Derived state ─────────────────────────────────────────────────────────
  const isPlacementComplete = playerBoard.ships.length === FLEET.length
  const selectedShip = FLEET.find(s => s.id === selectedShipId) as ShipConfig | undefined

  const placementHover = selectedShip && hoverCell && phase === 'setup'
    ? {
        row: hoverCell.row,
        col: hoverCell.col,
        size: selectedShip.size,
        orientation,
        valid: canPlaceShip(playerBoard, hoverCell.row, hoverCell.col, selectedShip.size, orientation),
      }
    : null

  // ── Difficulty selection screen ───────────────────────────────────────────
  if (!gameStarted) {
    return (
      <div className="welcome-screen">
        <div className="welcome-card">
          <h1 className="game-title">⚓ BATTLESHIP</h1>
          <p className="welcome-subtitle">Choose your challenge</p>
          <div className="difficulty-options">
            {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
              <button
                key={d}
                className={`btn difficulty-btn ${difficulty === d ? 'selected' : ''}`}
                onClick={() => setDifficulty(d)}
              >
                <span className="diff-icon">
                  {d === 'easy' ? '🌊' : d === 'medium' ? '⚓' : '💀'}
                </span>
                <span className="diff-label">{d.charAt(0).toUpperCase() + d.slice(1)}</span>
                <span className="diff-desc">
                  {d === 'easy' ? 'Random AI shots' : d === 'medium' ? 'Hunt & Target AI' : 'Aggressive targeting'}
                </span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary start-btn" onClick={() => setGameStarted(true)}>
            Set Sail →
          </button>
        </div>
      </div>
    )
  }

  // ── Game layout ───────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="game-title">⚓ BATTLESHIP</h1>
      </header>

      {phase === 'setup' && (
        <div className="setup-layout">
          <BoardGrid
            board={playerBoard}
            label="Your Sea"
            revealShips
            onCellClick={handlePlacementClick}
            onCellHover={(r, c) => setHoverCell({ row: r, col: c })}
            placementHover={placementHover}
          />
          <ShipRoster
            placedShips={playerBoard.ships}
            onSelectShip={handleSelectShip}
            selectedShipId={selectedShipId}
            orientation={orientation}
            onToggleOrientation={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
            onRandomize={handleRandomizePlacement}
            onConfirm={handleConfirmPlacement}
            isPlacementComplete={isPlacementComplete}
          />
        </div>
      )}

      {(phase === 'player_turn' || phase === 'ai_turn' || phase === 'game_over') && (
        <>
          <GameStatus
            playerBoard={playerBoard}
            aiBoard={aiBoard}
            message={message}
            isPlayerTurn={phase === 'player_turn'}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap(v => !v)}
            difficulty={difficulty}
          />
          <div className="battle-layout">
            <BoardGrid
              board={playerBoard}
              label="Your Sea"
              revealShips
              lastShot={lastAiShot}
              disabled
            />
            <BoardGrid
              board={hiddenBoard(aiBoard)}
              label="Enemy Waters"
              revealShips={phase === 'game_over'}
              onCellClick={phase === 'player_turn' ? handlePlayerShot : undefined}
              heatmap={heatmap}
              showHeatmap={showHeatmap && phase === 'player_turn'}
              lastShot={lastPlayerShot}
              disabled={phase !== 'player_turn'}
            />
          </div>
        </>
      )}

      {phase === 'game_over' && winner && (
        <GameOverScreen
          winner={winner}
          onPlayAgain={handlePlayAgain}
          shotsTaken={playerShotCount}
          aiShots={aiShotCount}
        />
      )}
    </div>
  )
}

function buildMessage(outcome: ShotOutcome, shooter: 'player' | 'ai'): string {
  const subj = shooter === 'player' ? 'You' : 'Enemy'
  switch (outcome.result) {
    case 'hit':  return `💥 ${subj} hit ${shooter === 'ai' ? 'your' : 'enemy'} ${outcome.shipName ?? 'ship'}!`
    case 'sunk': return `☠️ ${subj} sank ${shooter === 'ai' ? 'your' : 'the enemy'} ${outcome.shipName}!`
    case 'miss': return `💧 ${subj} missed.`
    default:     return ''
  }
}
