import { describe, it, expect } from 'vitest'
import {
  createEmptyBoard,
  placeShip,
  placeFleetRandomly,
  processShot,
  canPlaceShip,
  allShipsSunk,
} from '../board'
import { FLEET } from '../types'

const carrier = FLEET[0]   // size 5
const destroyer = FLEET[4]  // size 2

// ─── Board creation ───────────────────────────────────────────────────────────

describe('createEmptyBoard', () => {
  it('creates a 10×10 grid of empty cells', () => {
    const board = createEmptyBoard()
    expect(board.cells).toHaveLength(10)
    expect(board.cells[0]).toHaveLength(10)
    board.cells.forEach(row =>
      row.forEach(cell => {
        expect(cell.state).toBe('empty')
        expect(cell.shipId).toBeNull()
      })
    )
  })

  it('starts with no ships', () => {
    expect(createEmptyBoard().ships).toHaveLength(0)
  })
})

// ─── Ship placement ───────────────────────────────────────────────────────────

describe('canPlaceShip', () => {
  it('allows valid placement', () => {
    const board = createEmptyBoard()
    expect(canPlaceShip(board, 0, 0, 3, 'horizontal')).toBe(true)
  })

  it('rejects out-of-bounds placement', () => {
    const board = createEmptyBoard()
    expect(canPlaceShip(board, 0, 8, 5, 'horizontal')).toBe(false)
    expect(canPlaceShip(board, 8, 0, 5, 'vertical')).toBe(false)
  })

  it('rejects overlapping placement', () => {
    const board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    expect(canPlaceShip(board, 0, 0, 3, 'horizontal')).toBe(false)
  })

  it('rejects adjacent placement (no-touching rule)', () => {
    const board = placeShip(createEmptyBoard(), destroyer, 2, 2, 'horizontal')
    expect(canPlaceShip(board, 2, 4, 3, 'horizontal')).toBe(false) // touches end of destroyer
    expect(canPlaceShip(board, 1, 1, 2, 'horizontal')).toBe(false) // diagonal
  })
})

describe('placeShip', () => {
  it('places a horizontal ship correctly', () => {
    const board = placeShip(createEmptyBoard(), destroyer, 3, 3, 'horizontal')
    expect(board.cells[3][3].state).toBe('ship')
    expect(board.cells[3][4].state).toBe('ship')
    expect(board.cells[3][5].state).toBe('empty') // size=2, so col 5 untouched
    expect(board.ships).toHaveLength(1)
    expect(board.ships[0].id).toBe('destroyer')
  })

  it('places a vertical ship correctly', () => {
    const board = placeShip(createEmptyBoard(), carrier, 0, 0, 'vertical')
    for (let r = 0; r < 5; r++) {
      expect(board.cells[r][0].state).toBe('ship')
    }
  })

  it('throws when placement is invalid', () => {
    const board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    expect(() => placeShip(board, carrier, 0, 0, 'horizontal')).toThrow()
  })
})

// ─── Shot processing ──────────────────────────────────────────────────────────

describe('processShot - miss', () => {
  it('returns miss result on empty cell', () => {
    const board = createEmptyBoard()
    const { outcome } = processShot(board, 5, 5)
    expect(outcome.result).toBe('miss')
    expect(outcome.won).toBe(false)
  })

  it('marks cell as miss on the returned board', () => {
    const board = createEmptyBoard()
    const { board: after } = processShot(board, 5, 5)
    expect(after.cells[5][5].state).toBe('miss')
  })
})

describe('processShot - hit', () => {
  it('returns hit result on ship cell', () => {
    const board = placeShip(createEmptyBoard(), carrier, 0, 0, 'horizontal')
    const { outcome } = processShot(board, 0, 0)
    expect(outcome.result).toBe('hit')
    expect(outcome.shipName).toBe('Carrier')
    expect(outcome.won).toBe(false)
  })

  it('marks cell as hit on the returned board', () => {
    const board = placeShip(createEmptyBoard(), carrier, 0, 0, 'horizontal')
    const { board: after } = processShot(board, 0, 0)
    expect(after.cells[0][0].state).toBe('hit')
  })

  it('increments ship hit count', () => {
    const board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    const { board: after } = processShot(board, 0, 0)
    expect(after.ships[0].hits).toBe(1)
    expect(after.ships[0].sunk).toBe(false)
  })
})

