import type { ProxySubscriptionUsage } from '../../../common/proxy'

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export function formatTrafficSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`
}

export function subscriptionUsed(usage: ProxySubscriptionUsage): number {
  return Math.max(0, usage.upload + usage.download)
}

export function subscriptionRemaining(usage: ProxySubscriptionUsage): number | null {
  if (usage.total < 0) return null
  if (usage.total === 0) return 0
  return Math.max(0, usage.total - subscriptionUsed(usage))
}

export function formatSubscriptionRemaining(usage: ProxySubscriptionUsage): string {
  const remaining = subscriptionRemaining(usage)
  if (remaining === null) return '流量未知'
  if (usage.total === 0) return '不限流量'
  return `${formatTrafficSize(remaining)} 可用`
}

export function subscriptionPercent(usage: ProxySubscriptionUsage): number {
  if (usage.total <= 0) return 0
  return Math.min(100, Math.round((subscriptionUsed(usage) / usage.total) * 100))
}

export function formatSubscriptionExpiry(expire: number): string {
  if (!Number.isFinite(expire) || expire <= 0) return '到期时间未知'
  return `到期 ${new Date(expire * 1000).toLocaleDateString('zh-CN')}`
}
