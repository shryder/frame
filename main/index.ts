import { app, ipcMain, protocol, shell, clipboard, globalShortcut, BrowserWindow } from 'electron'
import path from 'path'
import * as Sentry from '@sentry/electron'
import log from 'electron-log'
import url from 'url'

import windows from './windows'
import menu from './menu'
import store from './store'
import dapps from './dapps'
import accounts from './accounts'
import * as launch from './launch'
import * as updater from './updater'
import signers from './signers'
import * as persist from './store/persist'
import showUnhandledExceptionDialog from './windows/dialog/unhandledException'
import Erc20Contract from './contracts/erc20'
import provider from './provider'

require('./rpc')

app.commandLine.appendSwitch('enable-accelerated-2d-canvas', 'true')
app.commandLine.appendSwitch('enable-gpu-rasterization', 'true')
app.commandLine.appendSwitch('force-gpu-rasterization', 'true')
app.commandLine.appendSwitch('ignore-gpu-blacklist', 'true')
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers', 'true')
app.commandLine.appendSwitch('force-color-profile', 'srgb')

process.env.BUNDLE_LOCATION = process.env.BUNDLE_LOCATION || path.resolve(__dirname, './../..', 'bundle')

// app.commandLine.appendSwitch('enable-transparent-visuals', true)
// if (process.platform === 'linux') app.commandLine.appendSwitch('disable-gpu', true)

log.transports.console.level = process.env.LOG_LEVEL || 'info'
log.transports.file.level = ['development', 'test'].includes(process.env.NODE_ENV) ? false : 'verbose'

function getCrashReportFields () {
  const fields = ['networks', 'networksMeta', 'tokens']

  return fields.reduce((extra, field) => {
    return { ...extra, [field]: JSON.stringify(store('main', field) || {}) }
    // if (field === 'accounts') {
    //   // scrub account information
    //   const accountData = Object.fromEntries(Object.entries(store('main.accounts') || {}).map(([id, account]) => {
    //     return [
    //       truncateAddress(id),
    //       {
    //         ...account,
    //         id: truncateAddress(account.id),
    //         address: truncateAddress(account.address)
    //       }
    //     ]
    //   }))

    //   return { ...extra, accounts: JSON.stringify(accountData) }
    // }
  }, {})
}

Sentry.init({
  // only use IPC from renderer process, not HTTP
  ipcMode: Sentry.IPCMode.Classic,
  dsn: 'https://7b09a85b26924609bef5882387e2c4dc@o1204372.ingest.sentry.io/6331069',
  beforeSend: (evt) => {
    return {
      ...evt,
      user: { ...evt.user, ip_address: undefined }, // remove IP address
      tags: { ...evt.tags, 'frame.instance_id': store('main.instanceId') },
      extra: getCrashReportFields()
    }
  }
})

// if (process.defaultApp) {
//   if (process.argv.length >= 2) {
//     app.setAsDefaultProtocolClient('dapp', process.execPath, [path.resolve(process.argv[1])])
//   }
// } else {
//   app.setAsDefaultProtocolClient('dapp')
// }

// app.on('open-url', (event, url) => {
//   dialog.showErrorBox('Welcome Back', `You arrived from: ${url}`)
// })

// log.transports.file.level = 'info'

// Action Monitor
// store.api.feed((state, actions, obscount) => {
//   actions.forEach(a => {
//     console.log(a.name)
//     a.updates.forEach(u => {
//       console.log(u.path)
//     })
//   })
// })

log.info('Chrome: v' + process.versions.chrome)
log.info('Electron: v' + process.versions.electron)
log.info('Node: v' + process.versions.node)

// prevent showing the exit dialog more than once
let closing = false

process.on('uncaughtException', e => {
  Sentry.captureException(e)

  log.error('uncaughtException', e)
  console.log('uncaughtException', e)

  if (e.name === 'EPIPE') {
    log.error('uncaught EPIPE error', e)
    return
  }

  if (!closing) {
    closing = true

    showUnhandledExceptionDialog(e.message, e.name)
  }
})

