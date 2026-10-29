import type { WeatherPlace } from './weather'

type ChinaPlace = WeatherPlace & { cityCode: string }

/** 国内常用城市 + 中国天气网城市码，走国内源 */
export const CHINA_WEATHER_PLACES: ChinaPlace[] = [
  { name: '北京', lat: 39.9042, lon: 116.4074, cityCode: '101010100' },
  { name: '上海', lat: 31.2304, lon: 121.4737, cityCode: '101020100' },
  { name: '天津', lat: 39.3434, lon: 117.3616, cityCode: '101030100' },
  { name: '重庆', lat: 29.563, lon: 106.5516, cityCode: '101040100' },
  { name: '广州', lat: 23.1291, lon: 113.2644, cityCode: '101280101' },
  { name: '深圳', lat: 22.5431, lon: 114.0579, cityCode: '101280601' },
  { name: '东莞', lat: 23.0207, lon: 113.7518, cityCode: '101281601' },
  { name: '佛山', lat: 23.0215, lon: 113.1214, cityCode: '101280800' },
  { name: '珠海', lat: 22.271, lon: 113.5767, cityCode: '101280701' },
  { name: '中山', lat: 22.517, lon: 113.3926, cityCode: '101281701' },
  { name: '惠州', lat: 23.1115, lon: 114.4152, cityCode: '101280301' },
  { name: '汕头', lat: 23.3541, lon: 116.6819, cityCode: '101280501' },
  { name: '杭州', lat: 30.2741, lon: 120.1551, cityCode: '101210101' },
  { name: '宁波', lat: 29.8683, lon: 121.544, cityCode: '101210401' },
  { name: '温州', lat: 27.9938, lon: 120.6993, cityCode: '101210701' },
  { name: '嘉兴', lat: 30.7461, lon: 120.755, cityCode: '101210301' },
  { name: '绍兴', lat: 30.0303, lon: 120.5853, cityCode: '101210501' },
  { name: '金华', lat: 29.079, lon: 119.6474, cityCode: '101210901' },
  { name: '南京', lat: 32.0603, lon: 118.7969, cityCode: '101190101' },
  { name: '苏州', lat: 31.2989, lon: 120.5853, cityCode: '101190401' },
  { name: '无锡', lat: 31.491, lon: 120.3119, cityCode: '101190201' },
  { name: '常州', lat: 31.8107, lon: 119.9741, cityCode: '101191101' },
  { name: '徐州', lat: 34.2044, lon: 117.2857, cityCode: '101190801' },
  { name: '南通', lat: 32.0162, lon: 120.8945, cityCode: '101190501' },
  { name: '扬州', lat: 32.3942, lon: 119.4129, cityCode: '101190601' },
  { name: '成都', lat: 30.5728, lon: 104.0668, cityCode: '101270101' },
  { name: '绵阳', lat: 31.4675, lon: 104.6796, cityCode: '101270401' },
  { name: '武汉', lat: 30.5928, lon: 114.3055, cityCode: '101200101' },
  { name: '长沙', lat: 28.2282, lon: 112.9388, cityCode: '101250101' },
  { name: '郑州', lat: 34.7466, lon: 113.6254, cityCode: '101180101' },
  { name: '洛阳', lat: 34.6197, lon: 112.454, cityCode: '101180901' },
  { name: '西安', lat: 34.3416, lon: 108.9398, cityCode: '101110101' },
  { name: '合肥', lat: 31.8206, lon: 117.2272, cityCode: '101220101' },
  { name: '福州', lat: 26.0745, lon: 119.2965, cityCode: '101230101' },
  { name: '厦门', lat: 24.4798, lon: 118.0894, cityCode: '101230201' },
  { name: '泉州', lat: 24.8741, lon: 118.6757, cityCode: '101230501' },
  { name: '南昌', lat: 28.682, lon: 115.8579, cityCode: '101240101' },
  { name: '济南', lat: 36.6512, lon: 117.1201, cityCode: '101120101' },
  { name: '青岛', lat: 36.0671, lon: 120.3826, cityCode: '101120201' },
  { name: '烟台', lat: 37.4638, lon: 121.4479, cityCode: '101120501' },
  { name: '潍坊', lat: 36.7069, lon: 119.1618, cityCode: '101120601' },
  { name: '石家庄', lat: 38.0428, lon: 114.5149, cityCode: '101090101' },
  { name: '太原', lat: 37.8706, lon: 112.5489, cityCode: '101100101' },
  { name: '沈阳', lat: 41.8057, lon: 123.4315, cityCode: '101070101' },
  { name: '大连', lat: 38.914, lon: 121.6147, cityCode: '101070201' },
  { name: '长春', lat: 43.8171, lon: 125.3235, cityCode: '101060101' },
  { name: '哈尔滨', lat: 45.8038, lon: 126.5349, cityCode: '101050101' },
  { name: '昆明', lat: 25.0389, lon: 102.7183, cityCode: '101290101' },
  { name: '贵阳', lat: 26.647, lon: 106.6302, cityCode: '101260101' },
  { name: '南宁', lat: 22.817, lon: 108.3665, cityCode: '101300101' },
  { name: '桂林', lat: 25.2736, lon: 110.2907, cityCode: '101300501' },
  { name: '海口', lat: 20.044, lon: 110.1983, cityCode: '101310101' },
  { name: '三亚', lat: 18.2528, lon: 109.5119, cityCode: '101310201' },
  { name: '兰州', lat: 36.0611, lon: 103.8343, cityCode: '101160101' },
  { name: '西宁', lat: 36.6171, lon: 101.7782, cityCode: '101150101' },
  { name: '银川', lat: 38.4872, lon: 106.2309, cityCode: '101170101' },
  { name: '乌鲁木齐', lat: 43.8256, lon: 87.6168, cityCode: '101130101' },
  { name: '拉萨', lat: 29.652, lon: 91.1721, cityCode: '101140101' },
  { name: '呼和浩特', lat: 40.8426, lon: 111.7492, cityCode: '101080101' },
  { name: '香港', lat: 22.3193, lon: 114.1694, cityCode: '101320101' },
  { name: '澳门', lat: 22.1987, lon: 113.5439, cityCode: '101330101' },
  { name: '台北', lat: 25.033, lon: 121.5654, cityCode: '101340101' },
  { name: '海淀', lat: 39.9599, lon: 116.2981, cityCode: '101010200' },
  { name: '朝阳', lat: 39.9215, lon: 116.4431, cityCode: '101010300' },
  { name: '浦东', lat: 31.2215, lon: 121.5444, cityCode: '101020600' },
  { name: '闵行', lat: 31.1128, lon: 121.3817, cityCode: '101020200' },
  { name: '南山', lat: 22.5312, lon: 113.9294, cityCode: '101280601' },
  { name: '福田', lat: 22.5228, lon: 114.0545, cityCode: '101280601' },
  { name: '天河', lat: 23.1245, lon: 113.3612, cityCode: '101280101' },
  { name: '西湖', lat: 30.2595, lon: 120.1303, cityCode: '101210101' },
  { name: '余杭', lat: 30.418, lon: 120.299, cityCode: '101210106' },
  { name: '滨江', lat: 30.2066, lon: 120.2109, cityCode: '101210101' }
]

