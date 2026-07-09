import React from 'react'
import { Winner } from '../game/types'

interface Props {
  winner: Winner
  onPlayAgain: () => void
  shotsTaken: number
  aiShots: number
}

const GameOverScreen: React.FC<Props> = ({ winner, onPlayAgain, shotsTaken, aiShots }) => {
  const playerWon = winner === 'player'

  return (
    <div className="game-over-overlay">
      <div className="game-over-card">
        <div className="game-over-emoji">{playerWon ? '🎉' : '💀'}</div>
        <h2 className="game-over-title">
          {playerWon ? 'Victory!' : 'Defeated!'}
        </h2>
        <p className="game-over-subtitle">
          {playerWon
            ? 'You sank the entire enemy fleet!'
            : 'The enemy sank your entire fleet!'}
        </p>
        <div className="game-over-stats">
          <div className="stat">
            <span className="stat-value">{shotsTaken}</span>
            <span className="stat-label">Your shots</span>
          </div>
          <div className="stat">
            <span className="stat-value">{aiShots}</span>
            <span className="stat-label">Enemy shots</span>
          </div>
        </div>
        <button className="btn btn-primary play-again-btn" onClick={onPlayAgain}>
          🚀 Play Again
        </button>
      </div>
    </div>
  )
}

export default GameOverScreen