const externalWhitelist = [
  'https://frame.sh',
  'https://chrome.google.com/webstore/detail/frame-alpha/ldcoohedfbjoobcadoglnnmmfbdlmmhf',
  'https://addons.mozilla.org/en-US/firefox/addon/frame-extension',
  'https://github.com/floating/frame/issues/new',
  'https://github.com/floating/frame/blob/master/LICENSE',
  'https://github.com/floating/frame/blob/0.5/LICENSE',
  'https://aragon.org',
  'https://mainnet.aragon.org',
  'https://rinkeby.aragon.org',
  'https://shop.ledger.com/pages/ledger-nano-x?r=1fb484cde64f',
  'https://shop.trezor.io/?offer_id=10&aff_id=3270',
  'https://discord.gg/UH7NGqY',
  'https://frame.canny.io',
  'https://feedback.frame.sh',
  'https://wiki.trezor.io/Trezor_Bridge',
  'https://opensea.io'
]

global.eval = () => { throw new Error(`This app does not support global.eval()`) } // eslint-disable-line

ipcMain.on('tray:resetAllSettings', () => {
  persist.clear()
  if (updater.updatePending) return updater.quitAndInstall(true, true)
  app.relaunch()
  app.exit(0)
})

// ipcMain.on('tray:removeAllAccountsAndSigners', () => {
//   signers.removeAllSigners()
//   accounts.removeAllAccounts()
// })

ipcMain.on('tray:replaceTx', async (e, id, type) => {
  try {
    await accounts.replaceTx(id, type)
  } catch (e) {
    log.error('tray:replaceTx Error', e)
  }
})

ipcMain.on('tray:clipboardData', (e, data) => {
  if (data) clipboard.writeText(data)
})

ipcMain.on('tray:installAvailableUpdate', (e, install, dontRemind) => {
  updater.installAvailableUpdate(install, dontRemind)
})

ipcMain.on('tray:removeAccount', (e, id) => {
  accounts.remove(id)
})

ipcMain.on('tray:renameAccount', (e, id, name) => {
  accounts.rename(id, name)
})

ipcMain.on('dash:removeSigner', (e, id) => {
  signers.remove(id)
})

ipcMain.on('dash:reloadSigner', (e, id) => {
  signers.reload(id)
})

ipcMain.on('tray:openExternal', (e, url) => {
  const validHost = externalWhitelist.some(entry => url === entry || url.startsWith(entry + '/'))
  if (validHost || true) {
    store.setDash({ showing: false })
    shell.openExternal(url)
  }
})

ipcMain.on('tray:openExplorer', (e, hash, chain) => {
  // remove trailing slashes from the base url
  const explorer = (store('main.networks', chain.type, chain.id, 'explorer') || '').replace(/\/+$/, '')
  shell.openExternal(`${explorer}/tx/${hash}`)
})

ipcMain.on('tray:copyTxHash', (e, hash, chain) => {
  // remove trailing slashes from the base url
  // const explorer = (store('main.networks', chain.type, chain.id, 'explorer') || '').replace(/\/+$/, '')
  // clipboard.writeText(explorer + '/tx/' + hash)
  if (hash) clipboard.writeText(hash)
})

ipcMain.on('tray:giveAccess', (e, req, access) => {
  accounts.setAccess(req, access)
})

ipcMain.on('tray:addChain', (e, chain, req) => {
  if (chain) store.addNetwork(chain)
  if (req) accounts.resolveRequest(req)
})

ipcMain.on('tray:switchChain', (e, type, id, req) => {
  if (type && id) store.selectNetwork(type, id)
  accounts.resolveRequest(req)
})

ipcMain.handle('tray:getTokenDetails', (e, contractAddress, chainId) => {
  const contract = new Erc20Contract(contractAddress, intToHex(chainId), provider)
  return contract.getTokenData()
})

ipcMain.on('tray:addToken', (e, token, req) => {
  if (token) {
    log.info('adding custom token', token)
    store.addCustomTokens([token])
  }
  accounts.resolveRequest(req)
})

ipcMain.on('tray:removeToken', (e, token) => {
  if (token) {
    log.info('removing custom token', token)

    store.removeBalance(token.chainId, token.address)
    store.removeCustomTokens([token])
  }
})

