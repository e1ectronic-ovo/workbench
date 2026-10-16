/** 内嵌网站共用的持久化分区：Cookie / 登录态会写进 userData，下次自动带上。 */
export const GUEST_PARTITION = 'persist:workbench'

/** 去掉 Electron 标识，避免部分站点把内嵌页当成异常客户端拦登录。 */
export const GUEST_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
