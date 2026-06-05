/**
 * Four Seasons Hotel Guangzhou.
 * Pulled from docs/presentation/four-seasons-guangzhou-mock.json.
 *
 * Skills are mocked (the template's default hotel skills serve from the
 * seeded inventory below — no live PMS integration for the demo).
 */

import type { MerchantProfile } from './index.js';

export const fourSeasonsGuangzhou: MerchantProfile = {
  settings: {
    name: {
      en: 'Four Seasons Hotel Guangzhou',
      zh: '广州四季酒店',
    },
    description: {
      en: 'Occupying floors 70 to 100 of the 103-storey Guangzhou International Finance Center, this is one of the highest hotels in the world. 344 guest rooms with floor-to-ceiling Pearl River views, a 30-storey sky-lit atrium designed by Wilkinson Eyre, an indoor pool on the 70th floor, and five restaurants including the Michelin-recognised Yu Yue Heen Cantonese fine dining. Heart of Zhujiang New Town CBD, 8 minutes’ walk from Canton Tower across the river.',
      zh: '位于 103 层广州国际金融中心 70 至 100 层，是全球最高的酒店之一。344 间客房尽览珠江全景，拥有由 Wilkinson Eyre 设计的 30 层中庭天井、70 层室内泳池，以及五间餐厅——含米其林推荐的粤菜名厨「愉粤轩」。坐落珠江新城 CBD 核心，隔江步行 8 分钟即达广州塔。',
    },
    merchantType: 'hotel',
    location: {
      country:     'CN',
      city:        'guangzhou',
      address:     '广东省广州市天河区珠江新城珠江西路5号',
      coordinates: { lat: 23.1183, lng: 113.3220 },
      timezone:    'Asia/Shanghai',
    },
    contact: {
      phone:      '+86 20 8883 3888',
      email:      'reservations.gua@fourseasons.com',
      websiteUrl: 'https://www.fourseasons.com/guangzhou/',
    },
    cancellationPolicy: {
      type: 'tiered',
      tiers: [
        { hoursBeforeStart: 72,  refundPercent: 100 }, // 3d+
        { hoursBeforeStart: 24,  refundPercent: 50  }, // 1d+
        { hoursBeforeStart: 0,   refundPercent: 0   }, // <1d
      ],
      freeReschedulingHours: 48,
    },
    payment: {
      chain:           'base-sepolia',
      chainId:         84532,
      currency:        'USDC',
      currencyAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
    languagesSupported: ['en', 'zh', 'ja', 'ko', 'fr'],
    priceLevel:         5,
    tags:               ['luxury', 'skyscraper', 'cbd', 'river-view', 'michelin', 'business'],
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
      itemId:     'deluxe_premier',
      nameEn:     'Deluxe Premier Room',
      nameZh:     '豪华至尊客房',
      descEn:     'Floor-to-ceiling Pearl River views from the 70th floor and above.',
      descZh:     '70 层以上，落地窗尽览珠江全景。',
      rateUsdc:   480,
      stockPerNight: 30,
    },
    {
      itemId:     'premier_suite',
      nameEn:     'Premier Suite',
      nameZh:     '至尊套房',
      descEn:     'Separate living room with skyline and river frontage.',
      descZh:     '独立客厅，临江览城天际线。',
      rateUsdc:   980,
      stockPerNight: 12,
    },
    {
      itemId:     'executive_suite',
      nameEn:     'Four Seasons Executive Suite',
      nameZh:     '四季行政套房',
      descEn:     'Corner suite with wraparound views and Executive Club access.',
      descZh:     '转角套房，环景视野，可享行政酒廊礼遇。',
      rateUsdc:   1880,
      stockPerNight: 4,
    },
    {
      itemId:     'presidential_suite',
      nameEn:     'Presidential Suite',
      nameZh:     '总统套房',
      descEn:     'The hotel’s flagship suite near the 100th floor.',
      descZh:     '酒店旗舰套房，临近百层之巅。',
      rateUsdc:   6800,
      stockPerNight: 1,
    },
  ],
};
