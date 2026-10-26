(() => {
  'use strict'

  if (window.workbench?.shell === 'wpf' && window.workbench?.impl === 'webview2') return

  const webview = window.chrome?.webview
  const pending = new Map()
  const handlers = new Map()
  let requestSeq = 0
  let reminderTimer = 0

  function emit(name, payload) {
    const list = handlers.get(name)
    if (!list) return
    for (const handler of [...list]) {
      try {
        handler(payload)
      } catch (error) {
        console.error(`[whaletide bridge] ${name} handler failed`, error)
      }
    }
  }

  function listen(name, callback) {
    const set = handlers.get(name) ?? new Set()
    set.add(callback)
    handlers.set(name, set)
    return () => {
      set.delete(callback)
      if (set.size === 0) handlers.delete(name)
    }
  }

  function request(method, args = {}) {
    if (!webview) {
      return Promise.reject(new Error(`Whaletide host bridge is unavailable (${method})`))
    }

    const id = `wv-${Date.now()}-${++requestSeq}`
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Whaletide host request timed out: ${method}`))
      }, 15_000)

      pending.set(id, { resolve, reject, timer })
      webview.postMessage({ type: 'whaletide:request', id, method, args })
    })
  }

  function settle(message) {
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    window.clearTimeout(waiter.timer)
    if (message.ok) waiter.resolve(message.result)
    else waiter.reject(new Error(message.error || 'Whaletide host request failed'))
  }

  webview?.addEventListener('message', (event) => {
    let message = event.data
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message)
      } catch {
        return
      }
    }
    if (!message || typeof message !== 'object') return

    if (message.type === 'whaletide:response') {
      settle(message)
      return
    }
    if (message.type === 'whaletide:event') {
      emit(message.event, message.payload)
    }
  })

  const idleUpdate = () => ({
    status: 'idle',
    version: '',
    notes: '',
    releasedAt: '',
    percent: 0,
    downloaded: 0,
    total: 0,
    error: null
  })

  const idleProxySnapshot = () => ({
    status: 'stopped',
    running: false,
    starting: false,
    error: null,
    version: null,
    coreReady: false,
    corePath: '',
    activeGroup: '',
    activeNode: '',
    activeDelay: -1,
    traffic: {
      up: 0,
      down: 0,
      totalUp: 0,
      totalDown: 0,
      sessionUp: 0,
      sessionDown: 0,
      connections: 0
    },
    profile: {
      name: '',
      source: 'none',
      url: '',
      updatedAt: '',
      nodeCount: 0,
      subscription: null
    },
    profiles: [],
    activeProfileId: '',
    settings: {
      enabledOnStart: false,
      corePath: '',
      mixedPort: 7890,
      controllerPort: 9090,
      secret: '',
      mode: 'rule',
      subscriptionUrl: '',
      allowLan: false,
      systemProxy: false
    },
    systemProxy: false,
    nodeCount: 0,
    groupCount: 0
  })

  const proxyUnavailable = () => ({
    ok: false,
    error: 'WPF 外壳尚未接入代理内核'
  })

  const api = {
    impl: 'webview2',
    shell: 'wpf',
    platform: 'win32',

    getOpenAtLogin: () => request('settings.getOpenAtLogin'),
    setOpenAtLogin: (openAtLogin, openAsHidden = false) =>
      request('settings.setOpenAtLogin', { openAtLogin, openAsHidden }),

    pickImage: () => request('dialog.pickImage'),
    saveModuleIcon: (moduleId, sourcePath) =>
      request('icons.saveModuleIcon', { moduleId, sourcePath }),
    removeModuleIcon: (moduleId) => request('icons.removeModuleIcon', { moduleId }),
    iconFileUrl: (filePath) => request('icons.fileUrl', { filePath }),

    getAppInfo: () => request('app.getInfo'),
    setChromeTheme: (payload) => request('window.setChromeTheme', payload),

    isMaximized: () => request('window.isMaximized'),
    minimizeWindow: () => request('window.minimize'),
    maximizeWindow: () => request('window.maximize'),
    closeWindow: () => request('window.close'),
    getCloseAction: () => request('window.getCloseAction'),
    setCloseAction: (action) => request('window.setCloseAction', { action }),
    onMaximized: (callback) => listen('window:maximized', callback),

    syncReminder: (payload) => {
      window.clearTimeout(reminderTimer)
      reminderTimer = 0
      if (!payload?.enabled || !payload?.fireAt) {
        return Promise.resolve({ scheduled: false, reason: 'disabled' })
      }

      const fireAt = new Date(payload.fireAt).getTime()
      const delay = fireAt - Date.now()
      if (!Number.isFinite(delay) || delay < 0) {
        return Promise.resolve({ scheduled: false, reason: 'past' })
      }

      reminderTimer = window.setTimeout(() => {
        reminderTimer = 0
        emit('reminder:fired', { dateKey: payload.dateKey })
      }, Math.min(delay, 0x7fffffff))
      return Promise.resolve({ scheduled: true, fireAt: payload.fireAt })
    },
    clearReminder: () => {
      window.clearTimeout(reminderTimer)
      reminderTimer = 0
      return Promise.resolve(true)
    },
    testReminder: () => {
      window.setTimeout(() => emit('reminder:fired', { dateKey: 'test' }), 60)
      return Promise.resolve(true)
    },
    onReminderFired: (callback) => listen('reminder:fired', callback),
    onGuestOpenTab: (callback) => listen('guest:open-tab', callback),
    openExternal: (url) => request('shell.openExternal', { url }),

    update: {
      state: () => Promise.resolve(idleUpdate()),
      check: () => Promise.resolve(idleUpdate()),
      download: () => Promise.resolve(idleUpdate()),
      install: () => Promise.resolve(false),
      onChange: (callback) => listen('update:changed', callback)
    },

    proxy: {
      snapshot: () => Promise.resolve(idleProxySnapshot()),
      groups: () => Promise.resolve([]),
      logs: () => Promise.resolve([]),
      start: () => Promise.resolve(proxyUnavailable()),
      startCore: () => Promise.resolve(proxyUnavailable()),
      toggleProxy: () => Promise.resolve(proxyUnavailable()),
      stop: () => Promise.resolve(proxyUnavailable()),
      restart: () => Promise.resolve(proxyUnavailable()),
      select: () => Promise.resolve(proxyUnavailable()),
      testDelay: () => Promise.resolve(-1),
      testGroup: () => Promise.resolve(null),
      onTestProgress: (callback) => listen('proxy:test-progress', callback),
      setMode: () => Promise.resolve(proxyUnavailable()),
      patchSettings: () => Promise.resolve(idleProxySnapshot()),
      setSystemProxy: () => Promise.resolve(proxyUnavailable()),
      importProfile: () => Promise.resolve(proxyUnavailable()),
      setSubscription: () => Promise.resolve(proxyUnavailable()),
      updateSubscription: () => Promise.resolve(proxyUnavailable()),
      switchProfile: () => Promise.resolve(proxyUnavailable()),
      removeProfile: () => Promise.resolve(proxyUnavailable()),
      renameProfile: () => Promise.resolve(proxyUnavailable()),
      onState: (callback) => listen('proxy:state', callback)
    },

    android: {
      pickWindow: () => request('android.pickWindow'),
      mount: (payload) => request('android.mount', payload),
      launch: (payload) => request('android.launch', payload),
      updateBounds: (payload) => request('android.updateBounds', payload),
      deactivate: () => request('android.deactivate'),
      detach: () => request('android.detach'),
      status: () => request('android.status'),
      onStatus: (callback) => listen('android:status', callback)
    }
  }

  Object.defineProperty(window, 'workbench', {
    configurable: true,
    enumerable: true,
    value: api
  })
})()
