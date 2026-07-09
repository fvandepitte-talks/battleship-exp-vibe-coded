import React from 'react'
import { Cell, CellState } from '../game/types'

interface Props {
  cell: Cell
  /** Show the ship (for player board) */
  revealShips?: boolean
  /** Heat value 0–1 from Admiral's heatmap */
  heatValue?: number
  showHeatmap?: boolean
  onClick?: (row: number, col: number) => void
  onHover?: (row: number, col: number) => void
  /** Whether this cell is the last-shot indicator */
  lastShot?: boolean
  /** Preview ship placement overlay */
  placementPreview?: 'valid' | 'invalid' | null
}

function cellLabel(state: CellState, reveal: boolean): string {
  switch (state) {
    case 'hit':  return '💥'
    case 'sunk': return '☠️'
    case 'miss': return '•'
    case 'ship': return reveal ? '🚢' : ''
    default:     return ''
  }
}

function stateClass(state: CellState, reveal: boolean): string {
  switch (state) {
    case 'hit':  return 'cell-hit'
    case 'sunk': return 'cell-sunk'
    case 'miss': return 'cell-miss'
    case 'ship': return reveal ? 'cell-ship' : 'cell-empty'
    default:     return 'cell-empty'
  }
}

const BoardCell: React.FC<Props> = ({
  cell,
  revealShips = false,
  heatValue = 0,
  showHeatmap = false,
  onClick,
  onHover,
  lastShot = false,
  placementPreview = null,
}) => {
  const isShottable = cell.state === 'empty' || (cell.state === 'ship' && !revealShips)

  const heatStyle: React.CSSProperties = {}
  if (showHeatmap && heatValue > 0 && isShottable) {
    const opacity = Math.min(0.75, heatValue * 0.85)
    heatStyle.background = `rgba(255, 60, 60, ${opacity})`
  }

  let previewClass = ''
  if (placementPreview === 'valid') previewClass = 'cell-preview-valid'
  if (placementPreview === 'invalid') previewClass = 'cell-preview-invalid'

  return (
    <div
      className={`board-cell ${stateClass(cell.state, revealShips)} ${lastShot ? 'cell-last-shot' : ''} ${previewClass}`}
      style={heatStyle}
      onClick={() => onClick?.(cell.row, cell.col)}
      onMouseEnter={() => onHover?.(cell.row, cell.col)}
      role="button"
      aria-label={`Row ${cell.row + 1}, Col ${cell.col + 1}: ${cell.state}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(cell.row, cell.col)}
    >
      <span className="cell-content">{cellLabel(cell.state, revealShips)}</span>
    </div>
  )
}

export default BoardCell
