import PropTypes from 'prop-types'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import ScheduleCard from './ScheduleCard.jsx'
import SortableFavoriteCard from './SortableFavoriteCard.jsx'

export default function TabCard({ item, cardCtx, extraProps = {} }) {
  const {
    darkMode,
    pinnedChannelIds,
    onToggleWatch,
    onToggleFavorite,
    onMarkViewed,
    onTogglePin,
    onFilterChannel,
    isChannelFiltered
  } = cardCtx

  return (
    <ScheduleCard
      key={item.id}
      item={item}
      darkMode={darkMode}
      watched={item.isNotify}
      isPinned={pinnedChannelIds.has(item.channelId)}
      onToggleWatch={onToggleWatch}
      onToggleFavorite={onToggleFavorite}
      onMarkViewed={onMarkViewed}
      onTogglePin={onTogglePin}
      showViewedButton={true}
      isViewed={item.viewedAt != null}
      showDateInTime={true}
      onFilterChannel={onFilterChannel}
      isChannelFiltered={isChannelFiltered(item.channelId)}
      {...extraProps}
    />
  )
}

export function FavoriteSection({ sectionItems, cardCtx, sensors, onDragEnd }) {
  const sectionIds = sectionItems.map((v) => v.id)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
        {sectionItems.map((item) => (
          <SortableFavoriteCard
            key={item.id}
            item={item}
            reorderMode={cardCtx.reorderMode ?? false}
            cardContent={
              <TabCard
                item={item}
                cardCtx={cardCtx}
                extraProps={{
                  showStatusBadge: item.status !== 'ended',
                  showViewedButton: item.status === 'ended'
                }}
              />
            }
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

const cardCtxShape = PropTypes.shape({
  darkMode: PropTypes.bool,
  pinnedChannelIds: PropTypes.instanceOf(Set).isRequired,
  onToggleWatch: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onMarkViewed: PropTypes.func,
  onTogglePin: PropTypes.func,
  onFilterChannel: PropTypes.func,
  isChannelFiltered: PropTypes.func.isRequired,
  reorderMode: PropTypes.bool
})

TabCard.propTypes = {
  item: PropTypes.object.isRequired,
  cardCtx: cardCtxShape.isRequired,
  extraProps: PropTypes.object
}

FavoriteSection.propTypes = {
  sectionItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  cardCtx: cardCtxShape.isRequired,
  sensors: PropTypes.object.isRequired,
  onDragEnd: PropTypes.func.isRequired
}
