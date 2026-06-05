import PropTypes from 'prop-types'
import { getSettingsChannelGroups } from '../src/settingsModalModel.js'

function renderChannelRow({ channel, showDelete, darkMode, styles, onTogglePin, onDeleteChannel }) {
  const { id, title, isPinned } = channel
  const { textColor, bgColor, inputBorder, subBtnBg, subBtnColor, btnStyle } = styles

  return (
    <div
      key={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 10px',
        background: isPinned
          ? darkMode
            ? 'rgba(255,201,64,0.08)'
            : 'rgba(212,144,10,0.06)'
          : bgColor,
        border: `1px solid ${
          isPinned ? (darkMode ? 'rgba(255,201,64,0.24)' : 'rgba(212,144,10,0.22)') : inputBorder
        }`,
        borderRadius: '8px'
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '13px',
          color: isPinned ? (darkMode ? '#ffc940' : '#d4900a') : textColor,
          fontWeight: isPinned ? '600' : 'normal',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={title}
      >
        {isPinned && <span style={{ marginRight: '5px' }}>📌</span>}
        {title}
      </div>
      <button
        onClick={() => onTogglePin(id)}
        title={isPinned ? '優先解除' : '優先に設定'}
        style={{
          ...btnStyle('secondary'),
          padding: '5px 12px',
          background: isPinned
            ? darkMode
              ? 'rgba(255,201,64,0.18)'
              : 'rgba(212,144,10,0.12)'
            : subBtnBg,
          color: isPinned ? (darkMode ? '#ffc940' : '#d4900a') : subBtnColor,
          border: `1px solid ${
            isPinned ? (darkMode ? 'rgba(255,201,64,0.4)' : 'rgba(212,144,10,0.35)') : inputBorder
          }`,
          fontWeight: isPinned ? '600' : 'normal'
        }}
      >
        {isPinned ? '優先中' : '優先'}
      </button>
      {showDelete && (
        <button
          onClick={() => onDeleteChannel(id, title)}
          title="一覧から削除"
          style={{ ...btnStyle('danger'), padding: '5px 10px' }}
        >
          🗑
        </button>
      )}
    </div>
  )
}

export default function SettingsTabChannels({
  darkMode,
  channels,
  channelManagerQuery,
  manualChannelInput,
  manualChannelTitle,
  manualChannelSaving,
  manualVideoInput,
  manualVideoSaving,
  manualVideoMessage,
  isAuthenticated,
  isSyncingChannels,
  styles,
  onChannelManagerQueryChange,
  onManualChannelInputChange,
  onManualChannelTitleChange,
  onManualVideoInputChange,
  onAddManualChannel,
  onAddManualVideo,
  onTogglePin,
  onDeleteChannel,
  onSyncChannelsNow
}) {
  const {
    textColor,
    subColor,
    bgColor,
    inputBg,
    inputBorder,
    rowStyle,
    btnStyle,
    descStyle,
    sectionLabelStyle
  } = styles
  const { subscriptionChannels, manualChannels } = getSettingsChannelGroups(
    channels,
    channelManagerQuery
  )
  const listContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '320px',
    overflowY: 'auto'
  }
  const emptyBox = (text) => (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        background: bgColor,
        border: `1px dashed ${inputBorder}`,
        color: subColor,
        fontSize: '12px',
        textAlign: 'center'
      }}
    >
      {text}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={sectionLabelStyle}>メン限動画の手動追加</div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>
              自動取得できない動画を追加して追跡
            </div>
            <div style={descStyle}>
              メンバー限定配信など、RSS・購読では取得できない動画を URL または動画 ID
              で追加できます。追加にはその動画を視聴できる Google アカウントでのログインが必要です。
            </div>
          </div>
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=... または 動画ID"
            value={manualVideoInput}
            onChange={(e) => onManualVideoInputChange(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              background: inputBg,
              color: textColor,
              border: `1px solid ${inputBorder}`,
              borderRadius: '8px',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <button
            style={btnStyle('primary', { disabled: manualVideoSaving })}
            disabled={manualVideoSaving}
            onClick={onAddManualVideo}
          >
            {manualVideoSaving ? '追加中...' : '追加'}
          </button>
          {manualVideoMessage && (
            <div
              style={{
                fontSize: '12px',
                color: manualVideoMessage.type === 'success' ? '#1e9e54' : '#e8001c'
              }}
            >
              {manualVideoMessage.text}
            </div>
          )}
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>優先チャンネル</div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>
              予定・ライブ一覧の上部に表示するチャンネルを管理
            </div>
            <div style={descStyle}>
              Google 連携で同期した購読チャンネルの一覧です。配信カードの 📌
              ボタンと同じ設定で、ここからまとめて見直せます。
            </div>
            {onSyncChannelsNow && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={onSyncChannelsNow}
                  disabled={isSyncingChannels || !isAuthenticated}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: inputBg,
                    color: textColor,
                    border: `1px solid ${inputBorder}`,
                    borderRadius: '6px',
                    cursor: isSyncingChannels || !isAuthenticated ? 'not-allowed' : 'pointer',
                    opacity: isSyncingChannels || !isAuthenticated ? 0.5 : 1
                  }}
                  title="購読チャンネルを今すぐ再同期（通常は 24h キャッシュ）"
                >
                  {isSyncingChannels ? '同期中…' : '🔄 今すぐ同期'}
                </button>
                <span style={{ ...descStyle, marginLeft: '8px' }}>
                  通常は24時間ごとに自動同期されます
                </span>
              </div>
            )}
          </div>
          <input
            type="text"
            placeholder="チャンネル名で絞り込み"
            value={channelManagerQuery}
            onChange={(e) => onChannelManagerQueryChange(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              background: inputBg,
              color: textColor,
              border: `1px solid ${inputBorder}`,
              borderRadius: '8px',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <div style={listContainerStyle}>
            {subscriptionChannels.length > 0
              ? subscriptionChannels.map((ch) =>
                  renderChannelRow({
                    channel: ch,
                    showDelete: false,
                    darkMode,
                    styles,
                    onTogglePin,
                    onDeleteChannel
                  })
                )
              : emptyBox('該当するチャンネルがありません')}
          </div>
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>手動追加チャンネル</div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>
              Google 連携なしで追加・管理するチャンネル
            </div>
            <div style={descStyle}>
              チャンネルページの URL、または @ハンドル名を入力してください。ここで追加した
              チャンネルは購読同期では消えず、🗑 ボタンで削除できます。
            </div>
          </div>
          <input
            type="text"
            placeholder="https://www.youtube.com/@example または @example"
            value={manualChannelInput}
            onChange={(e) => onManualChannelInputChange(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              background: inputBg,
              color: textColor,
              border: `1px solid ${inputBorder}`,
              borderRadius: '8px',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <input
            type="text"
            placeholder="表示名（任意）"
            value={manualChannelTitle}
            onChange={(e) => onManualChannelTitleChange(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              background: inputBg,
              color: textColor,
              border: `1px solid ${inputBorder}`,
              borderRadius: '8px',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <button
            style={btnStyle('primary', { disabled: manualChannelSaving })}
            disabled={manualChannelSaving}
            onClick={onAddManualChannel}
          >
            {manualChannelSaving ? '追加中...' : '追加'}
          </button>
          <div style={listContainerStyle}>
            {manualChannels.length > 0
              ? manualChannels.map((ch) =>
                  renderChannelRow({
                    channel: ch,
                    showDelete: true,
                    darkMode,
                    styles,
                    onTogglePin,
                    onDeleteChannel
                  })
                )
              : emptyBox('手動追加したチャンネルはまだありません')}
          </div>
        </div>
      </div>
    </div>
  )
}

const channelPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  title: PropTypes.string,
  isPinned: PropTypes.bool,
  isManual: PropTypes.bool
})

const stylesPropType = PropTypes.shape({
  textColor: PropTypes.string.isRequired,
  subColor: PropTypes.string.isRequired,
  bgColor: PropTypes.string.isRequired,
  inputBg: PropTypes.string.isRequired,
  inputBorder: PropTypes.string.isRequired,
  subBtnBg: PropTypes.string.isRequired,
  subBtnColor: PropTypes.string.isRequired,
  rowStyle: PropTypes.object.isRequired,
  btnStyle: PropTypes.func.isRequired,
  descStyle: PropTypes.object.isRequired,
  sectionLabelStyle: PropTypes.object.isRequired
})

SettingsTabChannels.propTypes = {
  darkMode: PropTypes.bool.isRequired,
  channels: PropTypes.arrayOf(channelPropType).isRequired,
  channelManagerQuery: PropTypes.string.isRequired,
  manualChannelInput: PropTypes.string.isRequired,
  manualChannelTitle: PropTypes.string.isRequired,
  manualChannelSaving: PropTypes.bool.isRequired,
  manualVideoInput: PropTypes.string.isRequired,
  manualVideoSaving: PropTypes.bool.isRequired,
  manualVideoMessage: PropTypes.shape({
    type: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired
  }),
  isAuthenticated: PropTypes.bool.isRequired,
  isSyncingChannels: PropTypes.bool.isRequired,
  styles: stylesPropType.isRequired,
  onChannelManagerQueryChange: PropTypes.func.isRequired,
  onManualChannelInputChange: PropTypes.func.isRequired,
  onManualChannelTitleChange: PropTypes.func.isRequired,
  onManualVideoInputChange: PropTypes.func.isRequired,
  onAddManualChannel: PropTypes.func.isRequired,
  onAddManualVideo: PropTypes.func.isRequired,
  onTogglePin: PropTypes.func.isRequired,
  onDeleteChannel: PropTypes.func.isRequired,
  onSyncChannelsNow: PropTypes.func
}
