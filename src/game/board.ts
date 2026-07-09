import {
  BOARD_SIZE,
  Board,
  Cell,
  FLEET,
  Orientation,
  PlacedShip,
  ShipConfig,
  ShotOutcome,
} from './types'

// ─── Board factory ─────────────────────────────────────────────────────────────

export function createEmptyBoard(): Board {
  const cells: Cell[][] = Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col) => ({
      row,
      col,
      state: 'empty' as const,
      shipId: null,
    }))
  )
  return { cells, ships: [] }
}

// ─── Placement validation ──────────────────────────────────────────────────────

export function canPlaceShip(
  board: Board,
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): boolean {
  for (let i = 0; i < size; i++) {
    const r = orientation === 'vertical' ? row + i : row
    const c = orientation === 'horizontal' ? col + i : col
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false
    if (board.cells[r][c].shipId !== null) return false
    // Check adjacent cells (no touching ships rule)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          if (board.cells[nr][nc].shipId !== null) return false
        }
      }
    }
  }
  return true
}

export function placeShip(
  board: Board,
  ship: ShipConfig,
  row: number,
  col: number,
  orientation: Orientation
): Board {
  if (!canPlaceShip(board, row, col, ship.size, orientation)) {
    throw new Error(`Cannot place ${ship.name} at (${row},${col}) ${orientation}`)
  }

  const newBoard = cloneBoard(board)
  const cells: Array<{ row: number; col: number }> = []

  for (let i = 0; i < ship.size; i++) {
    const r = orientation === 'vertical' ? row + i : row
    const c = orientation === 'horizontal' ? col + i : col
    newBoard.cells[r][c] = { ...newBoard.cells[r][c], state: 'ship', shipId: ship.id }
    cells.push({ row: r, col: c })
  }

  const placed: PlacedShip = { ...ship, cells, hits: 0, sunk: false }
  newBoard.ships = [...newBoard.ships, placed]
  return newBoard
}

// ─── Random placement ──────────────────────────────────────────────────────────

export function placeFleetRandomly(rng: () => number = Math.random): Board {
  let board = createEmptyBoard()
  for (const ship of FLEET) {
    let placed = false
    let attempts = 0
    while (!placed && attempts < 1000) {
      attempts++
      const row = Math.floor(rng() * BOARD_SIZE)
      const col = Math.floor(rng() * BOARD_SIZE)
      const orientation: Orientation = rng() < 0.5 ? 'horizontal' : 'vertical'
      if (canPlaceShip(board, row, col, ship.size, orientation)) {
        board = placeShip(board, ship, row, col, orientation)
        placed = true
      }
    }
    if (!placed) throw new Error(`Could not place ${ship.name} after 1000 attempts`)
  }
  return board
}

// ─── Shot processing ───────────────────────────────────────────────────────────

export function processShot(board: Board, row: number, col: number): { board: Board; outcome: ShotOutcome } {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { board, outcome: { result: 'invalid', won: false } }
  }

  const cell = board.cells[row][col]

  if (cell.state === 'hit' || cell.state === 'miss' || cell.state === 'sunk') {
    return { board, outcome: { result: 'already_shot', won: false } }
  }

  const newBoard = cloneBoard(board)

  if (cell.state === 'empty') {
    newBoard.cells[row][col] = { ...cell, state: 'miss' }
    return { board: newBoard, outcome: { result: 'miss', won: false } }
  }

  // It's a ship cell
  newBoard.cells[row][col] = { ...cell, state: 'hit' }

  const shipIndex = newBoard.ships.findIndex(s => s.id === cell.shipId)
  const ship = { ...newBoard.ships[shipIndex], hits: newBoard.ships[shipIndex].hits + 1 }

  let result: ShotOutcome['result'] = 'hit'
  if (ship.hits === ship.size) {
    ship.sunk = true
    result = 'sunk'
    // Mark all ship cells as sunk
    for (const c of ship.cells) {
      newBoard.cells[c.row][c.col] = { ...newBoard.cells[c.row][c.col], state: 'sunk' }
    }
  }

  newBoard.ships = newBoard.ships.map((s, i) => (i === shipIndex ? ship : s))

  const won = newBoard.ships.every(s => s.sunk)
  return {
    board: newBoard,
    outcome: { result, shipName: ship.name, won },
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function cloneBoard(board: Board): Board {
  return {
    cells: board.cells.map(row => row.map(cell => ({ ...cell }))),
    ships: board.ships.map(ship => ({ ...ship, cells: [...ship.cells] })),
  }
}

export function countRemaining(board: Board): number {
  return board.ships.filter(s => !s.sunk).length
}

export function allShipsSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(s => s.sunk)
}

/** Returns a board copy with ships hidden (for opponent display) */
export function hiddenBoard(board: Board): Board {
  return {
    cells: board.cells.map(row =>
      row.map(cell => ({
        ...cell,
        state: cell.state === 'ship' ? 'empty' : cell.state,
        shipId: cell.state === 'ship' ? null : cell.shipId,
      }))
    ),
    ships: board.ships,
  }
}
