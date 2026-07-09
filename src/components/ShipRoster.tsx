import React from 'react'
import { FLEET, PlacedShip } from '../game/types'

interface Props {
  placedShips: PlacedShip[]
  onSelectShip?: (shipId: string) => void
  selectedShipId?: string | null
  orientation?: 'horizontal' | 'vertical'
  onToggleOrientation?: () => void
  onRandomize?: () => void
  onConfirm?: () => void
  isPlacementComplete?: boolean
}

const ShipRoster: React.FC<Props> = ({
  placedShips,
  onSelectShip,
  selectedShipId,
  orientation,
  onToggleOrientation,
  onRandomize,
  onConfirm,
  isPlacementComplete,
}) => {
  const placedIds = new Set(placedShips.map(s => s.id))

  return (
    <div className="ship-roster">
      <h3 className="roster-title">Fleet</h3>
      <ul className="ship-list">
        {FLEET.map(ship => {
          const isPlaced = placedIds.has(ship.id)
          const isSelected = selectedShipId === ship.id
          return (
            <li
              key={ship.id}
              className={`ship-item ${isPlaced ? 'placed' : 'unplaced'} ${isSelected ? 'selected' : ''}`}
              onClick={() => !isPlaced && onSelectShip?.(ship.id)}
              role={isPlaced ? undefined : 'button'}
              tabIndex={isPlaced ? undefined : 0}
              onKeyDown={e => e.key === 'Enter' && !isPlaced && onSelectShip?.(ship.id)}
              title={isPlaced ? 'Already placed' : `Click to place ${ship.name}`}
            >
              <span className="ship-name">{ship.name}</span>
              <span className="ship-segments">
                {Array.from({ length: ship.size }).map((_, i) => (
                  <span key={i} className={`ship-seg ${isPlaced ? 'seg-placed' : ''}`}>
                    {'█'}
                  </span>
                ))}
              </span>
              {isPlaced && <span className="placed-badge">✓</span>}
            </li>
          )
        })}
      </ul>

      {onToggleOrientation && (
        <div className="placement-controls">
          <button className="btn btn-secondary" onClick={onToggleOrientation} title="Press R to rotate">
            Rotate ({orientation === 'horizontal' ? '→' : '↓'})
          </button>
          <button className="btn btn-ghost" onClick={onRandomize}>
            🎲 Randomize
          </button>
        </div>
      )}

      {isPlacementComplete && onConfirm && (
        <button className="btn btn-primary confirm-btn" onClick={onConfirm}>
          ⚓ Start Battle!
        </button>
      )}
    </div>
  )
}

export default ShipRoster
