import React from 'react'
import Restore from 'react-restore'
import link from '../../../../resources/link'
import svg from '../../../../resources/svg'

import Dropdown from '../../Components/Dropdown'

class _Network extends React.Component {
  constructor (props, context) {
    super(props, context)
    this.customMessage = 'Custom Endpoint'
    const { id, name, type, explorer, symbol, layer } = this.props
    this.network = id
    this.networkType = type
    const primaryCustom = context.store('main.networks', this.networkType, this.network, 'connection.primary.custom') || this.customMessage
    const secondaryCustom = context.store('main.networks', this.networkType, this.network, 'connection.secondary.custom') || this.customMessage
    this.newNetworkIdDefault = 'ID'
    this.newNetworkNameDefault = 'New Network'
    this.newNetworkExplorerDefault = 'Block Explorer'
    this.newNetworkSymbolDefault = 'ETH'
    this.newNetworkType = 'ethereum'
    this.state = {
      id, 
      name, 
      explorer, 
      type, 
      symbol, 
      layer,
      submitted: false, 
      newNetworkId: this.newNetworkIdDefault,
      newNetworkName: this.newNetworkNameDefault,
      newNetworkExplorer: this.newNetworkExplorerDefault,
      newNetworkSymbol: this.newNetworkSymbolDefault,
      newNetworkType: this.newNetworkType,
      localShake: {}, 
      primaryCustom, 
      secondaryCustom, 
      resetConfirm: false, 
      expandNetwork: false,
      showControls: false
    }
 }

  okProtocol (location) {
    if (location === 'injected') return true
    if (location.endsWith('.ipc')) return true
    if (location.startsWith('wss://') || location.startsWith('ws://')) return true
    if (location.startsWith('https://') || location.startsWith('http://')) return true
    return false
  }

  okPort (location) {
    const match = location.match(/^(?:https?|wss?).*:(?<port>\d{4,})/)

    if (match) {
      const portStr = (match.groups || { port: 0 }).port
      const port = parseInt(portStr)
      return port >= 0 && port <= 65535
    }

    return true
  }

  inputPrimaryCustom (e) {
    e.preventDefault()
    clearTimeout(this.customPrimaryInputTimeout)
    const value = e.target.value.replace(/\s+/g, '')
    this.setState({ primaryCustom: value })
    this.customPrimaryInputTimeout = setTimeout(() => link.send('tray:action', 'setPrimaryCustom', this.props.type, this.props.id, this.state.primaryCustom), 1000)
  }

  inputSecondaryCustom (e) {
    e.preventDefault()
    clearTimeout(this.customSecondaryInputTimeout)
    const value = e.target.value.replace(/\s+/g, '')
    this.setState({ secondaryCustom: value })
    this.customSecondaryInputTimeout = setTimeout(() => link.send('tray:action', 'setSecondaryCustom', this.props.type, this.props.id, this.state.secondaryCustom), 1000)
  }

  localShake (key) {
    const localShake = Object.assign({}, this.state.localShake)
    localShake[key] = true
    this.setState({ localShake })
    setTimeout(() => {
      const localShake = Object.assign({}, this.state.localShake)
      localShake[key] = false
      this.setState({ localShake })
    }, 1010)
  }

  status (type, id, layer) {
    const connection = this.store('main.networks', type, id, 'connection', layer)
    let status = connection.status
    const current = connection.current

    if (current === 'custom') {
      if (layer === 'primary' && this.state.primaryCustom !== '' && this.state.primaryCustom !== this.customMessage) {
        if (!this.okProtocol(this.state.primaryCustom)) status = 'invalid target'
        else if (!this.okPort(this.state.primaryCustom)) status = 'invalid port'
      }

      if (layer === 'secondary' && this.state.secondaryCustom !== '' && this.state.secondaryCustom !== this.customMessage) {
        if (!this.okProtocol(this.state.secondaryCustom)) status = 'invalid target'
        else if (!this.okPort(this.state.secondaryCustom)) status = 'invalid port'
      }
    }
    if (status === 'connected' && !connection.network) status = 'loading'
    if (!this.store('main.networks', type, id, 'on')) status = 'off'

    return (
      <div className='connectionOptionStatus'>
        {this.indicator(status)}
        <div className='connectionOptionStatusText'>{status}</div>
      </div>
    )
  }

