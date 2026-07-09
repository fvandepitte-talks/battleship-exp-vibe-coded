import React from 'react'
import { Board, PlacedShip } from '../game/types'

interface Props {
  playerBoard: Board
  aiBoard: Board
  message: string
  isPlayerTurn: boolean
  showHeatmap: boolean
  onToggleHeatmap: () => void
  difficulty: string
}

function fleetStatus(ships: PlacedShip[]): React.ReactNode {
  return ships.map(s => (
    <span
      key={s.id}
      className={`ship-status ${s.sunk ? 'ship-sunk' : 'ship-alive'}`}
      title={`${s.name} (${s.size})`}
    >
      {s.sunk ? '☠️' : '🚢'}
    </span>
  ))
}

const GameStatus: React.FC<Props> = ({
  playerBoard,
  aiBoard,
  message,
  isPlayerTurn,
  showHeatmap,
  onToggleHeatmap,
  difficulty,
}) => {
  const playerAlive = playerBoard.ships.filter(s => !s.sunk).length
  const aiAlive = aiBoard.ships.filter(s => !s.sunk).length

  return (
    <div className="game-status">
      <div className="status-message-row">
        <p className="status-message">{message}</p>
        <span className={`turn-badge ${isPlayerTurn ? 'your-turn' : 'ai-turn'}`}>
          {isPlayerTurn ? '🎯 Your turn' : '🤖 AI thinking…'}
        </span>
      </div>

      <div className="fleet-overview">
        <div className="fleet-section">
          <span className="fleet-label">Your fleet ({playerAlive} remaining):</span>
          <div className="fleet-icons">{fleetStatus(playerBoard.ships)}</div>
        </div>
        <div className="fleet-section">
          <span className="fleet-label">Enemy fleet ({aiAlive} remaining):</span>
          <div className="fleet-icons">{fleetStatus(aiBoard.ships)}</div>
        </div>
      </div>

      <div className="heatmap-toggle-row">
        <button
          className={`btn btn-ghost heatmap-btn ${showHeatmap ? 'active' : ''}`}
          onClick={onToggleHeatmap}
          title="Admiral's Heatmap — shows probability of enemy ship locations"
        >
          🗺️ {showHeatmap ? 'Hide' : 'Show'} Admiral's Heatmap
        </button>
        <span className="difficulty-badge">AI: {difficulty}</span>
      </div>
    </div>
  )
}

export default GameStatus
