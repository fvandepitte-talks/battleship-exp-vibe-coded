import { describe, it, expect } from 'vitest'
import { computeHeatmap } from '../heatmap'
import { placeShip, createEmptyBoard, processShot, hiddenBoard } from '../board'
import { FLEET } from '../types'

const destroyer = FLEET[4] // size 2

describe('computeHeatmap', () => {
  it('returns a 10×10 grid', () => {
    const board = hiddenBoard(placeFleetOnBoard())
    const heatmap = computeHeatmap(board)
    expect(heatmap).toHaveLength(10)
    expect(heatmap[0]).toHaveLength(10)
  })

  it('all values are between 0 and 1', () => {
    const board = hiddenBoard(placeFleetOnBoard())
    const heatmap = computeHeatmap(board)
    heatmap.forEach(row => row.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }))
  })

  it('miss cells have zero probability', () => {
    let board = createEmptyBoard()
    // place only destroyer so we can control what happens
    board = placeShip(board, destroyer, 5, 5, 'horizontal')
    // simulate that the destroyer is the only "ship" remaining
    // shoot a miss at 0,0
    board = processShot(board, 0, 0).board
    const heatmap = computeHeatmap(board)
    expect(heatmap[0][0]).toBe(0)
  })

  it('has non-zero probability where ships could still be', () => {
    const board = placeFleetOnBoard()
    const heatmap = computeHeatmap(board)
    const nonZero = heatmap.flat().some(v => v > 0)
    expect(nonZero).toBe(true)
  })
})

function placeFleetOnBoard() {
  let board = createEmptyBoard()
  board = placeShip(board, FLEET[0], 0, 0, 'horizontal') // carrier  row 0
  board = placeShip(board, FLEET[1], 2, 0, 'horizontal') // battleship row 2
  board = placeShip(board, FLEET[2], 4, 0, 'horizontal') // cruiser row 4
  board = placeShip(board, FLEET[3], 6, 0, 'horizontal') // submarine row 6
  board = placeShip(board, FLEET[4], 8, 0, 'horizontal') // destroyer row 8
  return board
}