ipcMain.on('tray:adjustNonce', (e, handlerId, nonceAdjust) => {
  accounts.adjustNonce(handlerId, nonceAdjust)
})

ipcMain.on('tray:syncPath', (e, path, value) => {
  store.syncPath(path, value)
})

ipcMain.on('tray:ready', () => require('./api'))

ipcMain.on('tray:updateRestart', () => {
  updater.quitAndInstall(true, true)
})

ipcMain.on('tray:refreshMain', () => windows.broadcast('main:action', 'syncMain', store('main')))

// ipcMain.on('tray:toggleFlow', () => windows.toggleFlow())

ipcMain.on('frame:close', e => {
  windows.close(e)
})

ipcMain.on('frame:min', e => {
  windows.min(e)
})

ipcMain.on('frame:max', e => {
  windows.max(e)
})

ipcMain.on('frame:unmax', e => {
  windows.unmax(e)
})

// ipcMain.on('tray:launchDapp', async (e, domain) => {
//   await dapps.add(domain, {}, err => { if (err) console.error('error adding...', err) })
//   await dapps.launch(domain, console.error)
// })

// ipcMain.on('addDapp', (dapp) => dapps.add(dapp))

dapps.add({
  ens: 'send.frame.eth',
  config: {
    key: 'value'
  }
})

// ipcMain.on('runDapp', async (e, ens) => {
//   const win = BrowserWindow.fromWebContents(e.sender)
//   dapps.open(win.frameId, ens)
// })

ipcMain.on('unsetCurrentView', async (e, ens) => {
  const win = BrowserWindow.fromWebContents(e.sender) as FrameWindow
  dapps.unsetCurrentView(win.frameId)
})

ipcMain.on('*:addFrame', (e, id) => {
  const existingFrame = store('main.frames', id)

  if (existingFrame) {
    windows.refocusFrame(id)
  } else {
    store.addFrame({
      id,
      currentView: '',
      views: {}
    })
    dapps.open(id, 'send.frame.eth')
  }
})

// if (process.platform !== 'darwin' && process.platform !== 'win32') app.disableHardwareAcceleration()
app.on('ready', () => {
  menu()
  windows.init()
  // if (process.platform === 'darwin' || process.platform === 'win32') {
  //   windows.tray()
  // } else {
  //   setTimeout(windows.tray, 800)
  // }
  if (app.dock) app.dock.hide()

  protocol.interceptFileProtocol('file', (req, cb) => {
    const appOrigin = path.resolve(__dirname, '../../')
    const filePath = url.fileURLToPath(req.url)

    if (filePath.startsWith(appOrigin)) cb({ path: filePath }) // eslint-disable-line
  })

  store.observer(() => {
    if (store('dash.showing')) {
      windows.showDash()
    } else {
      windows.hideDash()
    }
  })
  store.observer(() => {
    const altSlash = store('main.shortcuts.altSlash')
    if (altSlash) {
      globalShortcut.unregister('Alt+/')
      globalShortcut.register('Alt+/', () => windows.toggleTray())
    } else {
      globalShortcut.unregister('Alt+/')
    }
  })
  // store.observer(() => {
  //   const altSlash = store('main.shortcuts.altSlash')
  //   if (altSlash) {
  //     globalShortcut.unregister('Alt+Space')
  //     globalShortcut.register('Alt+Space', () => windows.openDapp())
  //   } else {
  //     globalShortcut.unregister('Alt+Space')
  //   }
  // })
})

ipcMain.on('tray:action', (e, action, ...args) => {
  if (store[action]) return store[action](...args)
  log.info('Tray sent unrecognized action: ', action)
})

app.on('activate', () => windows.showTray())
app.on('will-quit', () => app.quit())
app.on('quit', async () => {
  // await clients.stop()
  accounts.close()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

let launchStatus = store('main.launch')
store.observer(() => {
  if (launchStatus !== store('main.launch')) {
    launchStatus = store('main.launch')
    launchStatus ? launch.enable() : launch.disable()
  }
})