export function searchChinaPlaces(query: string): WeatherPlace[] {
  const q = query.trim().replace(/\s+/g, '')
  if (!q) return []
  const matched =
    q.length < 2
      ? CHINA_WEATHER_PLACES.filter((place) => place.name === q)
      : CHINA_WEATHER_PLACES.filter((place) => place.name.includes(q) || q.includes(place.name))
  return matched.map(({ name, lat, lon, cityCode }) => ({ name, lat, lon, cityCode }))
}

/** 按名字找内置城市，返回整条记录（要拿简体名和城市码） */
export function findChinaPlace(name: string): ChinaPlace | undefined {
  const compact = name
    .split(/[·,，\s]/)[0]
    ?.replace(/市$|区$|县$|特别行政区$/g, '')
    .trim()
  if (!compact) return undefined
  const exact = CHINA_WEATHER_PLACES.find((place) => place.name === compact)
  if (exact) return exact
  return CHINA_WEATHER_PLACES.find(
    (place) => compact.includes(place.name) || place.name.includes(compact)
  )
}

export function findChinaCityCode(name: string): string | undefined {
  return findChinaPlace(name)?.cityCode
}

/**
 * 按经纬度找最近的常用城市。定位或反查地名失败时用它兜底，
 * 保证总能拿到一个可用的城市码（只认 200 km 以内，超出不硬凑）。
 */
export function nearestChinaPlace(lat: number, lon: number): ChinaPlace | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined
  if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return undefined

  let best: ChinaPlace | undefined
  let bestScore = Number.POSITIVE_INFINITY
  const scale = Math.cos((lat * Math.PI) / 180)
  for (const place of CHINA_WEATHER_PLACES) {
    const dx = (place.lon - lon) * scale
    const dy = place.lat - lat
    const score = dx * dx + dy * dy
    if (score < bestScore) {
      bestScore = score
      best = place
    }
  }
  // 3.2 平方度 ≈ 半径 1.79° ≈ 200 km
  return bestScore <= 3.2 ? best : undefined
}
