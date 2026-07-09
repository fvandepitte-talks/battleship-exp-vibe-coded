/**
 * Admiral's Heatmap — Special Feature
 * ─────────────────────────────────────
 * Calculates a probability distribution across all unshotted cells,
 * estimating how likely each cell is to contain an enemy ship segment.
 *
 * Algorithm:
 *   For every remaining (un-sunk) ship, count all valid placements that
 *   include each cell, then normalise to [0, 1].
 *
 * This gives players an "Admiral's eye" view, highlighting the most probable
 * enemy positions based purely on logical deduction from the hit/miss state.
 */

import { BOARD_SIZE, Board, PlacedShip } from './types'

export type HeatmapGrid = number[][] // [row][col] → probability 0–1

export function computeHeatmap(board: Board): HeatmapGrid {
  const counts: number[][] = Array.from({ length: BOARD_SIZE }, () =>
    new Array(BOARD_SIZE).fill(0)
  )

  const remaining = board.ships.filter(s => !s.sunk)

  for (const ship of remaining) {
    addShipProbabilities(board, ship, counts)
  }

  // Normalise
  let max = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (counts[r][c] > max) max = counts[r][c]
    }
  }

  if (max === 0) return counts

  return counts.map(row => row.map(v => v / max))
}

function addShipProbabilities(board: Board, ship: PlacedShip, counts: number[][]): void {
  // Try all horizontal placements
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c <= BOARD_SIZE - ship.size; c++) {
      if (isValidPlacement(board, r, c, ship.size, 'horizontal', ship)) {
        for (let i = 0; i < ship.size; i++) {
          counts[r][c + i]++
        }
      }
    }
  }

  // Try all vertical placements
  for (let r = 0; r <= BOARD_SIZE - ship.size; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (isValidPlacement(board, r, c, ship.size, 'vertical', ship)) {
        for (let i = 0; i < ship.size; i++) {
          counts[r + i][c]++
        }
      }
    }
  }
}

function isValidPlacement(
  board: Board,
  row: number,
  col: number,
  size: number,
  orientation: 'horizontal' | 'vertical',
  ship: PlacedShip
): boolean {
  for (let i = 0; i < size; i++) {
    const r = orientation === 'vertical' ? row + i : row
    const c = orientation === 'horizontal' ? col + i : col
    const cell = board.cells[r][c]

    // Can't place on a miss
    if (cell.state === 'miss') return false
    // Can't place on a sunk ship cell
    if (cell.state === 'sunk') return false
    // Can't place on a hit from a different ship
    // (hits from this ship's known cells ARE valid — they help constrain)
    if (cell.state === 'hit' && cell.shipId !== null && cell.shipId !== ship.id) return false
  }
  return true
}
