import PropTypes from 'prop-types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function SortableFavoriteCard({ item, reorderMode, cardContent }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !reorderMode
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    display: 'grid',
    gridTemplateColumns: reorderMode ? '28px minmax(0, 1fr)' : 'minmax(0, 1fr)',
    gap: '8px',
    alignItems: 'center'
  }
  return (
    <div ref={setNodeRef} style={style}>
      {reorderMode && (
        <div className="yt-drag-handle" {...attributes} {...listeners}>
          ⠿
        </div>
      )}
      {cardContent}
    </div>
  )
}

SortableFavoriteCard.propTypes = {
  item: PropTypes.shape({ id: PropTypes.string.isRequired }).isRequired,
  reorderMode: PropTypes.bool.isRequired,
  cardContent: PropTypes.node.isRequired
}