describe('processShot - sunk', () => {
  it('returns sunk when all ship cells are hit', () => {
    let board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    let result = processShot(board, 0, 0)
    board = result.board
    result = processShot(board, 0, 1)
    expect(result.outcome.result).toBe('sunk')
    expect(result.outcome.shipName).toBe('Destroyer')
  })

  it('marks all ship cells as sunk', () => {
    let board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    board = processShot(board, 0, 0).board
    board = processShot(board, 0, 1).board
    expect(board.cells[0][0].state).toBe('sunk')
    expect(board.cells[0][1].state).toBe('sunk')
  })
})

describe('processShot - repeat shot', () => {
  it('returns already_shot when hitting a miss cell again', () => {
    const board = createEmptyBoard()
    const { board: after } = processShot(board, 5, 5)
    const { outcome } = processShot(after, 5, 5)
    expect(outcome.result).toBe('already_shot')
  })

  it('returns already_shot when hitting a hit cell again', () => {
    let board = placeShip(createEmptyBoard(), carrier, 0, 0, 'horizontal')
    board = processShot(board, 0, 0).board
    const { outcome } = processShot(board, 0, 0)
    expect(outcome.result).toBe('already_shot')
  })

  it('does not modify the board on already_shot', () => {
    const board = createEmptyBoard()
    const { board: after1 } = processShot(board, 5, 5)
    const { board: after2 } = processShot(after1, 5, 5)
    // Board should be unchanged (still 'miss' not something else)
    expect(after2.cells[5][5].state).toBe('miss')
  })
})

describe('win detection', () => {
  it('returns won=true when all ships are sunk', () => {
    let board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    board = processShot(board, 0, 0).board
    const { outcome } = processShot(board, 0, 1)
    expect(outcome.won).toBe(true)
  })

  it('does not win if other ships remain', () => {
    let board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    board = placeShip(board, carrier, 5, 0, 'horizontal')
    board = processShot(board, 0, 0).board
    const { outcome } = processShot(board, 0, 1)
    expect(outcome.result).toBe('sunk')
    expect(outcome.won).toBe(false)
  })
})

describe('allShipsSunk', () => {
  it('returns false when ships remain', () => {
    const board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    expect(allShipsSunk(board)).toBe(false)
  })

  it('returns true when all ships sunk', () => {
    let board = placeShip(createEmptyBoard(), destroyer, 0, 0, 'horizontal')
    board = processShot(board, 0, 0).board
    board = processShot(board, 0, 1).board
    expect(allShipsSunk(board)).toBe(true)
  })
})

// ─── Random fleet placement ────────────────────────────────────────────────────

describe('placeFleetRandomly', () => {
  it('places all 5 ships', () => {
    const board = placeFleetRandomly()
    expect(board.ships).toHaveLength(5)
  })

  it('places exactly the right number of ship cells', () => {
    const board = placeFleetRandomly()
    const shipCells = board.cells.flat().filter(c => c.state === 'ship')
    const totalSize = FLEET.reduce((sum, s) => sum + s.size, 0) // 5+4+3+3+2 = 17
    expect(shipCells).toHaveLength(totalSize)
  })

  it('produces a different layout each time (statistically)', () => {
    const b1 = placeFleetRandomly()
    const b2 = placeFleetRandomly()
    const s1 = b1.cells.flat().map(c => c.state).join('')
    const s2 = b2.cells.flat().map(c => c.state).join('')
    // Astronomically unlikely to be identical
    expect(s1).not.toBe(s2)
  })
})

// ─── Out-of-bounds shot ───────────────────────────────────────────────────────

describe('processShot - invalid', () => {
  it('returns invalid for out-of-bounds shot', () => {
    const board = createEmptyBoard()
    expect(processShot(board, -1, 0).outcome.result).toBe('invalid')
    expect(processShot(board, 10, 0).outcome.result).toBe('invalid')
    expect(processShot(board, 0, 10).outcome.result).toBe('invalid')
  })
})
