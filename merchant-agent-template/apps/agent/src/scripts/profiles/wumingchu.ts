/**
 * Wuming Chu · Huangshan boutique hotel.
 * Pulled from docs/presentation/wumingchu-huangshan-mock.json.
 *
 * NOTE: this is the original seed merchant. Its agent-card is already
 * registered on Base Sepolia (agentId 1). The settings below must stay
 * byte-identical to what produced that card, or the on-chain hash breaks.
 */

import type { MerchantProfile } from './index.js';

export const wumingchu: MerchantProfile = {
  settings: {
    name: {
      en: 'Wuming Chu · Huangshan Hidden Retreat',
      zh: '黄山无名初隐世酒店',
    },
    description: {
      en: '28-room boutique hideaway nestled in the cloud-shrouded valleys of Huangshan, restored from a century-old Hui-style courtyard estate.',
      zh: '藏于黄山云谷腹地的隐世精品酒店，由当地百年徽派古宅修缮而成，仅设 28 间客房。',
    },
    merchantType: 'hotel',
    location: {
      country:     'CN',
      city:        'huangshan',
      address:     '安徽省黄山市黄山风景区云谷寺路侧（毗邻云谷索道下站）',
      coordinates: { lat: 30.1372, lng: 118.1856 },
      timezone:    'Asia/Shanghai',
    },
    contact: {
      phone:      '+86 559 558 6688',
      email:      'stay@wumingchu.com',
      websiteUrl: 'https://wumingchu.com',
    },
    cancellationPolicy: {
      type: 'tiered',
      tiers: [
        { hoursBeforeStart: 168, refundPercent: 100 }, // 7d+
        { hoursBeforeStart: 72,  refundPercent: 50  }, // 3d+
        { hoursBeforeStart: 0,   refundPercent: 0   }, // <3d
      ],
      freeReschedulingHours: 48,
    },
    payment: {
      chain:           'base-sepolia',
      chainId:         84532,
      currency:        'USDC',
      currencyAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
    languagesSupported: ['zh', 'en'],
    priceLevel:         5,
    tags:               ['boutique', 'retreat', 'mountain', 'huizhou-architecture', 'hot-spring'],
    specifics: {
      starRating:    5,
      checkInTime:   '15:00',
      checkOutTime:  '12:00',
      breakfastIncluded: true,
      parkingAvailable:  true,
    },
  },
  roomTypes: [
    {
      itemId:     'mountain_view',
      nameEn:     'Mountain View Room',
      nameZh:     '云栖山景房',
      descEn:     'Floor-to-ceiling windows facing pine-clad valleys.',
      descZh:     '落地窗外是郁郁苍苍的松涛山谷。',
      rateUsdc:   1820,
      stockPerNight: 12,
    },
    {
      itemId:     'pine_terrace',
      nameEn:     'Pine Terrace Room',
      nameZh:     '松隐露台房',
      descEn:     'Private outdoor terrace shaded by ancient camphor trees.',
      descZh:     '私享室外露台，百年香樟下饮茶观景。',
      rateUsdc:   2480,
      stockPerNight: 8,
    },
    {
      itemId:     'spring_pool',
      nameEn:     'Spring Pool Courtyard Room',
      nameZh:     '汤池院子房',
      descEn:     'Direct access to a private spring-fed soaking pool.',
      descZh:     '直通独立汤池，山泉水温润。',
      rateUsdc:   3680,
      stockPerNight: 6,
    },
  ],
};
