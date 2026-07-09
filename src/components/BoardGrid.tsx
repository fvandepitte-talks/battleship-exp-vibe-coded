import React from 'react'
import { Board } from '../game/types'
import { HeatmapGrid } from '../game/heatmap'
import BoardCell from './BoardCell'

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
const ROWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

interface PlacementHover {
  row: number
  col: number
  size: number
  orientation: 'horizontal' | 'vertical'
  valid: boolean
}

interface Props {
  board: Board
  label: string
  revealShips?: boolean
  onCellClick?: (row: number, col: number) => void
  heatmap?: HeatmapGrid | null
  showHeatmap?: boolean
  lastShot?: { row: number; col: number } | null
  placementHover?: PlacementHover | null
  onCellHover?: (row: number, col: number) => void
  disabled?: boolean
}

const BoardGrid: React.FC<Props> = ({
  board,
  label,
  revealShips = false,
  onCellClick,
  heatmap = null,
  showHeatmap = false,
  lastShot = null,
  placementHover = null,
  onCellHover,
  disabled = false,
}) => {
  function getPreview(row: number, col: number): 'valid' | 'invalid' | null {
    if (!placementHover) return null
    const { row: pr, col: pc, size, orientation, valid } = placementHover
    for (let i = 0; i < size; i++) {
      const r = orientation === 'vertical' ? pr + i : pr
      const c = orientation === 'horizontal' ? pc + i : pc
      if (r === row && c === col) return valid ? 'valid' : 'invalid'
    }
    return null
  }

  return (
    <div className="board-container">
      <h3 className="board-label">{label}</h3>
      <div className="board-grid" aria-label={label}>
        {/* Column headers */}
        <div className="board-corner" />
        {COLS.map(c => (
          <div key={c} className="board-header">{c}</div>
        ))}

        {board.cells.map((row, ri) => (
          <React.Fragment key={ri}>
            <div className="board-header row-header">{ROWS[ri]}</div>
            {row.map((cell, ci) => (
              <BoardCell
                key={ci}
                cell={cell}
                revealShips={revealShips}
                heatValue={heatmap?.[ri]?.[ci] ?? 0}
                showHeatmap={showHeatmap}
                onClick={disabled ? undefined : onCellClick}
                onHover={onCellHover}
                lastShot={lastShot?.row === ri && lastShot?.col === ci}
                placementPreview={getPreview(ri, ci)}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export default BoardGrid
