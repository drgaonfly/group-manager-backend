import axios from 'axios';

interface GeoAddressResponse {
  display_name: string;
  address: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
    zone?: string;
  };
}

interface RandomUserResponse {
  results: [
    {
      name: {
        first: string;
        last: string;
      };
      phone: string;
    },
  ];
}

interface CompleteLocationInfo {
  geoAddress: GeoAddressResponse;
  userInfo: {
    firstName: string;
    lastName: string;
    phone: string;
  };
}

/**
 * 获取完整的位置和用户信息
 * @param ip IP地址
 * @returns 返回地理位置详细信息和随机用户信息
 */
export async function getCompleteLocationInfo(
  ip: string,
): Promise<CompleteLocationInfo> {
  try {
    // 1. 根据IP获取经纬度
    const { latitude, longitude, ...address } = await getIpGeoAddress(ip);

    // 2. 根据经纬度获取地址信息
    const road = await getGeoAddress(latitude, longitude);

    // 3. 获取随机用户信息
    const userInfo = await getRandomUser();

    return {
      ...address,
      ...road,
      ...userInfo,
    };
  } catch (error) {
    console.error('获取完整位置信息失败:', error);
    throw error;
  }
}

/**1
 * 根据IP地址获取地理位置信息
 * @param ip IP地址
 * @returns 返回经纬度信息
 */
export async function getIpGeoAddress(ip: string): Promise<any> {
  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    const {
      latitude,
      longitude,
      country_code: countryCode,
      region_code: stateCode,
      // timezone: rawTimezone,
      postal: postalCode,
      city,
      region,
      country,
      country_name: countryName,
    } = response.data;

    return {
      latitude,
      longitude,
      countryCode,
      stateCode,
      postalCode,
      city,
      region,
      country,
      countryName,
    };
  } catch (error) {
    console.error('获取IP地理位置信息失败:', error);
    return {};
  }
}

/**
 * 根据经纬度获取地址信息
 * @param latitude 纬度
 * @param longitude 经度
 * @returns 返回地址详细信息
 */
async function getGeoAddress(
  latitude: number,
  longitude: number,
): Promise<any> {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse`,
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          'accept-language': 'en',
        },
        headers: {
          'User-Agent': 'FoodApp/1.0',
        },
      },
    );

    const { address } = response.data;

    return {
      road: address.road,
    };
  } catch (error) {
    console.error('获取地理位置详细信息失败:', error);
    throw error;
  }
}

/**
 * 获取随机用户信息
 * @returns 返回用户名和电话信息
 */
async function getRandomUser(): Promise<{
  firstName: string;
  lastName: string;
  phone: string;
}> {
  try {
    const response = await axios.get<RandomUserResponse>(
      'https://randomuser.me/api/',
      {
        params: {
          nat: 'US',
          inc: 'name,phone,id',
        },
      },
    );

    const { first, last } = response.data.results[0].name;
    const { phone } = response.data.results[0];

    return {
      firstName: first,
      lastName: last,
      phone: phone,
    };
  } catch (error) {
    console.error('获取随机用户信息失败:', error);
    throw error;
  }
}
