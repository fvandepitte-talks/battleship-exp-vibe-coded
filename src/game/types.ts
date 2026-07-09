// ─── Core game types ──────────────────────────────────────────────────────────

export const BOARD_SIZE = 10

export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk'

export interface Cell {
  row: number
  col: number
  state: CellState
  shipId: string | null
}

export type Orientation = 'horizontal' | 'vertical'

export interface ShipConfig {
  id: string
  name: string
  size: number
}

export interface PlacedShip {
  id: string
  name: string
  size: number
  cells: Array<{ row: number; col: number }>
  hits: number
  sunk: boolean
}

export type ShotResult = 'miss' | 'hit' | 'sunk' | 'already_shot' | 'invalid'

export interface ShotOutcome {
  result: ShotResult
  shipName?: string
  won: boolean
}

export type GamePhase = 'setup' | 'player_turn' | 'ai_turn' | 'game_over'

export type Winner = 'player' | 'ai' | null

export interface Board {
  cells: Cell[][]
  ships: PlacedShip[]
}

export interface GameState {
  phase: GamePhase
  playerBoard: Board
  aiBoard: Board
  winner: Winner
  shotHistory: Array<{ row: number; col: number; player: 'player' | 'ai' }>
  message: string
}

// Standard Battleship fleet
export const FLEET: ShipConfig[] = [
  { id: 'carrier',    name: 'Carrier',    size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser',    name: 'Cruiser',    size: 3 },
  { id: 'submarine',  name: 'Submarine',  size: 3 },
  { id: 'destroyer',  name: 'Destroyer',  size: 2 },
]