  indicator (status) {
    if (status === 'connected') {
      return <div className='connectionOptionStatusIndicator'><div className='connectionOptionStatusIndicatorGood' /></div>
    } else if (status === 'loading' || status === 'syncing' || status === 'pending' || status === 'standby') {
      return <div className='connectionOptionStatusIndicator'><div className='connectionOptionStatusIndicatorPending' /></div>
    } else {
      return <div className='connectionOptionStatusIndicator'><div className='connectionOptionStatusIndicatorBad' /></div>
    }
  }

  customSecondaryFocus () {
    if (this.state.secondaryCustom === this.customMessage) this.setState({ secondaryCustom: '' })
  }

  customSecondaryBlur () {
    if (this.state.secondaryCustom === '') this.setState({ secondaryCustom: this.customMessage })
  }


  customPrimaryFocus () {
    if (this.state.primaryCustom === this.customMessage) this.setState({ primaryCustom: '' })
  }

  customPrimaryBlur () {
    if (this.state.primaryCustom === '') this.setState({ primaryCustom: this.customMessage })
  }

  render () {
    const changed = (
      this.state.id && 
      this.state.name && 
      this.state.symbol && 
      this.state.symbol && 
      this.state.explorer && 
      this.state.type &&
      this.state.layer && (
        this.props.id !== this.state.id ||
        this.props.name !== this.state.name ||
        this.props.symbol !== this.state.symbol ||
        this.props.explorer !== this.state.explorer ||
        this.props.type !== this.state.type || 
        this.props.layer !== this.state.layer
      )
    )
    const { id, type, connection } = this.props

    const networkPresets = this.store('main.networkPresets', type)
    let presets = networkPresets[id] || {}
    presets = Object.keys(presets).map(i => ({ text: i, value: type + ':' + id + ':' + i }))
    presets = presets.concat(Object.keys(networkPresets.default).map(i => ({ text: i, value: type + ':' + id + ':' + i })))
    presets.push({ text: 'Custom', value: type + ':' + id + ':' + 'custom' })

    const gas = Math.round(parseInt(this.store('main.networksMeta.ethereum', this.state.id, 'gas.price.levels.fast'), 'hex') / 1e9) || '---'
    const price = this.store('main.networksMeta.ethereum', this.state.id, 'nativeCurrency.usd.price') || '---'
    const change24hr = this.store('main.networksMeta.ethereum', this.state.id, 'nativeCurrency.usd.change24hr') || '---'
    const symbol = this.store('main.networks.ethereum', this.state.id, 'symbol') || '---'

    return (
      <div className='network'>
        <div className='networkActive'>
          <div className='networkName'>
            <input
              value={this.state.name} spellCheck='false'
              onChange={(e) => {
                this.setState({ name: e.target.value })
              }}
              onBlur={(e) => {
                if (e.target.value === '') this.setState({ name: this.props.name })
              }}
            />
          </div>
          {this.props.id === 1 ? (
            <div className='mainnetToggleLock'>{svg.lock(9)}</div>
          ) : (
            <div className={this.props.on ? 'signerPermissionToggle signerPermissionToggleOn' : 'signerPermissionToggle'} onMouseDown={() => {
              link.send('tray:action', 'activateNetwork', type, id, !this.props.on)
            }}>
              <div className='signerPermissionToggleSwitch' />
            </div>
          )}
        </div>
        {this.props.on ? (
          <div className='connectionLevels'>
            <div className='signerPermission signerPermissionNetwork cardShow' style={{ zIndex: 2 }}>
              <div className={connection.primary.on ? 'connectionOption connectionOptionOn' : 'connectionOption'}>
                <div className='connectionOptionToggle'>
                  <div className='signerPermissionSetting'>Primary</div>
                  <div className={connection.primary.on ? 'signerPermissionToggleSmall signerPermissionToggleSmallOn' : 'signerPermissionToggleSmall'} onMouseDown={_ => link.send('tray:action', 'toggleConnection', type, id, 'primary')}>
                    <div className='signerPermissionToggleSwitch' />
                  </div>
                </div>
                {connection.primary.on ? (
                  <>
                    <div className='connectionOptionDetails cardShow'>
                      <div className='connectionOptionDetailsInset'>
                        {this.status(type, id, 'primary')}
                        <Dropdown
                          syncValue={type + ':' + id + ':' + connection.primary.current}
                          onChange={preset => {
                            const [type, id, value] = preset.split(':')
                            link.send('tray:action', 'selectPrimary', type, id, value)
                          }}
                          options={presets}
                        />
                      </div>
                    </div>
                    <div className={connection.primary.current === 'custom' && connection.primary.on ? 'connectionCustomInput connectionCustomInputOn cardShow' : 'connectionCustomInput'}>
                      <input tabIndex='-1' value={this.state.primaryCustom} onFocus={() => this.customPrimaryFocus()} onBlur={() => this.customPrimaryBlur()} onChange={e => this.inputPrimaryCustom(e)} />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            <div className='signerPermission signerPermissionNetwork cardShow' style={{ zIndex: 1 }}>
              <div className={connection.secondary.on ? 'connectionOption connectionOptionOn' : 'connectionOption'}>
                <div className='connectionOptionToggle'>
                  <div className='signerPermissionSetting'>Secondary</div>
                  <div className={connection.secondary.on ? 'signerPermissionToggleSmall signerPermissionToggleSmallOn' : 'signerPermissionToggleSmall'} onMouseDown={_ => link.send('tray:action', 'toggleConnection', type, id, 'secondary')}>
                    <div className='signerPermissionToggleSwitch' />
                  </div>
                </div>
                {connection.secondary.on ? (
                  <>
                    <div className='connectionOptionDetails cardShow'>
                      <div className='connectionOptionDetailsInset'>
                        {this.status(type, id, 'secondary')}
                        <Dropdown
                          syncValue={type + ':' + id + ':' + connection.secondary.current}
                          onChange={preset => {
                            const [type, id, value] = preset.split(':')
                            link.send('tray:action', 'selectSecondary', type, id, value)
                          }}
                          options={presets}
                        />
                      </div>
                    </div>
                    <div className={connection.secondary.current === 'custom' && connection.secondary.on ? 'connectionCustomInput connectionCustomInputOn cardShow' : 'connectionCustomInput'}>
                      <input tabIndex='-1' value={this.state.secondaryCustom} onFocus={() => this.customSecondaryFocus()} onBlur={() => this.customSecondaryBlur()} onChange={e => this.inputSecondaryCustom(e)} />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {/* <div className='signerDrawer' onMouseDown={() => this.setState({ showDetails: !this.state.showDetails })}>
          <div className='showControls'>
            {this.state.showDetails ? 'hide' : 'details'}
          </div>
          <div className='showControlsLine' />
        </div> */}

        {this.props.on && false ? (
          <div className='chainData'>
            <div>{`Gas Price ${gas}`}</div>
            <div>{`Block Height ${1234}`}</div>
            <div>{`1 ${symbol} = $${price.toLocaleString()} ${change24hr > 0 ? '+' : change24hr < 0 ? '-' : ''} ${Math.abs(change24hr).toFixed(2)}%`}</div>
          </div>
        ) : null}

        {/* <div className='chainShow' onMouseDown={() => {
          this.setState({ showControls: !this.state.showControls })
        }}>
          show more
        </div> */}

        <div className='signerDrawer'>
          <div className='showControls' onMouseDown={() => this.setState({ showControls: !this.state.showControls })}>
            <span>{this.state.showControls ? 'less' : 'more'}</span>
          </div>
          <div className='showControlsLine' />
        </div>

        {this.state.showControls ? (
          <div className='chainConfig cardShow'>  
            <div className='chainConfigRow'>  
              <input
                className='chainIdInput'
                value={this.state.id} spellCheck='false'
                onChange={(e) => {
                  if (type === 'ethereum' && id === 1) return
                  this.setState({ id: e.target.value })
                }}
                onBlur={(e) => {
                  if (e.target.value === '') this.setState({ id: this.props.id })
                }}
              />
              <input
                className='chainSymbolInput'
                value={this.state.symbol} spellCheck='false'
                onChange={(e) => {
                  if (type === 'ethereum' && id === 1) return
                  if (e.target.value.length > 8) return e.preventDefault()
                  this.setState({ symbol: e.target.value })
                }}
                onBlur={(e) => {
                  if (e.target.value === '') this.setState({ symbol: this.props.symbol })
                }}
              />
              <Dropdown
                syncValue={this.state.layer}
                onChange={layer => this.setState({ layer })}
                options={type === 'ethereum' && id === 1 ? [
                  { text: 'mainnet', value: 'mainnet'}
                ] : [
                  { text: 'rollup', value: 'rollup'}, 
                  { text: 'sidechain', value: 'sidechain'}, 
                  { text: 'testnet', value: 'testnet'}, 
                  { text: 'other', value: 'other'}
                ]}
                customClass='darkerDrop'
              />
            </div>
            <div className='chainConfigRow'>
              <input
                value={this.state.explorer} spellCheck='false'
                onChange={(e) => {
                  this.setState({ explorer: e.target.value })
                }}
                onBlur={(e) => {
                  if (e.target.value === '') this.setState({ explorer: this.props.explorer })
                }}
              />
            </div>
          </div>
        ) : null}

        {this.state.showControls ? (
          type === 'ethereum' && id === 1 ? (
            <div className='chainMore cardShow'>
              <div className='moduleButton moduleButtonLocked'>
                {svg.lock(11)}
              </div>
            </div>
          ) : (
            <div className='chainMore cardShow'>
              <div
                className='moduleButton moduleButtonBad' onMouseDown={() => {
                  const { id, name, type, explorer } = this.props
                  link.send('tray:action', 'removeNetwork', { id, name, explorer, type })
                }}
              >
                {svg.trash(13)} 
                <span>remove chain</span>
              </div>
            </div>
          )
        ) : null}

        {changed ? (
          <div className='chainConfigSave cardShow'>
            <div
              className='moduleButton moduleButtonGood' onMouseDown={() => {
                const net = { id: this.props.id, name: this.props.name, type: this.props.type, symbol: this.props.symbol, explorer: this.props.explorer, layer: this.props.layer }
                const newNet = { id: this.state.id, name: this.state.name, type: this.state.type, symbol: this.state.symbol, explorer: this.state.explorer, layer: this.state.layer }
                let empty = false
                Object.keys(newNet).forEach(k => {
                  if (typeof newNet[k] === 'string') {
                    newNet[k] = newNet[k].trim()
                  }
                  if (newNet[k] === '') empty = true
                })
                if (empty) return
                this.setState(newNet)
                this.setState({ submitted: true })
                link.send('tray:action', 'updateNetwork', net, newNet)
                setTimeout(() => this.setState({ submitted: false }), 1600)
              }}>
                {svg.save(11)} <span> save changes</span>
              </div>
            </div>
          ) : (this.state.submitted ? (
            <div className='chainConfigSave'>
              <div className='moduleButton'>
                {svg.octicon('check', { height: 22 })}
              </div>
            </div>
          ) : null
        )}
      </div>
    )
  }
}

const Network = Restore.connect(_Network)



class Settings extends React.Component {
  constructor (props, context) {
    super(props, context)
    this.customMessage = 'Custom Endpoint'
    this.network = context.store('main.currentNetwork.id')
    this.networkType = context.store('main.currentNetwork.type')
    const primaryCustom = context.store('main.networks', this.networkType, this.network, 'connection.primary.custom') || this.customMessage
    const secondaryCustom = context.store('main.networks', this.networkType, this.network, 'connection.secondary.custom') || this.customMessage
    context.store.observer(() => {
      const { type, id } = context.store('main.currentNetwork')
      if (this.network !== id || this.networkType !== type) {
        this.networkType = type
        this.network = id
        const primaryCustom = context.store('main.networks', type, id, 'connection.primary.custom') || this.customMessage
        const secondaryCustom = context.store('main.networks', type, id, 'connection.secondary.custom') || this.customMessage
        this.setState({ primaryCustom, secondaryCustom })
      }
    })
    this.newNetworkIdDefault = 'ID'
    this.newNetworkNameDefault = 'New Network'
    this.newNetworkExplorerDefault = 'Block Explorer'
    this.newNetworkSymbolDefault = 'ETH'
    this.newNetworkType = 'ethereum'
    this.state = {
      newNetworkId: this.newNetworkIdDefault,
      newNetworkName: this.newNetworkNameDefault,
      newNetworkExplorer: this.newNetworkExplorerDefault,
      newNetworkSymbol: this.newNetworkSymbolDefault,
      newNetworkType: this.newNetworkType,
      localShake: {}, 
      primaryCustom, 
      secondaryCustom, 
      resetConfirm: false, 
      expandNetwork: false 
    }
  }

  discord () {
    return (
      <div className='discordInvite' onMouseDown={() => this.store.notify('openExternal', { url: 'https://discord.gg/UH7NGqY' })}>
        <div>Need help?</div>
        <div className='discordLink'>Join our Discord!</div>
      </div>
    )
  }

  quit () {
    return (
      <div className='quitFrame'>
        <div onMouseDown={() => link.send('tray:quit')} className='quitFrameButton'>Quit</div>
      </div>
    )
  }

  selectNetwork (network) {
    const [type, id] = network.split(':')
    if (network.type !== type || network.id !== id) link.send('tray:action', 'selectNetwork', type, id)
  }

  expandNetwork (e, expand) {
    e.stopPropagation()
    this.setState({ expandNetwork: expand !== undefined ? expand : !this.state.expandNetwork })
  }

  renderConnections (layer) {
    const nets = []
    const networks = this.store('main.networks')
    Object.keys(networks).forEach(type => {
      nets.push(
        <div key={type}>
          {Object.keys(networks[type])
            .map(id => parseInt(id))
            .sort((a, b) => a - b)
            .filter(id => {
              if (!networks[type][id].layer && layer === 'other') return true
              return networks[type][id].layer === layer
            }).map(id => {
              return <Network
                key={type + id}
                id={id}
                name={networks[type][id].name}
                symbol={networks[type][id].symbol}
                explorer={networks[type][id].explorer}
                type={type}
                connection={networks[type][id].connection}
                layer={networks[type][id].layer}
                on={networks[type][id].on}
              />
            })
          }
        </div>
      )
    })
    return nets
  }

  render () {
    const { type, id } = this.store('main.currentNetwork')
    const networks = this.store('main.networks')
    const connection = networks[type][id].connection
    const networkPresets = this.store('main.networkPresets', type)
    let presets = networkPresets[id] || {}
    presets = Object.keys(presets).map(i => ({ text: i, value: type + ':' + id + ':' + i }))
    presets = presets.concat(Object.keys(networkPresets.default).map(i => ({ text: i, value: type + ':' + id + ':' + i })))
    presets.push({ text: 'Custom', value: type + ':' + id + ':' + 'custom' })
    const networkOptions = []
    Object.keys(networks).forEach(type => {
      Object.keys(networks[type]).forEach(id => {
        networkOptions.push({ text: networks[type][id].name, value: type + ':' + id })
      })
    })
    return (
      <div className={this.store('panel.view') !== 'networks' ? 'localSettings cardHide' : 'localSettings cardShow'} onMouseDown={e => this.expandNetwork(e, false)}>
        <div className='panelHeader' style={{ zIndex: 50 }}>
          <div className='panelHeaderTitle'>Chains</div>
          <div className='panelHeaderAddChain' onMouseDown={() => this.store.notify('addChain')}>
            <div className='panelHeaderAddChainInner'>
              {'Add Chain'}
            </div>
          </div>
        </div>
        <div className='localSettingsWrap'>
          <div className='networkBreak'>
            <div className='networkBreakLayer'>Mainnet</div>
          </div>
          {this.renderConnections('mainnet')}
          <div className='networkBreak'>
            <div className='networkBreakLayer'>Rollups</div>
          </div>
          {this.renderConnections('rollup')}
          <div className='networkBreak'>
            <div className='networkBreakLayer'>Sidechains</div>
          </div>
          {this.renderConnections('sidechain')}
          <div className='networkBreak'>
            <div className='networkBreakLayer'>Testnets</div>
          </div>
          {this.renderConnections('testnet')}
          <div className='networkBreak'>
            <div className='networkBreakLayer'>Other</div>
          </div>
          {this.renderConnections('other')}
          {this.discord()}
        </div>
      </div>
    )
  }
}

export default Restore.connect(Settings)
