import { describe, it, expect } from 'vitest'
import { createAIState, chooseShot, updateAIAfterShot, wasTried } from '../ai'
import { createEmptyBoard } from '../board'

describe('AI state', () => {
  it('starts in hunt mode', () => {
    const ai = createAIState()
    expect(ai.mode).toBe('hunt')
    expect(ai.targetQueue).toHaveLength(0)
  })
})

describe('chooseShot', () => {
  it('returns a valid board coordinate', () => {
    const ai = createAIState('medium')
    const board = createEmptyBoard()
    const { row, col } = chooseShot(ai, board)
    expect(row).toBeGreaterThanOrEqual(0)
    expect(row).toBeLessThan(10)
    expect(col).toBeGreaterThanOrEqual(0)
    expect(col).toBeLessThan(10)
  })

  it('never repeats a shot', () => {
    let ai = createAIState('easy')
    const board = createEmptyBoard()
    const seen = new Set<string>()

    for (let i = 0; i < 50; i++) {
      const { row, col, nextState } = chooseShot(ai, board)
      const k = `${row},${col}`
      expect(seen.has(k)).toBe(false)
      seen.add(k)
      ai = nextState
    }
  })

  it('marks the chosen cell as tried', () => {
    const ai = createAIState('medium')
    const board = createEmptyBoard()
    const { row, col, nextState } = chooseShot(ai, board)
    expect(wasTried(nextState, row, col)).toBe(true)
  })
})

describe('updateAIAfterShot', () => {
  it('switches to target mode on hit', () => {
    let ai = createAIState('medium')
    ai = updateAIAfterShot(ai, 5, 5, 'hit')
    expect(ai.mode).toBe('target')
    expect(ai.targetQueue.length).toBeGreaterThan(0)
  })

  it('returns to hunt mode on sunk', () => {
    let ai = createAIState('medium')
    ai = updateAIAfterShot(ai, 5, 5, 'hit')
    ai = updateAIAfterShot(ai, 5, 6, 'sunk')
    expect(ai.mode).toBe('hunt')
    expect(ai.targetQueue).toHaveLength(0)
  })

  it('stays in hunt mode on miss', () => {
    let ai = createAIState('medium')
    ai = updateAIAfterShot(ai, 5, 5, 'miss')
    expect(ai.mode).toBe('hunt')
  })

  it('queues adjacent cells on hit', () => {
    let ai = createAIState('hard')
    ai = updateAIAfterShot(ai, 5, 5, 'hit')
    const queued = ai.targetQueue
    const hasUp    = queued.some(c => c.row === 4 && c.col === 5)
    const hasDown  = queued.some(c => c.row === 6 && c.col === 5)
    const hasLeft  = queued.some(c => c.row === 5 && c.col === 4)
    const hasRight = queued.some(c => c.row === 5 && c.col === 6)
    expect(hasUp && hasDown && hasLeft && hasRight).toBe(true)
  })
})
