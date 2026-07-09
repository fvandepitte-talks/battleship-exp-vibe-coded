import { BOARD_SIZE, Board } from './types'

// ─── AI opponent: Hunt / Target algorithm ─────────────────────────────────────
//
// Phase 1 – HUNT: fire at random untried cells (checkerboard pattern for efficiency)
// Phase 2 – TARGET: once a hit is found, fire at adjacent cells to sink the ship

type AIMode = 'hunt' | 'target'

export interface AIState {
  mode: AIMode
  /** Cells queued for targeting after a hit */
  targetQueue: Array<{ row: number; col: number }>
  /** All cells already tried */
  tried: Set<string>
  difficulty: AIDifficulty
}

export type AIDifficulty = 'easy' | 'medium' | 'hard'

export function createAIState(difficulty: AIDifficulty = 'medium'): AIState {
  return { mode: 'hunt', targetQueue: [], tried: new Set(), difficulty }
}

/** Record a shot so the AI doesn't repeat it */
export function recordShot(state: AIState, row: number, col: number): AIState {
  const next = { ...state, tried: new Set(state.tried) }
  next.tried.add(key(row, col))
  return next
}

/**
 * Choose the next cell to fire at.
 * Returns the chosen coordinate and the updated AI state.
 */
export function chooseShot(
  aiState: AIState,
  _opponentBoard: Board,
  rng: () => number = Math.random
): { row: number; col: number; nextState: AIState } {
  // Easy: always random
  if (aiState.difficulty === 'easy') {
    return huntRandom(aiState, rng)
  }

  // Medium / Hard: use hunt-target
  if (aiState.mode === 'target' && aiState.targetQueue.length > 0) {
    // Pop next target
    const [head, ...rest] = aiState.targetQueue
    const nextState: AIState = { ...aiState, targetQueue: rest, tried: new Set(aiState.tried) }
    nextState.tried.add(key(head.row, head.col))
    return { row: head.row, col: head.col, nextState }
  }

  return huntRandom(aiState, rng)
}

/**
 * After learning the outcome of a shot, update the AI target queue.
 */
export function updateAIAfterShot(
  aiState: AIState,
  row: number,
  col: number,
  result: 'hit' | 'miss' | 'sunk'
): AIState {
  if (result === 'sunk') {
    // Ship sunk — return to hunt mode, clear queue
    return { ...aiState, mode: 'hunt', targetQueue: [] }
  }

  if (result === 'hit') {
    // Add orthogonal neighbors to target queue (not already tried)
    const neighbors = getNeighbors(row, col).filter(n => !aiState.tried.has(key(n.row, n.col)))
    // Hard: prioritize neighbors in same axis as previous hits if possible
    return { ...aiState, mode: 'target', targetQueue: [...aiState.targetQueue, ...neighbors] }
  }

  return aiState
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function huntRandom(
  aiState: AIState,
  rng: () => number
): { row: number; col: number; nextState: AIState } {
  const untried: Array<{ row: number; col: number }> = []

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!aiState.tried.has(key(r, c))) {
        // Checkerboard pattern for efficiency on medium/hard
        if (aiState.difficulty === 'easy' || (r + c) % 2 === 0) {
          untried.push({ row: r, col: c })
        }
      }
    }
  }

  // Fallback: if checkerboard exhausted, try all remaining
  const pool = untried.length > 0
    ? untried
    : (() => {
        const all: Array<{ row: number; col: number }> = []
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            if (!aiState.tried.has(key(r, c))) all.push({ row: r, col: c })
          }
        }
        return all
      })()

  const idx = Math.floor(rng() * pool.length)
  const chosen = pool[idx]
  const nextState: AIState = { ...aiState, tried: new Set(aiState.tried) }
  nextState.tried.add(key(chosen.row, chosen.col))
  return { row: chosen.row, col: chosen.col, nextState }
}

function getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter(n => n.row >= 0 && n.row < BOARD_SIZE && n.col >= 0 && n.col < BOARD_SIZE)
}

function key(row: number, col: number): string {
  return `${row},${col}`
}

export { getNeighbors }

/** Quick helper to check if a cell has been tried */
export function wasTried(aiState: AIState, row: number, col: number): boolean {
  return aiState.tried.has(key(row, col))
}
