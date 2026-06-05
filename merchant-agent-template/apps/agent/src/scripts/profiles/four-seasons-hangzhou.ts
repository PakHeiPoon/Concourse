/**
 * Four Seasons Hotel Hangzhou at West Lake.
 * Pulled from docs/presentation/four-seasons-hangzhou-mock.json.
 *
 * Skills are mocked (the template's default hotel skills serve from the
 * seeded inventory below — no live PMS integration for the demo).
 */

import type { MerchantProfile } from './index.js';

export const fourSeasonsHangzhou: MerchantProfile = {
  settings: {
    name: {
      en: 'Four Seasons Hotel Hangzhou at West Lake',
      zh: '杭州西子湖四季酒店',
    },
    description: {
      en: 'A garden-style luxury resort tucked beside Jinsha Harbour on the western shore of West Lake. 81 lake-view rooms across six low-rise pavilions, set among ancient camphor trees, koi ponds, and wooden walkways inspired by Jiangnan private gardens. Five minutes from Lingyin Temple, ten minutes from the heart of West Lake.',
      zh: '坐落于西湖西岸金沙港畔的园林式奢华度假酒店。81 间湖景客房分布于六座低层庭院楼阁之间，古樟掩映、锦鲤游池、木栈曲廊，尽显江南私家园林意境。距灵隐寺五分钟，距西湖核心十分钟。',
    },
    merchantType: 'hotel',
    location: {
      country:     'CN',
      city:        'hangzhou',
      address:     '浙江省杭州市西湖区灵隐路5号',
      coordinates: { lat: 30.2425, lng: 120.1153 },
      timezone:    'Asia/Shanghai',
    },
    contact: {
      phone:      '+86 571 8829 8888',
      email:      'reservations.hgz@fourseasons.com',
      websiteUrl: 'https://www.fourseasons.com/hangzhou/',
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
    tags:               ['luxury', 'lakeside', 'west-lake', 'heritage', 'spa', 'garden'],
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
      itemId:     'lake_view_premier',
      nameEn:     'Lake View Premier Room',
      nameZh:     '湖景至尊客房',
      descEn:     'Floor-to-ceiling windows opening onto West Lake and the garden ponds.',
      descZh:     '落地窗正对西湖与园林锦鲤池。',
      rateUsdc:   620,
      stockPerNight: 20,
    },
    {
      itemId:     'garden_villa',
      nameEn:     'Garden Villa',
      nameZh:     '园景别墅',
      descEn:     'Standalone villa with a private courtyard among the camphor trees.',
      descZh:     '独栋别墅，古樟环抱的私家庭院。',
      rateUsdc:   1480,
      stockPerNight: 6,
    },
    {
      itemId:     'presidential_suite',
      nameEn:     'Presidential Suite',
      nameZh:     '总统套房',
      descEn:     'The resort’s flagship suite with panoramic lake frontage.',
      descZh:     '度假村旗舰套房，全景临湖。',
      rateUsdc:   5200,
      stockPerNight: 1,
    },
  ],
};
